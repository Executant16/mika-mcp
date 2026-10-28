from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

SOURCE_ROOT = Path(__file__).resolve().parents[1]
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from coding_tools_mcp.errors import ToolFailure
from coding_tools_mcp.server import Runtime, runtime_dir_for_workspace, fallback_runtime_dir_for_workspace, workspace_runtime_hash
from coding_tools_mcp.task_state import TaskStateStore


def make_completed_waiting(root: Path) -> None:
    store = TaskStateStore(root)
    store.ensure_started("legacy completed task")
    store.update({
        "lifecycle_state": "waiting_model",
        "current_step": "Waiting for model",
        "steps": [
            {"id": "apply", "text": "Apply", "status": "completed"},
            {"id": "verify", "text": "Verify", "status": "completed"},
        ],
        "current_command": None,
        "failure": None,
    })


class RuntimeTaskRecoveryTests(unittest.TestCase):
    def test_runtime_start_archives_completed_waiting_task(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            make_completed_waiting(root)
            runtime = Runtime(root)
            self.assertEqual(runtime.task_state.get()["lifecycle_state"], "idle")
            self.assertEqual(runtime.task_state.history(1)[0]["archive_reason"], "recovered-completed-waiting")
            runtime.close()

    def test_workspace_switch_runs_same_completed_waiting_recovery(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            first = base / "first"
            second = base / "second"
            first.mkdir()
            second.mkdir()
            make_completed_waiting(second)
            with patch.dict(os.environ, {"CODING_TOOLS_MCP_AUTHORIZED_ROOTS": json.dumps([str(second)])}):
                runtime = Runtime(first)
                # This test covers task recovery, not asynchronous git preheat.
                # A preheat subprocess can still hold the fixture cwd at teardown.
                with patch.object(runtime, "preheat_workspace_async"):
                    result = runtime.switch_workspace(second)
                self.assertTrue(result["changed"])
                self.assertEqual(runtime.task_state.get()["lifecycle_state"], "idle")
                self.assertEqual(runtime.task_state.history(1)[0]["archive_reason"], "recovered-completed-waiting")
                runtime.close()


class RuntimeDirectoryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.base = Path(__file__).resolve().parent / "runtime-dir-fixture"
        self.workspace = self.base / "workspace"
        self.addCleanup(patch.stopall)
        patch.dict(os.environ, {"CODING_TOOLS_MCP_RUNTIME_ROOT": ""}).start()
        patch("coding_tools_mcp.server.Path.cwd", return_value=self.base / "cwd").start()

    def test_external_default_temp_directory_is_used(self) -> None:
        with patch("coding_tools_mcp.server.tempfile.gettempdir", return_value=str(self.base / "temp")):
            self.assertEqual(runtime_dir_for_workspace(self.workspace, "instance"),
                             self.base / "temp" / "coding-tools-mcp" / workspace_runtime_hash(self.workspace) / "instance")

    def test_default_root_inside_workspace_is_rejected_without_external_fallback(self) -> None:
        with patch("coding_tools_mcp.server.tempfile.gettempdir", return_value=str(self.workspace)), \
                patch("coding_tools_mcp.server.runtime_parent_fallback_root", return_value=None):
            with self.assertRaises(ToolFailure) as caught:
                runtime_dir_for_workspace(self.workspace, "instance")
            self.assertEqual(caught.exception.code, "RUNTIME_DIR_UNWRITABLE")
            self.assertFalse((self.workspace / "coding-tools-mcp").exists())

    def test_cwd_fallback_is_rejected_even_when_workspace_is_a_sibling(self) -> None:
        with patch("coding_tools_mcp.server.tempfile.gettempdir", return_value=str(self.base / "cwd")), \
                patch("coding_tools_mcp.server.runtime_parent_fallback_root", return_value=None):
            with self.assertRaises(ToolFailure) as caught:
                runtime_dir_for_workspace(self.workspace, "instance")
            self.assertEqual(caught.exception.code, "RUNTIME_DIR_UNWRITABLE")

    def test_explicit_external_root_overrides_unsafe_temp(self) -> None:
        external = self.base / "desktop-runtime"
        with patch.dict(os.environ, {"CODING_TOOLS_MCP_RUNTIME_ROOT": str(external)}), \
                patch("coding_tools_mcp.server.tempfile.gettempdir", side_effect=AssertionError("temp must not be consulted")):
            self.assertEqual(runtime_dir_for_workspace(self.workspace, "instance"),
                             external / workspace_runtime_hash(self.workspace) / "instance")

    def test_explicit_root_inside_workspace_remains_invalid_argument(self) -> None:
        for root in (self.workspace, self.workspace / "runtime"):
            with self.subTest(root=root), patch.dict(os.environ, {"CODING_TOOLS_MCP_RUNTIME_ROOT": str(root)}):
                with self.assertRaises(ToolFailure) as caught:
                    runtime_dir_for_workspace(self.workspace, "instance")
                self.assertEqual(caught.exception.code, "INVALID_ARGUMENT")

    def test_external_fallback_is_used_when_default_root_is_unsafe(self) -> None:
        external = self.base / "external-fallback"
        with patch("coding_tools_mcp.server.tempfile.gettempdir", return_value=str(self.workspace)), \
                patch("coding_tools_mcp.server.runtime_parent_fallback_root", return_value=external):
            self.assertEqual(runtime_dir_for_workspace(self.workspace, "instance"),
                             external / workspace_runtime_hash(self.workspace) / "instance")

    def test_fallback_inside_workspace_or_cwd_is_never_used(self) -> None:
        for root in (self.workspace / "fallback", self.base / "cwd" / "coding-tools-mcp"):
            with self.subTest(root=root), \
                    patch("coding_tools_mcp.server.tempfile.gettempdir", return_value=str(self.workspace)), \
                    patch("coding_tools_mcp.server.runtime_parent_fallback_root", return_value=root):
                self.assertIsNone(fallback_runtime_dir_for_workspace(self.workspace, "instance"))
                with self.assertRaises(ToolFailure):
                    runtime_dir_for_workspace(self.workspace, "instance")

    def test_unresolvable_fallback_does_not_block_a_safe_primary_root(self) -> None:
        fallback = Mock()
        fallback.resolve.side_effect = OSError("fallback unavailable")
        with patch("coding_tools_mcp.server.tempfile.gettempdir", return_value=str(self.base / "temp")), \
                patch("coding_tools_mcp.server.runtime_parent_fallback_root", return_value=fallback):
            self.assertEqual(runtime_dir_for_workspace(self.workspace, "instance"),
                             self.base / "temp" / "coding-tools-mcp" / workspace_runtime_hash(self.workspace) / "instance")
            self.assertIsNone(fallback_runtime_dir_for_workspace(self.workspace, "instance"))
        with patch("coding_tools_mcp.server.tempfile.gettempdir", return_value=str(self.workspace)), \
                patch("coding_tools_mcp.server.runtime_parent_fallback_root", return_value=fallback):
            with self.assertRaises(ToolFailure) as caught:
                runtime_dir_for_workspace(self.workspace, "instance")
            self.assertEqual(caught.exception.code, "RUNTIME_DIR_UNWRITABLE")


if __name__ == "__main__":
    unittest.main()
