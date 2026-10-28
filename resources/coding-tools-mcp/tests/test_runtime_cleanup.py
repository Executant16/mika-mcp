from __future__ import annotations

import contextlib
import ctypes
import gc
import hashlib
import io
import json
import os
import stat
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

SOURCE_ROOT = Path(__file__).resolve().parents[1]
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from coding_tools_mcp import runtime_cleanup


class RuntimeCleanupTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory(prefix="runtime-cleanup-test-")
        self.base = Path(self.temporary.name)
        self.root = self.base / "runtime-root"
        self.workspace = self.base / "workspace"
        self.root.mkdir()
        self.workspace.mkdir()
        self.workspace_hash = hashlib.sha256(
            str(self.workspace.resolve()).encode("utf-8")
        ).hexdigest()[:16]

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def make_instance(
        self,
        instance_id: str,
        *,
        process_id: int = 424_242,
        launch_id: str = "launch-test",
        marker: bool = True,
    ) -> Path:
        instance = self.root / self.workspace_hash / instance_id
        instance.mkdir(parents=True)
        if marker:
            runtime_cleanup.write_owner_marker(
                instance,
                workspace=self.workspace,
                instance_id=instance_id,
                launch_id=launch_id,
                process_id=process_id,
            )
        return instance

    def dead_process(self, _pid: int, _signal: int) -> None:
        raise ProcessLookupError()

    def test_retire_archives_owned_directory_and_preserves_its_contents(self) -> None:
        instance = self.make_instance("instance-one")
        (instance / "home").mkdir()
        (instance / "home" / "session.json").write_text('{"keep":true}', encoding="utf-8")
        (instance / "tmp").mkdir()
        (instance / "tmp" / "scratch.bin").write_bytes(b"runtime data")

        result = runtime_cleanup.retire_runtime_dir(
            instance,
            process_id=424_242,
            launch_id="launch-test",
            instance_id="instance-one",
            reason="normal-close",
        )

        self.assertTrue(result["ok"], result)
        archive = Path(result["archive_path"])
        self.assertFalse(instance.exists())
        self.assertFalse(instance.parent.exists(), "empty workspace hash parent should be removed")
        self.assertEqual((archive / "home" / "session.json").read_text(encoding="utf-8"), '{"keep":true}')
        self.assertEqual((archive / "tmp" / "scratch.bin").read_bytes(), b"runtime data")
        record = json.loads((archive / runtime_cleanup.RETIREMENT_MARKER).read_text(encoding="utf-8"))
        self.assertEqual(record["original_path"], str(instance))
        self.assertEqual(record["archive_path"], str(archive))
        self.assertEqual(record["reason"], "normal-close")

    def test_retiring_one_instance_leaves_other_instances_unchanged(self) -> None:
        first = self.make_instance("instance-one")
        second = self.make_instance("instance-two", process_id=424_243, launch_id="other-launch")
        (second / "preserve.txt").write_text("untouched", encoding="utf-8")

        result = runtime_cleanup.retire_runtime_dir(
            first,
            process_id=424_242,
            launch_id="launch-test",
            instance_id="instance-one",
            reason="close",
        )

        self.assertTrue(result["ok"], result)
        self.assertTrue(second.is_dir())
        self.assertEqual((second / "preserve.txt").read_text(encoding="utf-8"), "untouched")
        self.assertTrue((second / runtime_cleanup.OWNER_MARKER).is_file())

    def test_cleanup_archives_only_exact_dead_process_and_launch(self) -> None:
        matching = self.make_instance("matching")
        wrong_launch = self.make_instance("wrong-launch", launch_id="another-launch")
        wrong_pid = self.make_instance("wrong-pid", process_id=424_243)
        historical = self.make_instance("historical", marker=False)
        with mock.patch.object(runtime_cleanup.os, "kill", side_effect=self.dead_process):
            result = runtime_cleanup.cleanup_stopped_runtime(
                self.root,
                process_id=424_242,
                launch_id="launch-test",
            )

        self.assertTrue(result["ok"], result)
        self.assertEqual(len(result["archived"]), 1)
        self.assertFalse(matching.exists())
        self.assertTrue(wrong_launch.is_dir())
        self.assertTrue(wrong_pid.is_dir())
        self.assertTrue(historical.is_dir())

    def test_active_or_uncertain_process_is_left_untouched(self) -> None:
        instance = self.make_instance("active")
        with mock.patch.object(runtime_cleanup.os, "kill", return_value=None):
            result = runtime_cleanup.cleanup_stopped_runtime(
                self.root,
                process_id=424_242,
                launch_id="launch-test",
            )

        self.assertFalse(result["ok"])
        self.assertEqual(result["archived"], [])
        self.assertTrue(instance.is_dir())

    def test_real_process_probe_does_not_terminate_the_process(self) -> None:
        child = subprocess.Popen(
            [sys.executable, "-B", "-c", "import time; time.sleep(30)"],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        try:
            self.assertIsNone(child.poll())
            dead, _error = runtime_cleanup._process_is_dead(child.pid)
            self.assertFalse(dead)
            self.assertIsNone(child.poll(), "process probe must not terminate a live process")
        finally:
            if child.poll() is None:
                child.terminate()
                child.wait(timeout=5)

    def test_cli_pid_is_never_accepted_for_stopped_runtime_cleanup(self) -> None:
        instance = self.make_instance("current-process", process_id=os.getpid())
        with mock.patch.object(runtime_cleanup.os, "kill", return_value=None):
            result = runtime_cleanup.cleanup_stopped_runtime(
                self.root,
                process_id=os.getpid(),
                launch_id="launch-test",
            )
        self.assertFalse(result["ok"])
        self.assertTrue(instance.is_dir())

    def test_unmarked_and_wrong_launch_instances_remain_and_cli_prints_one_json_line(self) -> None:
        historical = self.make_instance("historical", marker=False)
        buffer = io.StringIO()
        with mock.patch.object(
            runtime_cleanup,
            "cleanup_stopped_runtime",
            return_value={"ok": True, "archived": [], "errors": [], "warnings": []},
        ), contextlib.redirect_stdout(buffer):
            exit_code = runtime_cleanup.main(
                ["--root", str(self.root), "--pid", "424242", "--launch-id", "launch-test"]
            )
        output = buffer.getvalue()
        self.assertEqual(exit_code, 0)
        self.assertEqual(len(output.splitlines()), 1)
        self.assertTrue(json.loads(output)["ok"])
        self.assertTrue(historical.is_dir())

    def test_real_cli_archives_only_a_confirmed_dead_owner(self) -> None:
        stopped = subprocess.Popen(
            [sys.executable, "-B", "-c", "pass"],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        stopped.wait(timeout=5)
        stopped_pid = stopped.pid
        del stopped
        gc.collect()
        instance = self.make_instance(
            "cli-instance",
            process_id=stopped_pid,
            launch_id="cli-launch",
        )
        environment = os.environ.copy()
        environment["PYTHONDONTWRITEBYTECODE"] = "1"
        environment["TELEMETRY"] = "off"
        environment["CODING_TOOLS_MCP_TELEMETRY"] = "off"
        completed = subprocess.run(
            [
                sys.executable,
                "-B",
                "-m",
                "coding_tools_mcp.runtime_cleanup",
                "--root",
                str(self.root),
                "--pid",
                str(stopped_pid),
                "--launch-id",
                "cli-launch",
            ],
            cwd=SOURCE_ROOT,
            env=environment,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=15,
            check=False,
        )
        self.assertEqual(completed.returncode, 0, f"stdout={completed.stdout}\nstderr={completed.stderr}")
        self.assertEqual(len(completed.stdout.splitlines()), 1, completed.stdout)
        payload = json.loads(completed.stdout)
        self.assertTrue(payload["ok"], payload)
        self.assertEqual(len(payload["archived"]), 1, payload)
        self.assertFalse(instance.exists())

    def test_reparse_root_and_instance_entries_are_rejected(self) -> None:
        reparse_metadata = SimpleNamespace(st_mode=stat.S_IFDIR, st_file_attributes=0x400)
        self.assertTrue(runtime_cleanup._is_reparse_or_symlink(reparse_metadata))

        real_reparse_check = runtime_cleanup._is_reparse_or_symlink
        root_identity = (self.root.lstat().st_dev, self.root.lstat().st_ino)

        def root_as_reparse(metadata: os.stat_result) -> bool:
            if (metadata.st_dev, metadata.st_ino) == root_identity:
                return True
            return real_reparse_check(metadata)

        with mock.patch.object(runtime_cleanup.os, "kill", side_effect=self.dead_process), mock.patch.object(
            runtime_cleanup, "_is_reparse_or_symlink", side_effect=root_as_reparse
        ):
            root_result = runtime_cleanup.cleanup_stopped_runtime(
                self.root,
                process_id=424_242,
                launch_id="launch-test",
            )
        self.assertFalse(root_result["ok"])

        instance = self.make_instance("reparse-instance")
        instance_stat = instance.lstat()
        instance_identity = (instance_stat.st_dev, instance_stat.st_ino)

        def instance_as_reparse(metadata: os.stat_result) -> bool:
            if (metadata.st_dev, metadata.st_ino) == instance_identity:
                return True
            return real_reparse_check(metadata)

        with mock.patch.object(runtime_cleanup.os, "kill", side_effect=self.dead_process), mock.patch.object(
            runtime_cleanup, "_is_reparse_or_symlink", side_effect=instance_as_reparse
        ):
            instance_result = runtime_cleanup.cleanup_stopped_runtime(
                self.root,
                process_id=424_242,
                launch_id="launch-test",
            )
        self.assertFalse(instance_result["ok"])
        self.assertTrue(instance.is_dir())
        self.assertTrue((instance / runtime_cleanup.OWNER_MARKER).is_file())

    def test_rename_failure_is_reported_and_source_contents_remain(self) -> None:
        instance = self.make_instance("rename-failure")
        payload = instance / "payload.txt"
        payload.write_text("keep me", encoding="utf-8")
        rename_no_replace = runtime_cleanup._rename_no_replace

        def fail_instance_rename(source: Path, destination: Path) -> None:
            if source == instance:
                raise PermissionError("blocked")
            rename_no_replace(source, destination)

        with mock.patch.object(runtime_cleanup, "_rename_no_replace", side_effect=fail_instance_rename):
            result = runtime_cleanup.retire_runtime_dir(
                instance,
                process_id=424_242,
                launch_id="launch-test",
                instance_id="rename-failure",
                reason="test-failure",
            )

        self.assertFalse(result["ok"])
        self.assertTrue(any(error["code"] == "RETIRE_FAILED" for error in result["errors"]))
        self.assertTrue(instance.is_dir())
        self.assertEqual(payload.read_text(encoding="utf-8"), "keep me")

    def test_retirement_record_write_failure_never_moves_instance(self) -> None:
        instance = self.make_instance("record-write-failure")
        payload = instance / "payload.txt"
        payload.write_text("keep me", encoding="utf-8")
        write_exclusive = runtime_cleanup._write_exclusive

        def fail_record_write(path: Path, data: bytes) -> tuple[int, int]:
            if path.name.startswith(".retirement.json.pending-"):
                raise PermissionError("simulated record write denial")
            return write_exclusive(path, data)

        with mock.patch.object(runtime_cleanup, "_write_exclusive", side_effect=fail_record_write):
            result = runtime_cleanup.retire_runtime_dir(
                instance,
                process_id=424_242,
                launch_id="launch-test",
                instance_id="record-write-failure",
                reason="record-failure",
            )

        self.assertFalse(result["ok"])
        self.assertTrue(any(error["code"] == "RETIREMENT_RECORD_FAILED" for error in result["errors"]))
        self.assertTrue(instance.is_dir())
        self.assertEqual(payload.read_text(encoding="utf-8"), "keep me")
        self.assertTrue((instance / runtime_cleanup.OWNER_MARKER).is_file())
        self.assertFalse((instance / runtime_cleanup.RETIREMENT_MARKER).exists())
        self.assertFalse(list((self.root / "retired").iterdir()))

    def test_rename_failure_keeps_record_for_a_successful_retry(self) -> None:
        instance = self.make_instance("retry-rename")
        payload = instance / "payload.txt"
        payload.write_text("retry me", encoding="utf-8")
        rename_no_replace = runtime_cleanup._rename_no_replace

        def fail_instance_rename(source: Path, destination: Path) -> None:
            if source == instance:
                raise PermissionError("simulated directory rename denial")
            rename_no_replace(source, destination)

        with mock.patch.object(runtime_cleanup, "_rename_no_replace", side_effect=fail_instance_rename):
            first = runtime_cleanup.retire_runtime_dir(
                instance,
                process_id=424_242,
                launch_id="launch-test",
                instance_id="retry-rename",
                reason="first-attempt",
            )

        self.assertFalse(first["ok"])
        self.assertTrue(instance.is_dir())
        self.assertEqual(payload.read_text(encoding="utf-8"), "retry me")
        record_path = instance / runtime_cleanup.RETIREMENT_MARKER
        self.assertTrue(record_path.is_file())
        planned_archive = Path(json.loads(record_path.read_text(encoding="utf-8"))["archive_path"])
        self.assertFalse(planned_archive.exists())

        second = runtime_cleanup.retire_runtime_dir(
            instance,
            process_id=424_242,
            launch_id="launch-test",
            instance_id="retry-rename",
            reason="retry-attempt",
        )

        self.assertTrue(second["ok"], second)
        self.assertEqual(Path(second["archive_path"]), planned_archive)
        self.assertEqual((planned_archive / "payload.txt").read_text(encoding="utf-8"), "retry me")
        archived_record = json.loads((planned_archive / runtime_cleanup.RETIREMENT_MARKER).read_text(encoding="utf-8"))
        self.assertEqual(archived_record["reason"], "first-attempt")

    def test_missing_source_is_idempotent_even_after_empty_hash_parent_was_removed(self) -> None:
        instance = self.make_instance("already-retired")
        first = runtime_cleanup.retire_runtime_dir(
            instance,
            process_id=424_242,
            launch_id="launch-test",
            instance_id="already-retired",
            reason="first-call",
        )
        second = runtime_cleanup.retire_runtime_dir(
            instance,
            process_id=424_242,
            launch_id="launch-test",
            instance_id="already-retired",
            reason="retry",
        )
        self.assertTrue(first["ok"], first)
        self.assertTrue(second["ok"], second)
        self.assertTrue(second.get("idempotent"))

    def test_existing_owner_marker_is_never_replaced(self) -> None:
        instance = self.make_instance("marker-owner")
        marker_path = instance / runtime_cleanup.OWNER_MARKER
        original = marker_path.read_bytes()
        runtime_cleanup.write_owner_marker(
            instance,
            workspace=self.workspace,
            instance_id="marker-owner",
            launch_id="launch-test",
            process_id=424_242,
        )
        self.assertEqual(marker_path.read_bytes(), original)
        with self.assertRaises(runtime_cleanup.RuntimeCleanupError):
            runtime_cleanup.write_owner_marker(
                instance,
                workspace=self.workspace,
                instance_id="marker-owner",
                launch_id="different-launch",
                process_id=424_242,
            )
        if os.name != "nt":
            self.assertEqual(stat.S_IMODE(marker_path.stat().st_mode), 0o600)

    def test_runtime_root_inside_workspace_is_rejected(self) -> None:
        nested_root = self.workspace / "runtime-root"
        nested_root.mkdir()
        nested_instance = nested_root / self.workspace_hash / "nested"
        nested_instance.mkdir(parents=True)
        with self.assertRaises(runtime_cleanup.RuntimeCleanupError):
            runtime_cleanup.write_owner_marker(
                nested_instance,
                workspace=self.workspace,
                instance_id="nested",
                launch_id="launch-test",
                process_id=424_242,
            )

    @unittest.skipUnless(os.name == "nt", "Windows path alias")
    def test_runtime_root_inside_workspace_with_path_alias_is_rejected(self) -> None:
        nested_root = self.workspace / "runtime-root"
        nested_instance = nested_root / self.workspace_hash / "nested-alias"
        nested_instance.mkdir(parents=True)
        # Hosted Windows runners use an 8.3 spelling in TEMP. Keep the hash
        # and instance names intact, shortening only their root's ancestors.
        get_short_path = ctypes.WinDLL("kernel32", use_last_error=True).GetShortPathNameW
        get_short_path.argtypes = [ctypes.c_wchar_p, ctypes.c_wchar_p, ctypes.c_uint32]
        get_short_path.restype = ctypes.c_uint32
        buffer = ctypes.create_unicode_buffer(32768)
        length = get_short_path(str(nested_root), buffer, len(buffer))
        if not length or length >= len(buffer):
            self.fail("GetShortPathNameW failed")
        alias_root = Path(buffer.value)
        if alias_root == nested_root.resolve():
            self.skipTest("8.3 names are disabled on this volume")
        self.assertTrue(alias_root.samefile(nested_root))
        with self.assertRaisesRegex(runtime_cleanup.RuntimeCleanupError, "runtime root is inside"):
            runtime_cleanup.write_owner_marker(
                alias_root / self.workspace_hash / "nested-alias",
                workspace=self.workspace,
                instance_id="nested-alias",
                launch_id="launch-test",
                process_id=424_242,
            )
        self.assertFalse((nested_instance / runtime_cleanup.OWNER_MARKER).exists())


if __name__ == "__main__":
    unittest.main()
