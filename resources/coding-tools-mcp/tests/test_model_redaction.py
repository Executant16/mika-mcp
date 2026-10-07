"""模型边界的密钥打码。

工具输出、代码差异和文件内容本来会原样发给 ChatGPT。这里钉住两件事：
1. 密钥、令牌、私钥、带口令的连接串**必须**被打码；
2. 普通源码**绝不能**被误伤——模型拿着坏掉的代码干活，比漏掉一个密钥更糟。

同时验证信任边界：桌面是用户自己的通道，它看到的仍是原文。
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from coding_tools_mcp.server import (
    Runtime,
    model_payload_has_secrets,
    redact_model_payload,
    redact_model_text,
)

AWS_KEY = "AKIAIOSFODNN7EXAMPLE"
OPENAI_KEY = "sk-proj-abcdefghijklmnopqrstuvwxyz012345"
GITHUB_TOKEN = "ghp_abcdefghijklmnopqrstuvwxyz0123456789"
SLACK_TOKEN = "xoxb-" + "123456789012-abcdefghijklmnop"  # 测试用假令牌；拆开写以避开 GitHub 密钥扫描误报（运行时仍拼成完整 xoxb- 令牌来验证打码）
GOOGLE_KEY = "AIzaSyA1234567890abcdefghijklmnopqrstuv"
JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk"
PRIVATE_KEY = (
    "-----BEGIN RSA PRIVATE KEY-----\n"
    "MIIEowIBAAKCAQEA1234567890abcdefghijklmnop\n"
    "-----END RSA PRIVATE KEY-----"
)


class RedactTextTests(unittest.TestCase):
    def test_credentials_are_replaced(self):
        cases = {
            AWS_KEY: AWS_KEY,
            OPENAI_KEY: OPENAI_KEY,
            GITHUB_TOKEN: GITHUB_TOKEN,
            SLACK_TOKEN: SLACK_TOKEN,
            GOOGLE_KEY: GOOGLE_KEY,
            JWT: JWT,
            "DATABASE_URL=postgres://admin:s3cr3tpass@db.internal:5432/app": "s3cr3tpass",
            "Authorization: Bearer abcdef1234567890": "abcdef1234567890",
            PRIVATE_KEY: "MIIEowIBAAKCAQEA1234567890abcdefghijklmnop",
            'password="hunter2hunter2hunter2"': "hunter2hunter2hunter2",
            "API_KEY=9f8a7b6c5d4e3f2a1b0c": "9f8a7b6c5d4e3f2a1b0c",
        }
        for text, secret in cases.items():
            redacted = redact_model_text(text)
            self.assertNotIn(secret, redacted, f"没打码: {text}")
            self.assertIn("redacted", redacted, f"没有占位符: {text}")

    def test_ordinary_code_is_never_touched(self):
        """误伤源码是最坏的失败方式：模型会照着一份被改坏的代码干活。"""
        for text in (
            "const token = getToken();",
            "apiKey = config.apiKey",
            "self.api_key = settings.API_KEY",
            "if (!token) return null;",
            "password_field = 'password'",
            'secret = ""',
            "SELECT password, token FROM users WHERE id = 1",
            "def api_key_name(): ...",
            "token_count = 5",
            "sk-short",
            "# 读取密码后立即清空",
        ):
            self.assertEqual(redact_model_text(text), text, text)

    def test_a_single_jwt_segment_is_not_a_token(self):
        self.assertEqual(redact_model_text("eyJhbGciOiJIUzI1NiJ9"), "eyJhbGciOiJIUzI1NiJ9")

    def test_placeholders_do_not_match_again(self):
        once = redact_model_text(f"API_KEY={AWS_KEY}")
        self.assertEqual(redact_model_text(once), once)

    def test_payload_walk_keeps_structure(self):
        payload = {
            "output": f"API_KEY={AWS_KEY}",
            "nested": [{"diff": GITHUB_TOKEN}],
            "count": 3,
            "ok": True,
        }
        redacted = redact_model_payload(payload)
        self.assertEqual(redacted["count"], 3)
        self.assertIs(redacted["ok"], True)
        self.assertNotIn(AWS_KEY, redacted["output"])
        self.assertNotIn(GITHUB_TOKEN, redacted["nested"][0]["diff"])
        self.assertIn(AWS_KEY, str(payload), "打码必须是复制，不能改动原负载")


class ModelBoundaryTests(unittest.TestCase):
    """走真实工具入口，而不是只测那个函数。"""

    def setUp(self):
        self._temp = tempfile.TemporaryDirectory()
        self.root = Path(self._temp.name)
        (self.root / "config.env").write_text(f"API_KEY={AWS_KEY}\n", encoding="utf-8")
        self._env = mock.patch.dict(os.environ, {"CODING_TOOLS_MCP_TOOL_MODE": "smart"})
        self._env.start()
        self.runtime = Runtime(self.root, permission_mode="dangerous")

    def tearDown(self):
        self.runtime.close()
        self._env.stop()
        self._temp.cleanup()

    @staticmethod
    def model_text(payload):
        """模型真正读到的那段文本。"""
        return "\n".join(
            str(block.get("text") or "")
            for block in payload.get("content", [])
            if isinstance(block, dict)
        )

    @staticmethod
    def structured(payload):
        return payload.get("structuredContent") or {}

    def desktop_call(self, name, args):
        with mock.patch.object(self.runtime, "_trace_origin", return_value="desktop"):
            return self.runtime.call_tool(name, args)

    def assert_hidden_from_model(self, payload, secret):
        self.assertNotIn(secret, self.model_text(payload), "模型文本里仍有密钥")
        self.assertNotIn(secret, str(self.structured(payload)), "structuredContent 里仍有密钥")

    def test_read_file_is_redacted_for_the_model(self):
        result = self.runtime.call_tool("read_file", {"path": "config.env"})
        self.assert_hidden_from_model(result, AWS_KEY)
        self.assertIn("redacted", str(self.structured(result)))

    def test_desktop_still_sees_the_real_value(self):
        """正向对照：同一次调用在桌面上必须看得到原文，否则就是把人自己的数据藏了。"""
        result = self.desktop_call("read_file", {"path": "config.env"})
        self.assertIn(AWS_KEY, str(self.structured(result)))
        self.assertIn(AWS_KEY, self.model_text(result))

    def visible_texts(self, payload):
        """模型能看到的两处：渲染过的文本，和结构化负载。"""
        return [self.model_text(payload), str(self.structured(payload))]

    def test_command_output_is_redacted_for_the_model(self):
        command = f"echo API_KEY={AWS_KEY}"
        # 对照：桌面通道必须真的拿到这段输出，否则下面就是空过。
        control = self.desktop_call("exec_command", {"cmd": command, "yield_time_ms": 3000})
        self.assertTrue(
            any(AWS_KEY in text for text in self.visible_texts(control)),
            "对照组没拿到命令输出，这个测试没有意义",
        )

        result = self.runtime.call_tool("exec_command", {"cmd": command, "yield_time_ms": 3000})
        self.assert_hidden_from_model(result, AWS_KEY)
        # 命令是会话式的：剩下的输出可能在后续的一次 read_output 里。
        output_ref = self.structured(result).get("output_ref")
        if output_ref:
            follow = self.runtime.call_tool("read_output", {"output_ref": output_ref})
            self.assert_hidden_from_model(follow, AWS_KEY)

    def test_git_diff_is_redacted_for_the_model(self):
        git = shutil.which("git")
        if not git:
            self.skipTest("需要 git")
        for args in (
            ["init", "-q"],
            ["config", "user.email", "redact@example.com"],
            ["config", "user.name", "redact"],
            ["add", "-A"],
        ):
            subprocess.run([git, "-C", str(self.root), *args], check=True, capture_output=True)
        subprocess.run([git, "-C", str(self.root), "commit", "-qm", "base"], check=True, capture_output=True)
        (self.root / "config.env").write_text(f"API_KEY={AWS_KEY}\nSECOND=1\n", encoding="utf-8")

        control = self.desktop_call("git_diff", {})
        self.assertIn(AWS_KEY, self.model_text(control) + str(self.structured(control)))

        result = self.runtime.call_tool("git_diff", {})
        self.assert_hidden_from_model(result, AWS_KEY)

    def test_full_detail_is_not_an_exemption(self):
        """模型自己就能要求 full，所以 full 只能是更多上下文，不能是更多密钥。"""
        payload = {"prepared": {"files": [{"path": "config.env", "content": f"API_KEY={AWS_KEY}"}]}}
        projected = self.runtime._project_model_payload(
            "agent_workflow", {"response_detail": "full"}, payload
        )
        self.assertNotIn(AWS_KEY, str(projected))

    def test_clean_payload_keeps_its_identity(self):
        """没有密钥时零拷贝：原有投影契约要求返回同一个对象。"""
        payload = {"output": "const token = getToken();", "ok": True}
        self.assertIs(self.runtime._model_visible_payload(payload), payload)

    def test_error_details_are_redacted_too(self):
        """报错信息同样会带上密钥，这条路也要盖住。"""
        payload = {"ok": False, "error": {"code": "EXEC_FAILED", "message": f"failed: API_KEY={AWS_KEY}"}}
        visible = self.runtime._model_visible_payload(payload)
        self.assertNotIn(AWS_KEY, str(visible))


if __name__ == "__main__":
    unittest.main()