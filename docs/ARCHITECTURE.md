# Mika MCP 架构

本文说明当前 Windows 桌面助手的实现。桌面使用便携 Python 承载 Coding Tools MCP，并通过 OpenAI Tunnel 接入 ChatGPT；当前连接配置统一为 `official`，没有 Docker 服务或容器运行模式。

## 进程与调用关系

```text
管理界面、浏览器外壳（renderer/）
  ↕ preload 暴露的固定 IPC
Electron 主进程（electron/main.js）
  ├─ ChatViewController → ChatGPT WebContentsView
  ├─ RuntimeOrchestrator
  │   ├─ NativeService → Python Coding Tools MCP
  │   └─ TunnelService → tunnel-client.exe
  ├─ LocalMcpClient → 本地 MCP 健康检查、发现、工具调用和事件流
  └─ 配置、密钥、日志、通知等服务
```

`ChatViewController` 管理嵌入的 ChatGPT 页面、导航和加载恢复。ChatGPT 页面使用持久会话分区 `persist:chatgpt-session`，与本地管理界面分开；页面不加载管理界面的 preload。网页工具调用通过 ChatGPT 的 MCP 连接与 Tunnel 到达本地 Runtime，不靠页面直接访问 Node 或执行本地命令。

本地管理窗口和 ChatGPT 视图启用 `contextIsolation`、关闭 `nodeIntegration`，并设置 `sandbox: true`。管理界面通过 `preload.js` 等预加载脚本调用主进程的固定接口；主进程用 `secureHandle` 注册处理器，目前来源检查要求调用页面 URL 以 `file://` 开头。该检查不是对每个本地文件的精确白名单。

## Python Runtime 与 Tunnel

`NativeService` 以 `-m coding_tools_mcp` 启动内置源码，传入所选工作区、权限模式和 MCP 端口。工具模式固定为 `smart`，桌面启动时关闭 Runtime 遥测。MCP 监听 `127.0.0.1`，默认地址为 `http://127.0.0.1:18765/mcp`。

发行包内置 Python 3.12；检测顺序为内置解释器、Windows Python Launcher、系统 Python，要求 Python 3.11+。存在对应的无控制台入口时，后台启动优先使用 `pythonw.exe` 或 `pyw.exe`。正式包可以独立运行；内置解释器缺失或不可用时，代码仍保留系统解释器回退。

随包分发的 Runtime 主源码位于 `resources/coding-tools-mcp/coding_tools_mcp/`；离线依赖放在同级 `python_vendor/`。便携解释器的 `._pth` 直接加载这两个目录，主进程启动环境也设置对应 `PYTHONPATH`。准备脚本会移除旧构建复制到 `site-packages` 的第二份 Runtime，不向系统 Python 安装依赖。

`TunnelService` 启动 `resources/tools/tunnel-client.exe`，连接 OpenAI Tunnel，并把请求转发到上述本地 MCP 地址。它的本地健康与控制台端口默认是 `127.0.0.1:18081`，控制台入口为 `/ui`。这两个端口均可配置，但不能相同。Tunnel 启动就绪检查使用本地端口连通性，不等同于已经验证远端 ChatGPT 的完整调用链。

## 启动与故障恢复

`RuntimeOrchestrator.start()` 的顺序是：

1. 校验工作区、端口、Runtime API Key 和 Tunnel ID，取得或生成 MCP Token。
2. 检查解释器、Tunnel 文件和网络代理；不可用的手动代理会阻止启动。
3. 停止已记录的旧服务，等待 MCP 与 Tunnel 端口释放；未知进程占用端口时报告错误。
4. 启动 Python MCP，读取带 Bearer 认证的 `/__control/health`，核对工作区、PID、launch ID 和源码指纹。
5. 调用 `server/discover`，确认其 Runtime 实例、PID、源码指纹及 Schema version/hash 与健康端点一致。
6. 启动 Tunnel，等待其本地健康端口可连接，再发布完成状态。

启动失败会尝试停止本次服务、记录错误并阻止自动反复部署。页面加载恢复由 `ChatViewController` 负责；服务心跳由编排器检查。自动恢复时，MCP 健康而 Tunnel 异常只重启 Tunnel；MCP 异常才走完整服务重启。手动停止的服务不会因此自动重启。

MCP 健康运行时，工作区切换通过 `/__control/workspace` 热切换并重新检查工作区；服务未运行时，只保存设置，供下次启动使用。任务状态和后台操作记录保存在磁盘，Runtime 重启后可以重新读取；正在执行的命令不会在新进程中自动接续，遗留后台操作会标记中断，后续按任务状态继续或重试。

## 数据目录与清理责任

`<userData>` 指 Electron 的 `app.getPath('userData')`，不是源码仓库目录。

源码开发版在初始化数据服务之前，将 userData/sessionData 统一设为 `<源码仓库父目录>/Mika-Data/development/<仓库路径哈希>/profile`，并指定该目录下的长期记忆根、temp 和 crashDumps；进程 TEMP/TMP/TMPDIR 同步到 profile/tmp。可用绝对路径 `MIKA_DEVELOPMENT_DATA_ROOT` 覆盖 development 基目录，Windows 下拒绝 C 盘且不回退。正式版通过 productionStorageService 读取固定 appData 定位配置，先锁定默认正式身份，再执行已确认的冷迁移；未选择目录时沿用原位置。设置 IPC 负责计划确认、停服务、刷新 Session 并排队重启；下一启动复制校验后才提交新根，失败保持旧根和诊断现场。测试统一归位等剩余约束见 [数据目录规范与迁移方案（部分实现）](data-directory-policy.md)，用户流程见 [自定义正式数据目录](storage-settings.md)。

| 位置 | 内容与职责 |
| --- | --- |
| `<userData>/` | 桌面配置、技能、提示词、加密密钥、服务 PID 与指纹、通知检查点，以及持久浏览器会话；由桌面主进程和 Electron 管理。 |
| `<userData>/logs/` | `assistant.log`、`mcp.log`、`tunnel.log`；助手日志与服务启动路径执行日志轮换。 |
| `<userData>/runtime-workspace/<工作区哈希>/<实例 ID>/` | Runtime 的 `home/`、`tmp/`、`cache/`，供命令执行使用；由 Python Runtime 管理。 |
| `<workspace>/.coding-tools/` | 任务状态、历史、事件、后台操作、性能记录，以及 `worktrees/` 和 `worktrees.json`；是持久任务数据，不作为普通临时目录清理。 |
| `%LOCALAPPDATA%/Mika/memory-v1/` | 长期记忆库的默认位置，由 MemoryStore 管理；独立 Runtime 可通过 `CODING_TOOLS_MCP_MEMORY_ROOT` 指定其他目录。 |

桌面明确设置 `CODING_TOOLS_MCP_RUNTIME_ROOT` 为 `<userData>/runtime-workspace`，覆盖继承的同名环境变量，并将路径纳入复用指纹。Python 会拒绝显式运行时根目录落入当前工作区；默认临时目录回退进工作区或当前启动目录、且没有安全备用路径时，返回 `RUNTIME_DIR_UNWRITABLE`。

新实例用 `.runtime-owner.json` 记录归属。Python 正常关闭或热切换时，在命令及后台操作已结束且归属匹配的前提下，将旧目录同盘移入 `runtime-workspace/retired/`，不递归删除内容；忙碌或失败时保留并输出日志。桌面强制停止后确认旧 PID 退出，通过持久化 `nativeCleanupPending` 请求和独立 console Python 完成同样的归档，失败请求留待下次重试。移动前写入 `retirement.json` 恢复记录，只移除已空的哈希父目录，不自动清空归档、不处理无标记历史目录。历史清理仍由维护步骤负责。详见 [运行时目录说明](runtime-storage.md) 与 [本机维护记录](runtime-maintenance-2026-10-14.md)。

## 认证与安全边界

Runtime API Key 用于 Tunnel 连接控制面；MCP Bearer Token 用于访问本地 MCP。Token 由 `crypto.randomBytes(32)` 生成，两者由 `SecretStore` 使用 Electron `safeStorage` 在 Windows 上加密落盘到 `secrets.bin`，加密能力不可用时拒绝保存。Tunnel 的控制面 API Key 和 MCP Bearer 值通过环境变量传递，相关命令行参数用 `env:` 引用；Tunnel ID 仍直接作为命令行参数传入。

用户输入的 Runtime API Key 会由渲染层提交主进程；保存后的 API Key 与 MCP Token 没有读取明文的渲染层接口，快照返回是否存在的状态。Tunnel ID 仍会出现在设置快照中，不应将所有连接信息都描述为对渲染层不可见。

`LogService` 仅按顶层元数据字段名匹配 `key/token/authorization/secret` 并替换为 `[已隐藏]`；这不覆盖任意消息文本、嵌套对象或子进程原始日志。代理 URL 的配置校验拒绝嵌入用户名和密码。

MCP 文件工具检查工作区与额外授权目录，命令执行受权限模式和 Windows 用户权限约束。这些检查不是 Docker、虚拟机或 Linux Landlock 级别的系统隔离。Git Worktree 用于隔离代码改动和检查回写冲突，也不是进程沙箱；它不替代备份。Windows DACL 和完整性标签还会影响解释器实际可写的位置，目录选择正确不代表权限一定可用。

## 版本与协议身份

以下是当前源码中的三个独立编号：

| 编号 | 当前值 | 来源与用途 |
| --- | --- | --- |
| 桌面源码版本 | `0.1.5`（待发布） | 根 `package.json` 与锁文件；Electron 应用版本、界面展示和安装包命名使用这一版本，源码版本不等于 GitHub 已发布版本。 |
| MCP Runtime 发行版本 | `0.4.9` | `coding_tools_mcp/__init__.py` 与 Runtime 的 `pyproject.toml`；表示内置 Python 服务版本。 |
| 工具 Schema version | `8` | `server.py` 中的 `TOOL_SCHEMA_VERSION`；由 `scripts/check-schema-contract.py` 生成、校验 `schema-contract.json` 中的版本、hash 和工具数量。 |

源码指纹、PID、launch ID 和 Runtime instance ID 用于辨认实际加载的代码及进程实例，不是发行版本号。公共工具契约变更须按 `AGENTS.md` 同步 Schema；普通修复不自动升级桌面或 Runtime 发行版本。旧发布记录中的版本号也不作为当前架构的依据。

## 维护入口与许可

进程与服务实现位于 `electron/main.js`、`electron/chatViewController.js`、`electron/services/runtimeOrchestrator.js`、`nativeService.js`、`tunnelService.js` 和 `localMcpClient.js`；目录来源见 `electron/paths.js`。Runtime 路径、任务恢复与 HTTP 控制接口位于 `resources/coding-tools-mcp/coding_tools_mcp/`。

行为修改按 `AGENTS.md` 验证，常规测试入口为 `npm test`，构建前另须满足 Schema 契约和项目要求。仅更新架构文档时，核对源码、文档链接和差异即可。版本发布步骤见 [自动发布说明](releasing.md)。

桌面项目使用 MIT License；内置 Coding Tools MCP 使用 Apache License 2.0。安装包保留源码、LICENSE、NOTICE 及 [第三方来源说明](../THIRD_PARTY_NOTICES.md)。
