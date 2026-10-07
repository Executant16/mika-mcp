# Electron 安全审计（2026-07-29）

## 运行时结论

- Electron 已由 31 升级到 43.2.0。
- `nodeIntegration` 在本地管理页、浏览器壳和 ChatGPT 视图中均关闭。
- 所有渲染进程均启用 `contextIsolation` 与 `sandbox`。
- ChatGPT 远程页面没有 preload，也不能调用助手 IPC。
- 主进程 IPC 统一验证调用来源必须为本地 `file://` 页面。
- 禁止挂载 `<webview>`，默认 Session 拒绝权限请求。
- ChatGPT 独立 Session 只允许受信任 HTTPS 域的剪贴板安全写入。
- ChatGPT 导航和登录弹窗使用域名白名单；未知外链交给系统浏览器。
- 管理页和浏览器壳均设置严格 CSP，不允许内联脚本。
- Runtime Key 与 MCP Token 不进入渲染进程明文和普通日志。

## 依赖审计

- `npm audit --omit=dev`：0 个生产依赖漏洞。
- 完整 `npm audit`：16 个 high，均位于 electron-builder 的构建期依赖链，不会被打入应用运行时代码。
- npm 当前建议的自动修复会错误回退到更旧的 electron-builder 主版本，因此本次没有使用 `--force`。在上游发布兼容修复后应再次升级构建链。

## 剩余注意事项

- 未进行代码签名的 Windows 安装包仍可能触发 SmartScreen；这与应用运行时安全加固是两件事。
- “完整工具模式”权限最高，默认仍保持“编码模式”。
- 构建验证页只在用户明确点击后执行当前工作区内的本地命令，产物路径禁止越出工作区，符号链接不会被扫描。
