"""Safely archive Coding Tools MCP runtime directories.

Runtime directories are treated as user data. This module only moves an
instance after its owner marker has been validated; it never recursively
deletes an instance or follows links inside one.
"""

from __future__ import annotations

import argparse
import ctypes
import datetime as dt
import errno
import hashlib
import json
import os
import re
import secrets
import stat
import sys
from pathlib import Path
from typing import Any


OWNER_MARKER = ".runtime-owner.json"
RETIREMENT_MARKER = "retirement.json"
OWNER_KIND = "coding-tools-mcp-runtime"
_HASH_RE = re.compile(r"^[0-9a-f]{16}$")
_MAX_ERROR_TEXT = 320
_OWNER_FIELDS = {
    "format",
    "kind",
    "workspace",
    "workspace_hash",
    "runtime_root",
    "instance_id",
    "launch_id",
    "process_id",
}


class RuntimeCleanupError(RuntimeError):
    """Raised when an instance cannot be safely marked as owned."""


def _bounded(value: object, limit: int = _MAX_ERROR_TEXT) -> str:
    text = str(value).replace("\r", " ").replace("\n", " ")
    if len(text) > limit:
        return text[: limit - 1] + "…"
    return text


def _error(code: str, message: object, *, path: Path | None = None) -> dict[str, str]:
    item = {"code": code, "message": _bounded(message)}
    if path is not None:
        item["path"] = _bounded(path)
    return item


def _valid_process_id(process_id: object) -> bool:
    if not isinstance(process_id, int) or isinstance(process_id, bool) or process_id <= 0:
        return False
    # Windows process IDs are DWORDs. Reject out-of-range values instead of
    # treating the resulting ERROR_INVALID_PARAMETER as evidence of a dead PID.
    return os.name != "nt" or process_id <= 0xFFFFFFFF


def _valid_instance_id(instance_id: object) -> bool:
    return (
        isinstance(instance_id, str)
        and bool(instance_id)
        and instance_id not in {".", ".."}
        and len(instance_id) <= 160
        and "/" not in instance_id
        and "\\" not in instance_id
        and not any(ord(char) < 32 for char in instance_id)
    )


def _valid_launch_id(launch_id: object) -> bool:
    return (
        isinstance(launch_id, str)
        and bool(launch_id)
        and len(launch_id) <= 256
        and not any(ord(char) < 32 for char in launch_id)
    )


def _absolute(path: Path) -> Path:
    return Path(os.path.abspath(os.fspath(path.expanduser())))


def _is_reparse_or_symlink(metadata: os.stat_result) -> bool:
    if stat.S_ISLNK(metadata.st_mode):
        return True
    # FILE_ATTRIBUTE_REPARSE_POINT covers Windows junctions as well as links.
    return bool(getattr(metadata, "st_file_attributes", 0) & 0x400)


def _check_path_chain(path: Path, *, require_leaf: bool = True) -> tuple[Path, os.stat_result | None]:
    """Return an absolute path only if every existing component is ordinary."""

    absolute = _absolute(path)
    current = Path(absolute.anchor)
    leaf_metadata: os.stat_result | None = None
    parts = absolute.parts[1:]
    for index, part in enumerate(parts):
        current = current / part
        try:
            metadata = current.lstat()
        except FileNotFoundError:
            if require_leaf:
                raise FileNotFoundError(errno.ENOENT, "path component does not exist", str(current))
            return absolute, None
        if _is_reparse_or_symlink(metadata):
            raise RuntimeCleanupError(f"link or reparse point in path: {current}")
        if index == len(parts) - 1:
            leaf_metadata = metadata
    if require_leaf and leaf_metadata is None:
        leaf_metadata = absolute.lstat()
    return absolute, leaf_metadata


def _directory(path: Path, *, require_leaf: bool = True) -> Path:
    absolute, metadata = _check_path_chain(path, require_leaf=require_leaf)
    if metadata is None:
        return absolute
    if not stat.S_ISDIR(metadata.st_mode):
        raise RuntimeCleanupError(f"expected an ordinary directory: {absolute}")
    return absolute


def _workspace_hash(workspace: Path) -> str:
    resolved = workspace.expanduser().resolve(strict=False)
    return hashlib.sha256(str(resolved).encode("utf-8")).hexdigest()[:16]


def _is_within(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


def _runtime_layout(runtime_dir: Path, *, require_instance: bool) -> tuple[Path, Path, Path, str, str]:
    instance = _absolute(runtime_dir)
    if not _valid_instance_id(instance.name):
        raise RuntimeCleanupError("invalid runtime instance directory name")
    workspace_hash = instance.parent.name
    if not _HASH_RE.fullmatch(workspace_hash):
        raise RuntimeCleanupError("runtime parent is not a workspace hash directory")
    root = instance.parent.parent
    if not root.name:
        raise RuntimeCleanupError("runtime root is missing")

    root = _directory(root)
    if require_instance:
        _directory(instance.parent)
        _directory(instance)
    else:
        _check_path_chain(instance.parent, require_leaf=False)
        _check_path_chain(instance, require_leaf=False)
    return root, instance.parent, instance, workspace_hash, instance.name


def _owner_data(
    runtime_dir: Path,
    *,
    workspace: Path,
    instance_id: str,
    launch_id: str,
    process_id: int,
) -> dict[str, object]:
    root, _hash_dir, instance, workspace_hash, name = _runtime_layout(runtime_dir, require_instance=True)
    if name != instance_id or not _valid_instance_id(instance_id):
        raise RuntimeCleanupError("instance id does not match its directory")
    if not _valid_launch_id(launch_id):
        raise RuntimeCleanupError("launch id must be non-empty and bounded")
    if not _valid_process_id(process_id):
        raise RuntimeCleanupError("process id must be a positive integer")

    resolved_workspace = workspace.expanduser().resolve(strict=False)
    if _workspace_hash(resolved_workspace) != workspace_hash:
        raise RuntimeCleanupError("runtime directory does not match the workspace hash")
    if _is_within(root, resolved_workspace):
        raise RuntimeCleanupError("runtime root is inside the marked workspace")
    return {
        "format": 1,
        "kind": OWNER_KIND,
        "workspace": str(resolved_workspace),
        "workspace_hash": workspace_hash,
        "runtime_root": str(root),
        "instance_id": instance_id,
        "launch_id": launch_id,
        "process_id": process_id,
    }


def _decode_json_object(raw: bytes) -> dict[str, Any]:
    def reject_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("duplicate JSON key")
            result[key] = value
        return result

    parsed = json.loads(raw.decode("utf-8"), object_pairs_hook=reject_duplicates)
    if not isinstance(parsed, dict):
        raise ValueError("JSON value is not an object")
    return parsed


def _read_safe_json_file(path: Path, *, description: str) -> dict[str, Any]:
    _check_path_chain(path)
    metadata = path.lstat()
    if _is_reparse_or_symlink(metadata) or not stat.S_ISREG(metadata.st_mode) or getattr(metadata, "st_nlink", 1) != 1:
        raise RuntimeCleanupError(f"{description} is not an ordinary file")

    flags = os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(path, flags)
    try:
        opened = os.fstat(descriptor)
        if (
            not stat.S_ISREG(opened.st_mode)
            or _is_reparse_or_symlink(opened)
            or getattr(opened, "st_nlink", 1) != 1
        ):
            raise RuntimeCleanupError(f"{description} changed while it was opened")
        with os.fdopen(descriptor, "rb", closefd=False) as stream:
            raw = stream.read(16_384)
            if stream.read(1):
                raise RuntimeCleanupError(f"{description} exceeds the size limit")
        after = path.lstat()
        if _is_reparse_or_symlink(after) or (opened.st_dev, opened.st_ino) != (after.st_dev, after.st_ino):
            raise RuntimeCleanupError(f"{description} changed while it was read")
    finally:
        os.close(descriptor)
    return _decode_json_object(raw)


def _read_owner_marker(instance: Path) -> dict[str, Any]:
    return _read_safe_json_file(instance / OWNER_MARKER, description="owner marker")


def _validate_owner(
    marker: dict[str, Any],
    *,
    root: Path,
    instance: Path,
    process_id: int,
    launch_id: str,
) -> dict[str, object]:
    if set(marker) != _OWNER_FIELDS:
        raise RuntimeCleanupError("owner marker has missing or unknown fields")
    workspace_text = marker.get("workspace")
    if not isinstance(workspace_text, str) or not Path(workspace_text).is_absolute():
        raise RuntimeCleanupError("owner marker workspace must be absolute")
    workspace = Path(workspace_text)
    expected = _owner_data(
        instance,
        workspace=workspace,
        instance_id=instance.name,
        launch_id=launch_id,
        process_id=process_id,
    )
    if marker != expected:
        raise RuntimeCleanupError("owner marker does not match the runtime instance")
    if expected["runtime_root"] != str(root):
        raise RuntimeCleanupError("owner marker runtime root does not match its location")
    return expected


def _write_exclusive(path: Path, payload: bytes) -> tuple[int, int]:
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(path, flags, 0o600)
    opened = os.fstat(descriptor)
    identity = (opened.st_dev, opened.st_ino)
    try:
        if hasattr(os, "fchmod"):
            os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "wb", closefd=False) as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(descriptor)
    except BaseException:
        os.close(descriptor)
        _remove_own_file(path, identity)
        raise
    finally:
        try:
            os.close(descriptor)
        except OSError:
            pass
    return identity


def _remove_own_file(path: Path, identity: tuple[int, int]) -> None:
    try:
        metadata = path.lstat()
    except FileNotFoundError:
        return
    if (
        not _is_reparse_or_symlink(metadata)
        and stat.S_ISREG(metadata.st_mode)
        and (metadata.st_dev, metadata.st_ino) == identity
    ):
        path.unlink()


def write_owner_marker(
    runtime_dir: Path,
    *,
    workspace: Path,
    instance_id: str,
    launch_id: str,
    process_id: int,
) -> None:
    """Create the instance ownership marker without replacing existing data."""

    runtime_dir = Path(runtime_dir)
    marker = _owner_data(
        runtime_dir,
        workspace=Path(workspace),
        instance_id=instance_id,
        launch_id=launch_id,
        process_id=process_id,
    )
    marker_path = runtime_dir / OWNER_MARKER
    try:
        _check_path_chain(marker_path, require_leaf=False)
        if marker_path.exists() or marker_path.is_symlink():
            existing = _read_owner_marker(runtime_dir)
            if existing != marker:
                raise RuntimeCleanupError("existing owner marker belongs to another runtime")
            return
        payload = (json.dumps(marker, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")
        _write_exclusive(marker_path, payload)
    except RuntimeCleanupError:
        raise
    except OSError as exc:
        raise RuntimeCleanupError(f"could not create owner marker: {_bounded(exc)}") from exc


def _rename_no_replace(source: Path, destination: Path) -> None:
    """Atomically rename a directory without replacing a destination."""

    if os.name == "nt":
        # os.rename on Windows fails when the destination already exists.
        os.rename(source, destination)
        return

    # Linux has an explicit no-replace rename primitive, closing the race
    # between checking a random destination and moving the source.
    if sys.platform.startswith("linux"):
        libc = ctypes.CDLL(None, use_errno=True)
        renameat2 = getattr(libc, "renameat2", None)
        if renameat2 is not None:
            renameat2.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
            renameat2.restype = ctypes.c_int
            result = renameat2(-100, os.fsencode(source), -100, os.fsencode(destination), 1)
            if result == 0:
                return
            error_number = ctypes.get_errno()
            raise OSError(error_number, os.strerror(error_number), str(destination))

    if os.path.lexists(destination):
        raise FileExistsError(errno.EEXIST, "archive destination already exists", str(destination))
    os.rename(source, destination)


def _read_retirement_record(
    source: Path,
    *,
    owner: dict[str, object],
    retired: Path,
    workspace_hash: str,
    instance_id: str,
) -> tuple[dict[str, Any] | None, Path | None]:
    record_path = source / RETIREMENT_MARKER
    try:
        metadata = record_path.lstat()
    except FileNotFoundError:
        return None, None
    if _is_reparse_or_symlink(metadata) or not stat.S_ISREG(metadata.st_mode):
        raise RuntimeCleanupError("existing retirement record is not an ordinary file")
    record = _read_safe_json_file(record_path, description="retirement record")
    owner_fields = {**owner, "original_path": str(source)}
    expected_keys = set(owner_fields) | {"original_path", "archive_path", "retired_at", "reason"}
    if set(record) != expected_keys:
        raise RuntimeCleanupError("existing retirement record has missing or unknown fields")
    if any(record.get(key) != value for key, value in owner_fields.items()):
        raise RuntimeCleanupError("existing retirement record belongs to another runtime")
    archive_text = record.get("archive_path")
    if not isinstance(archive_text, str) or not Path(archive_text).is_absolute():
        raise RuntimeCleanupError("existing retirement record has an invalid archive path")
    archive = _absolute(Path(archive_text))
    if str(archive) != archive_text or archive.parent != retired:
        raise RuntimeCleanupError("existing retirement record points outside the retired directory")
    prefix = f"{workspace_hash}-{instance_id}-"
    suffix = archive.name[len(prefix):] if archive.name.startswith(prefix) else ""
    if not re.fullmatch(r"[0-9a-f]{16}", suffix):
        raise RuntimeCleanupError("existing retirement record has an invalid archive name")
    if not isinstance(record.get("retired_at"), str) or not isinstance(record.get("reason"), str):
        raise RuntimeCleanupError("existing retirement record has invalid metadata")
    _check_path_chain(archive, require_leaf=False)
    if os.path.lexists(archive):
        raise RuntimeCleanupError("existing retirement record archive destination is already occupied")
    return record, archive


def _publish_retirement_record(source: Path, payload: bytes) -> None:
    record_path = source / RETIREMENT_MARKER
    _check_path_chain(record_path, require_leaf=False)
    if os.path.lexists(record_path):
        raise FileExistsError(errno.EEXIST, "retirement record already exists", str(record_path))
    pending = source / f".retirement.json.pending-{secrets.token_hex(8)}"
    identity = _write_exclusive(pending, payload)
    try:
        _directory(source)
        _rename_no_replace(pending, record_path)
    except BaseException:
        _remove_own_file(pending, identity)
        raise


def retire_runtime_dir(
    runtime_dir: Path,
    *,
    process_id: int,
    launch_id: str,
    instance_id: str,
    reason: str,
) -> dict[str, Any]:
    """Move one verified runtime instance into its root's recovery area."""

    runtime_dir = Path(runtime_dir)
    errors: list[dict[str, str]] = []
    warnings: list[dict[str, str]] = []
    try:
        if not _valid_process_id(process_id) or not _valid_launch_id(launch_id):
            raise RuntimeCleanupError("process id and launch id are required")
        if not _valid_instance_id(instance_id):
            raise RuntimeCleanupError("invalid instance id")
        if not isinstance(reason, str):
            raise RuntimeCleanupError("reason must be text")
        source, source_metadata = _check_path_chain(runtime_dir, require_leaf=False)
        if not _valid_instance_id(source.name) or not _HASH_RE.fullmatch(source.parent.name):
            raise RuntimeCleanupError("runtime instance path has an invalid layout")
        if source.name != instance_id:
            raise RuntimeCleanupError("instance id does not match its directory")
        if source_metadata is None:
            return {"ok": True, "idempotent": True, "original_path": str(source), "warnings": [], "errors": []}
        if not stat.S_ISDIR(source_metadata.st_mode):
            raise RuntimeCleanupError("runtime instance is not an ordinary directory")
        root, hash_dir, source, workspace_hash, name = _runtime_layout(runtime_dir, require_instance=False)
        if name != instance_id:
            raise RuntimeCleanupError("instance id does not match its directory")
        if _is_reparse_or_symlink(source_metadata) or not stat.S_ISDIR(source_metadata.st_mode):
            raise RuntimeCleanupError("runtime instance is not an ordinary directory")

        marker = _read_owner_marker(source)
        owner = _validate_owner(
            marker,
            root=root,
            instance=source,
            process_id=process_id,
            launch_id=launch_id,
        )
        if owner["instance_id"] != instance_id or owner["workspace_hash"] != workspace_hash:
            raise RuntimeCleanupError("owner marker does not match the requested instance")

        retired = root / "retired"
        try:
            retired_metadata = retired.lstat()
        except FileNotFoundError:
            retired.mkdir()
            retired_metadata = retired.lstat()
        if _is_reparse_or_symlink(retired_metadata) or not stat.S_ISDIR(retired_metadata.st_mode):
            raise RuntimeCleanupError("retired path is not an ordinary directory")
        _directory(retired)

        retirement, archive = _read_retirement_record(
            source,
            owner=owner,
            retired=retired,
            workspace_hash=workspace_hash,
            instance_id=instance_id,
        )
        if retirement is None:
            archive = None
            for _attempt in range(8):
                candidate = retired / f"{workspace_hash}-{instance_id}-{secrets.token_hex(8)}"
                if not os.path.lexists(candidate):
                    archive = candidate
                    break
            if archive is None:
                raise RuntimeCleanupError("could not allocate a unique archive name")

            retirement = {
                "format": 1,
                "kind": OWNER_KIND,
                "original_path": str(source),
                "archive_path": str(archive),
                "retired_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
                "reason": _bounded(reason, 512),
                "workspace": owner["workspace"],
                "workspace_hash": workspace_hash,
                "runtime_root": str(root),
                "instance_id": instance_id,
                "launch_id": launch_id,
                "process_id": process_id,
            }
            payload = (json.dumps(retirement, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")
            try:
                _publish_retirement_record(source, payload)
            except OSError as exc:
                errors.append(_error("RETIREMENT_RECORD_FAILED", exc, path=source / RETIREMENT_MARKER))
                return {"ok": False, "original_path": str(source), "warnings": warnings, "errors": errors}

        if archive is None:
            raise RuntimeCleanupError("retirement record has no archive destination")

        # Recheck ownership, record, and destination immediately before the
        # atomic move. A failed rename leaves the verified record in the source
        # directory so a later call can retry the same destination.
        _directory(root)
        _directory(hash_dir)
        _directory(source)
        current_owner = _validate_owner(
            _read_owner_marker(source),
            root=root,
            instance=source,
            process_id=process_id,
            launch_id=launch_id,
        )
        if current_owner != owner:
            raise RuntimeCleanupError("runtime ownership changed before archive")
        current_record, current_archive = _read_retirement_record(
            source,
            owner=owner,
            retired=retired,
            workspace_hash=workspace_hash,
            instance_id=instance_id,
        )
        if current_record != retirement or current_archive != archive:
            raise RuntimeCleanupError("retirement record changed before archive")
        _rename_no_replace(source, archive)

        try:
            hash_dir.rmdir()
        except FileNotFoundError:
            pass
        except OSError as exc:
            # A populated parent is expected when another instance shares the
            # same workspace hash. Other failures are retained for diagnosis.
            if exc.errno not in {errno.ENOTEMPTY, errno.EEXIST, 145} and getattr(exc, "winerror", None) not in {145, 183}:
                warnings.append(_error("HASH_PARENT_NOT_REMOVED", exc, path=hash_dir))

        return {
            "ok": not errors,
            "original_path": str(source),
            "archive_path": str(archive),
            "warnings": warnings,
            "errors": errors,
        }
    except RuntimeCleanupError as exc:
        errors.append(_error("UNSAFE_RUNTIME", exc, path=runtime_dir))
    except OSError as exc:
        errors.append(_error("RETIRE_FAILED", exc, path=runtime_dir))
    except Exception as exc:  # Cleanup APIs report failures instead of raising.
        errors.append(_error("RETIRE_FAILED", exc, path=runtime_dir))
    return {"ok": False, "warnings": warnings, "errors": errors}


def _process_is_dead(process_id: int) -> tuple[bool, str | None]:
    try:
        os.kill(process_id, 0)
    except ProcessLookupError:
        return True, None
    except PermissionError:
        return False, "process existence could not be confirmed because access was denied"
    except OSError as exc:
        if exc.errno == errno.ESRCH or getattr(exc, "winerror", None) in {2, 3, 87, 1168}:
            return True, None
        return False, f"process existence is uncertain: {_bounded(exc)}"
    except Exception as exc:
        return False, f"process existence is uncertain: {_bounded(exc)}"
    return False, "process is still active"


def cleanup_stopped_runtime(runtime_root: Path, *, process_id: int, launch_id: str) -> dict[str, Any]:
    """Archive only marked instances that belong to one confirmed-dead launch."""

    result: dict[str, Any] = {"ok": False, "archived": [], "errors": [], "warnings": []}
    if not _valid_process_id(process_id) or not _valid_launch_id(launch_id):
        result["errors"].append(_error("INVALID_IDENTITY", "positive process id and non-empty launch id are required"))
        return result

    dead, process_error = _process_is_dead(process_id)
    if not dead:
        result["errors"].append(_error("PROCESS_ACTIVE_OR_UNKNOWN", process_error or "process is active"))
        return result
    if process_id == os.getpid():
        result["errors"].append(_error("CURRENT_PROCESS", "refusing to archive the current CLI process"))
        return result

    try:
        root = _absolute(Path(runtime_root))
        try:
            root_metadata = root.lstat()
        except FileNotFoundError:
            # A missing runtime root has nothing to recover and is idempotent.
            _check_path_chain(root, require_leaf=False)
            result["ok"] = True
            return result
        if _is_reparse_or_symlink(root_metadata) or not stat.S_ISDIR(root_metadata.st_mode):
            raise RuntimeCleanupError("runtime root is not an ordinary directory")
        _directory(root)

        for hash_dir in root.iterdir():
            if not _HASH_RE.fullmatch(hash_dir.name):
                continue
            try:
                hash_metadata = hash_dir.lstat()
                if _is_reparse_or_symlink(hash_metadata) or not stat.S_ISDIR(hash_metadata.st_mode):
                    result["errors"].append(_error("UNSAFE_HASH_DIRECTORY", "workspace hash entry is not an ordinary directory", path=hash_dir))
                    continue
                _directory(hash_dir)
            except OSError as exc:
                result["errors"].append(_error("HASH_DIRECTORY_UNREADABLE", exc, path=hash_dir))
                continue
            except RuntimeCleanupError as exc:
                result["errors"].append(_error("UNSAFE_HASH_DIRECTORY", exc, path=hash_dir))
                continue

            try:
                instances = list(hash_dir.iterdir())
            except OSError as exc:
                result["errors"].append(_error("HASH_DIRECTORY_UNREADABLE", exc, path=hash_dir))
                continue
            for instance in instances:
                try:
                    instance_metadata = instance.lstat()
                except OSError as exc:
                    result["errors"].append(_error("INSTANCE_UNREADABLE", exc, path=instance))
                    continue
                if _is_reparse_or_symlink(instance_metadata):
                    result["errors"].append(_error("UNSAFE_INSTANCE", "instance entry is a link or reparse point", path=instance))
                    continue
                if not stat.S_ISDIR(instance_metadata.st_mode):
                    continue
                try:
                    _directory(instance)
                    marker = _read_owner_marker(instance)
                    # Validate the marker's path identity before comparing the
                    # requested launch. Unrelated but valid owners are skipped.
                    marker_launch = marker.get("launch_id")
                    marker_pid = marker.get("process_id")
                    if not _valid_process_id(marker_pid) or not _valid_launch_id(marker_launch):
                        raise RuntimeCleanupError("owner marker has invalid process or launch identity")
                    _validate_owner(
                        marker,
                        root=root,
                        instance=instance,
                        process_id=marker_pid,
                        launch_id=marker_launch,
                    )
                    if marker_pid != process_id or marker_launch != launch_id:
                        continue
                except FileNotFoundError:
                    # Historical directories without an ownership marker are
                    # intentionally preserved.
                    continue
                except (RuntimeCleanupError, ValueError, UnicodeError, OSError) as exc:
                    result["errors"].append(_error("OWNER_UNVERIFIED", exc, path=instance))
                    continue

                retired = retire_runtime_dir(
                    instance,
                    process_id=process_id,
                    launch_id=launch_id,
                    instance_id=instance.name,
                    reason="stopped-runtime-cleanup",
                )
                if retired.get("ok"):
                    result["archived"].append(
                        {"original_path": str(instance), "archive_path": retired["archive_path"]}
                    )
                    result["warnings"].extend(retired.get("warnings", []))
                else:
                    if retired.get("archive_path"):
                        result["archived"].append(
                            {"original_path": str(instance), "archive_path": retired["archive_path"]}
                        )
                    result["errors"].extend(retired.get("errors", []))

        result["ok"] = not result["errors"]
        return result
    except RuntimeCleanupError as exc:
        result["errors"].append(_error("UNSAFE_RUNTIME_ROOT", exc, path=Path(runtime_root)))
    except OSError as exc:
        result["errors"].append(_error("RUNTIME_ROOT_UNREADABLE", exc, path=Path(runtime_root)))
    except Exception as exc:
        result["errors"].append(_error("CLEANUP_FAILED", exc, path=Path(runtime_root)))
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Archive stopped Coding Tools MCP runtime instances.")
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--pid", required=True, type=int)
    parser.add_argument("--launch-id", required=True)
    arguments = parser.parse_args(argv)
    result = cleanup_stopped_runtime(arguments.root, process_id=arguments.pid, launch_id=arguments.launch_id)
    print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
