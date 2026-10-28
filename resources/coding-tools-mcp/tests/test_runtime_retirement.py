from __future__ import annotations

import contextlib
import io
import json
import os
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

SOURCE_ROOT = Path(__file__).resolve().parents[1]
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from coding_tools_mcp.errors import ToolFailure
from coding_tools_mcp.server import Runtime


class RuntimeRetirementTests(unittest.TestCase):
    def setUp(self) -> None:
        temporary = tempfile.TemporaryDirectory(prefix="runtime-retirement-")
        self.addCleanup(temporary.cleanup)
        self.base = Path(temporary.name)
        self.workspace = self.base / "workspace"
        self.other = self.base / "other"
        self.workspace.mkdir()
        self.other.mkdir()
        self.root = self.base / "runtime"
        self.environment = patch.dict(os.environ, {
            "CODING_TOOLS_MCP_RUNTIME_ROOT": str(self.root),
            "CODING_TOOLS_MCP_LAUNCH_ID": "",
            "CODING_TOOLS_MCP_AUTHORIZED_ROOTS": json.dumps([str(self.other)]),
            "CODING_TOOLS_MCP_TELEMETRY": "off",
        })
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.runtime = Runtime(self.workspace)
        self.addCleanup(self.runtime.close)
        self.runtime._ensure_runtime_dirs()

    def test_normal_close_archives_content_and_keeps_task_state(self) -> None:
        source = self.runtime.runtime_dir
        (source / "tmp" / "keep.txt").write_text("keep", encoding="utf-8")
        self.runtime.task_state.ensure_started("persistent task")
        task_before = self.runtime.task_state.get()
        self.runtime.close()
        self.assertFalse(source.exists())
        archives = list((self.root / "retired").iterdir())
        self.assertEqual(len(archives), 1)
        self.assertEqual((archives[0] / "tmp" / "keep.txt").read_text(encoding="utf-8"), "keep")
        record = json.loads((archives[0] / "retirement.json").read_text(encoding="utf-8"))
        self.assertEqual(record["original_path"], str(source))
        self.assertEqual(self.runtime.task_state.get(), task_before)
        with self.assertRaises(ToolFailure):
            self.runtime._ensure_runtime_dirs()
        self.assertFalse(source.exists())

    def test_switch_archives_old_instance_and_marks_new_workspace(self) -> None:
        old = self.runtime.runtime_dir
        with patch.object(self.runtime, "preheat_workspace_async"):
            self.runtime.switch_workspace(self.other)
        self.assertFalse(old.exists())
        self.assertTrue(self.runtime.runtime_dir.is_dir())
        owner = json.loads((self.runtime.runtime_dir / ".runtime-owner.json").read_text(encoding="utf-8"))
        self.assertEqual(owner["workspace"], str(self.other.resolve()))
        self.assertEqual(owner["launch_id"], self.runtime.runtime_launch_id)

    def test_close_preserves_directory_when_terminated_session_still_runs(self) -> None:
        source = self.runtime.runtime_dir
        session = Mock()
        session.process.poll.return_value = None
        self.runtime.sessions["active"] = session
        with patch("coding_tools_mcp.server.terminate_process_group"), contextlib.redirect_stderr(io.StringIO()) as output:
            self.runtime.close()
        self.assertTrue(source.exists())
        self.assertIn("runtime-cleanup", output.getvalue())

    def test_starting_command_and_background_operation_defer_close(self) -> None:
        self.runtime.starting_sessions = 1
        self.runtime.background_operations["running"] = {"event": threading.Event()}
        with contextlib.redirect_stderr(io.StringIO()) as output:
            self.runtime.close()
        self.assertTrue(self.runtime.runtime_dir.exists())
        self.assertIn("runtime-cleanup", output.getvalue())

    def test_busy_background_blocks_workspace_switch_without_changing_state(self) -> None:
        self.runtime.background_operations["running"] = {"event": threading.Event()}
        source = self.runtime.runtime_dir
        with self.assertRaises(ToolFailure) as raised:
            self.runtime.switch_workspace(self.other)
        self.assertEqual(raised.exception.code, "WORKSPACE_BUSY")
        self.assertEqual(self.runtime.workspace.root, self.workspace.resolve())
        self.assertEqual(self.runtime.runtime_dir, source)
        self.runtime.background_operations["running"]["event"].set()

    def test_archive_failure_is_logged_and_keeps_original(self) -> None:
        source = self.runtime.runtime_dir
        with patch("coding_tools_mcp.runtime_cleanup._rename_no_replace", side_effect=PermissionError("locked")), contextlib.redirect_stderr(io.StringIO()) as output:
            self.runtime.close()
        self.assertTrue(source.exists())
        self.assertIn("runtime-cleanup", output.getvalue())
        self.assertIn("locked", output.getvalue())


if __name__ == "__main__":
    unittest.main()
