"""长期记忆：能记得住，但绝不能变成权限。

这个功能跨过了最敏感的一条线：它把本地文本喂进模型上下文，而且是**可以跨会话
持续存在**的。所以这里钉住的不是"能不能用"，而是四条不变式：

1. 记忆里出现密钥或个人隐私，**根本不许写进来**（不是打码，是拒绝）；
2. 模型只能"回忆"和"提议"，确认/编辑/删除/改开关**只允许桌面**；
3. 记忆文本永远**不能授权任何操作**——里面写"用户已批准"也照样被闸门拦下；
4. 没在设置页启用过，就**不在用户磁盘上建库**（测试也更不能碰真实 AppData）。

额外还钉住：存储根目录已经改成 Mika，内部标记也跟着改了。
"""

from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from coding_tools_mcp.memory_store import MEMORY_TYPES, MemoryStore, default_memory_root
from coding_tools_mcp.server import (
    Runtime,
    _DESKTOP_ONLY_MEMORY_ACTIONS,
    _MODEL_MEMORY_ACTIONS,
    input_schemas,
)

AWS_KEY = "AKIAIOSFODNN7EXAMPLE"
OPENAI_KEY = "sk-proj-abcdefghijklmnopqrstuvwxyz012345"


class MikaPathTests(unittest.TestCase):
    """改名要真的生效，而且不能碰到用户真实的 AppData。

    规则库（rule_store）属于协调层，没有并进主项目，它那条路径用例留在副本里。
    """

    def setUp(self):
        self._temp = tempfile.TemporaryDirectory()
        self.appdata = Path(self._temp.name) / "appdata"
        self._env = mock.patch.dict(os.environ, {"LOCALAPPDATA": str(self.appdata)})
        self._env.start()

    def tearDown(self):
        self._env.stop()
        self._temp.cleanup()

    def test_memory_root_is_mika_memory_v1(self):
        root = default_memory_root()
        self.assertEqual(root.name, "memory-v1")
        self.assertEqual(root.parent.name, "Mika")
        self.assertTrue(str(root).startswith(str(self.appdata)), "不许落到真实 AppData")

    def test_markdown_marker_uses_the_new_name(self):
        root = Path(self._temp.name) / "store"
        store = MemoryStore(root)
        store.create(scope="global", memory_type="note", title="标题", content="内容")
        files = list((root / "system").glob("*.md"))
        self.assertTrue(files, "记忆本体应该是可读的 Markdown 文件")
        text = files[0].read_text(encoding="utf-8")
        self.assertIn("MIKA-MEMORY-META", text)
        self.assertNotIn("GPT-WEBCODEX-MEMORY-META", text)

    def test_new_store_defaults_to_suggest(self):
        """默认是"只建议"，不是"自动写入"——这是用户明确选的。"""
        store = MemoryStore(Path(self._temp.name) / "store2")
        self.assertEqual(store.config().get("auto_memory"), "suggest")


class MemoryToolTests(unittest.TestCase):
    def setUp(self):
        self._temp = tempfile.TemporaryDirectory()
        self.root = Path(self._temp.name) / "workspace"
        self.root.mkdir(parents=True, exist_ok=True)
        self.memory_root = Path(self._temp.name) / "memory"
        self._env = mock.patch.dict(os.environ, {
            "CODING_TOOLS_MCP_TOOL_MODE": "smart",
            "CODING_TOOLS_MCP_MEMORY_ROOT": str(self.memory_root),
            "LOCALAPPDATA": str(Path(self._temp.name) / "appdata"),
        })
        self._env.start()
        self.runtime = Runtime(self.root, permission_mode="dangerous")

    def tearDown(self):
        self.runtime.close()
        self._env.stop()
        self._temp.cleanup()

    # --- helpers ---------------------------------------------------------
    def call(self, name, args, *, origin="external"):
        with mock.patch.object(self.runtime, "_trace_origin", return_value=origin):
            payload = self.runtime.call_tool(name, args)
        return payload.get("structuredContent") or {}

    def code(self, name, args, *, origin="external"):
        return str((self.call(name, args, origin=origin).get("error") or {}).get("code") or "")

    def enable(self, mode="suggest", **extra):
        return self.call(
            "memory_control",
            {"action": "set_config", "enabled": True, "auto_memory": mode, **extra},
            origin="desktop",
        )

    def remember(self, **fields):
        payload = {"action": "create", "scope": "global", "memory_type": "note", "title": "标题", "content": "内容"}
        payload.update(fields)
        return self.call("memory_control", payload, origin="desktop")

    # --- 不变式 4：没启用就不存在 -----------------------------------------
    def test_feature_stays_absent_until_the_desktop_enables_it(self):
        payload = self.call("memory_control", {"action": "list"})
        self.assertFalse(payload.get("enabled"))
        self.assertFalse(self.memory_root.exists(), "没启用就不该在磁盘上建库")

    def test_model_cannot_enable_the_feature_itself(self):
        self.assertEqual(self.code("memory_control", {"action": "enable"}), "MEMORY_DESKTOP_ONLY")
        self.assertEqual(self.code("memory_control", {"action": "set_config", "enabled": True}), "MEMORY_DESKTOP_ONLY")
        self.assertFalse(self.memory_root.exists(), "被拒绝的调用不能顺手把功能打开")

    def test_proposal_without_enabling_records_nothing(self):
        payload = self.call("memory_control", {"action": "propose", "title": "偏好", "content": "用中文回答"})
        self.assertEqual(payload.get("status"), "disabled")
        self.assertFalse(self.memory_root.exists())

    # --- 不变式 2：只有桌面能写 -------------------------------------------
    def test_every_declared_action_is_classified(self):
        """声明了却没分类的动作会被"未知动作"拒绝，等于发了个死接口。"""
        enum = input_schemas()["memory_control"]["properties"]["action"]["enum"]
        self.assertEqual(set(enum), set(_MODEL_MEMORY_ACTIONS) | set(_DESKTOP_ONLY_MEMORY_ACTIONS))

    def test_model_channel_cannot_touch_desktop_only_actions(self):
        for action in sorted(_DESKTOP_ONLY_MEMORY_ACTIONS):
            self.assertEqual(self.code("memory_control", {"action": action}), "MEMORY_DESKTOP_ONLY", action)

    def test_desktop_can_run_desktop_only_actions(self):
        """正向对照：同一个动作在桌面上必须真的能用，否则上面那条就是空过。"""
        self.enable()
        payload = self.call("memory_control", {"action": "candidates"}, origin="desktop")
        self.assertTrue(payload.get("ok"), payload)
        self.assertIn("candidates", payload)

    def test_model_can_still_read(self):
        self.enable()
        self.remember(title="回答语言", content="用简体中文回答")
        for action in ("list", "search", "bootstrap", "config"):
            args = {"action": action}
            if action == "search":
                args["query"] = "中文"
            payload = self.call("memory_control", args)
            self.assertTrue(payload.get("ok"), action)
            self.assertTrue(payload.get("enabled"), action)

    def test_desktop_enables_and_configures(self):
        payload = self.enable(mode="suggest")
        config = payload["config"]
        self.assertTrue(config["enabled"])
        self.assertEqual(config["auto_memory"], "suggest")
        self.assertTrue((self.memory_root / "config.json").is_file())
        self.assertEqual(config["scopes"], ["global", "project", "task"])
        self.assertEqual(set(config["types"]), set(MEMORY_TYPES), "schema 枚举不许和模块常量漂移")

    def test_switches_survive_each_other(self):
        """模式开关不能把"已启用"和"允许个人信息"抹掉。"""
        self.enable(mode="suggest", allow_sensitive_personal=True)
        payload = self.call("memory_control", {"action": "set_config", "auto_memory": "auto"}, origin="desktop")
        config = payload["config"]
        self.assertTrue(config["enabled"])
        self.assertTrue(config["allow_sensitive_personal"])
        self.assertEqual(config["auto_memory"], "auto")

    # --- 只建议 / 自动 / 关闭 ---------------------------------------------
    def test_suggestion_waits_for_the_user(self):
        self.enable(mode="suggest")
        proposal = self.call("memory_control", {
            "action": "propose", "scope": "global", "memory_type": "core_preference",
            "title": "回答语言", "content": "用户希望用简体中文回答。",
        })
        self.assertEqual(proposal.get("status"), "pending")
        self.assertTrue(proposal.get("requires_user_confirmation"))
        self.assertTrue(str(proposal.get("candidate_id") or "").startswith("cand_"))
        self.assertEqual(self.call("memory_control", {"action": "list"}).get("count"), 0, "建议阶段不该已经存下来")

        queue = self.call("memory_control", {"action": "candidates"}, origin="desktop")
        self.assertEqual(queue.get("count"), 1)
        confirmed = self.call(
            "memory_control", {"action": "confirm", "candidate_id": proposal["candidate_id"]}, origin="desktop"
        )
        self.assertTrue(confirmed.get("memory"))
        self.assertEqual(self.call("memory_control", {"action": "list"}).get("count"), 1)

    def test_auto_mode_remembers_immediately(self):
        self.enable(mode="auto")
        proposal = self.call("memory_control", {
            "action": "propose", "scope": "global", "memory_type": "note", "title": "随手记", "content": "记住这个。",
        })
        self.assertFalse(proposal.get("requires_user_confirmation"))
        self.assertEqual(self.call("memory_control", {"action": "list"}).get("count"), 1)

    def test_off_mode_records_nothing(self):
        self.enable(mode="off")
        proposal = self.call("memory_control", {"action": "propose", "title": "偏好", "content": "用中文"})
        self.assertEqual(proposal.get("status"), "disabled")
        self.assertEqual(self.call("memory_control", {"action": "list"}).get("count"), 0)

    def test_rejection_keeps_it_out_of_memory(self):
        self.enable(mode="suggest")
        proposal = self.call("memory_control", {"action": "propose", "title": "一次性", "content": "别记这个"})
        rejected = self.call(
            "memory_control", {"action": "reject", "candidate_id": proposal["candidate_id"]}, origin="desktop"
        )
        self.assertTrue(rejected.get("ok"))
        self.assertEqual(self.call("memory_control", {"action": "list"}).get("count"), 0)
        self.assertEqual(self.call("memory_control", {"action": "candidates"}, origin="desktop").get("count"), 0)

    # --- 不变式 1：密钥与隐私根本不许进来 ---------------------------------
    def test_secrets_are_refused_not_masked(self):
        self.enable(mode="auto")
        code = self.code("memory_control", {
            "action": "propose", "title": "部署", "content": f"服务器密钥 {OPENAI_KEY}",
        })
        self.assertEqual(code, "SECRET_REJECTED")
        self.assertEqual(self.call("memory_control", {"action": "list"}).get("count"), 0)

    def test_desktop_writes_are_checked_too(self):
        self.enable()
        code = self.code("memory_control", {
            "action": "create", "scope": "global", "title": "密钥", "content": f"API_KEY={AWS_KEY}",
        }, origin="desktop")
        self.assertEqual(code, "MEMORY_UNSAFE")

    def test_personal_details_need_the_privacy_switch(self):
        self.enable()
        args = {"action": "create", "scope": "global", "title": "健康", "content": "我的病史：骨折。"}
        self.assertEqual(self.code("memory_control", args, origin="desktop"), "MEMORY_UNSAFE")
        self.enable(allow_sensitive_personal=True)
        self.assertTrue(self.call("memory_control", args, origin="desktop").get("ok"))
        self.assertEqual(self.call("memory_control", {"action": "list"}).get("count"), 1)

    # --- 检索与生命周期 ---------------------------------------------------
    def test_search_finds_a_stored_memory(self):
        self.enable()
        self.remember(title="构建命令", content="本项目用 npm run dist 出安装包。")
        payload = self.call("memory_control", {"action": "search", "query": "安装包"})
        self.assertEqual(payload.get("count"), 1)
        self.assertEqual(payload["memories"][0]["title"], "构建命令")

    def test_list_filters_by_scope(self):
        self.enable()
        self.remember(scope="global", title="全局偏好")
        self.remember(scope="project", title="项目约定")
        self.assertEqual(self.call("memory_control", {"action": "list", "scope": "global"}).get("count"), 1)
        project = self.call("memory_control", {"action": "list", "scope": "project"})
        self.assertEqual(project.get("count"), 1)
        self.assertEqual(project["memories"][0]["title"], "项目约定")
        self.assertEqual(self.call("memory_control", {"action": "list"}).get("count"), 2)

    def test_archive_then_delete(self):
        self.enable()
        memory_id = self.remember(title="临时")["memory"]["memory_id"]
        self.call("memory_control", {"action": "archive", "memory_id": memory_id}, origin="desktop")
        self.assertEqual(self.call("memory_control", {"action": "list"}).get("count"), 0)
        archived = self.call("memory_control", {"action": "list", "archived": True})
        self.assertEqual(archived.get("count"), 1)
        deleted = self.call("memory_control", {"action": "delete", "memory_id": memory_id}, origin="desktop")
        self.assertTrue(deleted.get("deleted"))
        self.assertEqual(self.code("memory_control", {"action": "get", "memory_id": memory_id}), "MEMORY_NOT_FOUND")

    def test_revision_history_and_restore(self):
        self.enable()
        memory_id = self.remember(title="版本", content="第一版")["memory"]["memory_id"]
        self.call("memory_control", {"action": "update", "memory_id": memory_id, "content": "第二版"}, origin="desktop")
        revisions = self.call("memory_control", {"action": "revision_history", "memory_id": memory_id}, origin="desktop")
        self.assertTrue(revisions.get("revisions"))
        restored = self.call(
            "memory_control", {"action": "restore_revision", "memory_id": memory_id, "revision": 1}, origin="desktop"
        )
        self.assertEqual(restored["memory"]["content"], "第一版")

    def test_export_and_import_round_trip(self):
        self.enable()
        self.remember(title="导出项", content="这条要被导出。")
        target = Path(self._temp.name) / "backup.zip"
        exported = self.call("memory_control", {"action": "export", "path": str(target)}, origin="desktop")
        self.assertTrue(exported.get("ok"), exported)
        self.assertTrue(target.is_file(), "导出必须真的写出文件")
        self.assertGreater(target.stat().st_size, 0)

        other = Path(self._temp.name) / "memory-b"
        with mock.patch.dict(os.environ, {"CODING_TOOLS_MCP_MEMORY_ROOT": str(other)}):
            runtime_b = Runtime(self.root, permission_mode="dangerous")
            try:
                with mock.patch.object(runtime_b, "_trace_origin", return_value="desktop"):
                    imported = runtime_b.call_tool("memory_control", {"action": "import", "path": str(target)})
                    listing = runtime_b.call_tool("memory_control", {"action": "list"})
                self.assertTrue((imported.get("structuredContent") or {}).get("ok"), imported)
                titles = [item.get("title") for item in (listing.get("structuredContent") or {}).get("memories", [])]
                self.assertIn("导出项", titles)
            finally:
                runtime_b.close()

    # --- 注入：模型"记得住" -----------------------------------------------
    def test_bootstrap_is_bounded_and_labelled(self):
        self.enable()
        for index in range(12):
            self.remember(
                scope="global", memory_type="core_preference",
                title=f"偏好 {index}", content=f"第 {index} 条偏好内容。" + "填充" * 200,
            )
        payload = self.call("memory_control", {"action": "bootstrap"})
        self.assertLessEqual(len(payload["items"]), 8, "注入条数必须有上限")
        self.assertLessEqual(int(payload["content_bytes"]), 4096, "注入体积必须有上限")
        self.assertTrue(payload["truncated"])
        self.assertEqual(payload["instruction_scope"], "local_memory_context")

    def test_workspace_context_carries_memory_only_when_enabled(self):
        before = self.call("workspace_context", {})
        self.assertNotIn("memory", before)
        self.assertFalse(self.memory_root.exists(), "只看一眼工作区不该建库")

        self.enable()
        self.remember(scope="global", memory_type="core_preference", title="回答语言", content="用简体中文回答。")
        after = self.call("workspace_context", {})
        self.assertIn("memory", after)
        self.assertTrue(after["memory"]["enabled"])
        self.assertEqual(after["memory"]["mode"], "suggest", "注入的模式要是真实配置，不是模块里写死的 off")
        self.assertEqual(after["memory"]["instruction_scope"], "local_memory_context")
        self.assertEqual(after["memory"]["items"][0]["title"], "回答语言")

    def test_memory_content_is_redacted_at_the_model_boundary(self):
        """有人手改 Markdown 绕过检查时，出口打码是最后一道防线。"""
        self.enable()
        MemoryStore(self.memory_root).create(
            scope="global", memory_type="core_preference",
            title="服务器", content=f"数据库口令 DB_PASSWORD={AWS_KEY}",
        )
        model_block = self.call("memory_control", {"action": "bootstrap"})
        self.assertNotIn(AWS_KEY, json.dumps(model_block, ensure_ascii=False))
        desktop_block = self.call("memory_control", {"action": "bootstrap"}, origin="desktop")
        self.assertIn(AWS_KEY, json.dumps(desktop_block, ensure_ascii=False))

    # --- 不变式 3：记忆永远不是权限 ---------------------------------------
    # 这条不变式的执行者是协调层：记忆文字不进 approved_scope，写操作照样要过
    # 阶段闸门。协调层没有并进主项目，所以主项目现在只有提示词层面的约束
    # （注入块带 instruction_scope，见上面的 bootstrap 用例）；
    # 带 PHASE_DENIED 的闸门用例留在副本里，协调层合并时一起回来。
    def test_archived_memory_can_come_back(self):
        """归档是"收起来"而不是删除：桌面端必须能取消归档。"""
        self.enable()
        memory_id = self.remember(title="会归档", content="内容")["memory"]["memory_id"]
        archived = self.call("memory_control", {"action": "archive", "memory_id": memory_id}, origin="desktop")
        self.assertTrue(archived.get("ok"))
        active = self.call("memory_control", {"action": "list"}, origin="desktop")
        self.assertNotIn(memory_id, [item["memory_id"] for item in active.get("memories", [])])
        inbox = self.call("memory_control", {"action": "list", "archived": True}, origin="desktop")
        self.assertIn(memory_id, [item["memory_id"] for item in inbox.get("memories", [])])
        restored = self.call(
            "memory_control",
            {"action": "update", "memory_id": memory_id, "archived": False},
            origin="desktop",
        )
        self.assertFalse(bool(restored["memory"]["archived"]))
        self.assertEqual(restored["memory"]["content"], "内容", "只改归档状态，不能把内容清掉")
        archived_path = self.memory_root / archived["memory"]["file_path"]
        restored_path = self.memory_root / restored["memory"]["file_path"]
        self.assertNotEqual(archived_path, restored_path, "归档与活动目录是两处")
        self.assertTrue(restored_path.exists(), "取消归档后 Markdown 要回到活动目录")
        self.assertFalse(archived_path.exists(), "归档目录里不该再留着旧文件")
        back = self.call("memory_control", {"action": "list"}, origin="desktop")
        self.assertIn(memory_id, [item["memory_id"] for item in back.get("memories", [])])

    def test_hand_edited_memory_survives_and_stays_readable(self):
        """用户手改 Markdown 是允许的：改了之后索引要能重建。"""
        self.enable()
        memory_id = self.remember(title="手改", content="原始内容")["memory"]["memory_id"]
        files = list(self.memory_root.rglob(f"{memory_id}.md"))
        self.assertEqual(len(files), 1)
        text = files[0].read_text(encoding="utf-8")
        self.assertIn("原始内容", text)
        self.assertIn("MIKA-MEMORY-META", text)
        rebuilt = self.call("memory_control", {"action": "rebuild_index"}, origin="desktop")
        self.assertTrue(rebuilt.get("ok"))


if __name__ == "__main__":
    unittest.main()