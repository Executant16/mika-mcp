# 数据目录规范与迁移方案（部分实现）

本文件最初记录 2026-10-14 的源码核查及建议方案。已落实开发版独立目录和正式版设置入口、复制校验及冷启动切换。正式版未选择自定义位置时仍沿用原路径；本次没有迁移真实数据。当前功能、备份及失败恢复见 [自定义正式数据目录](storage-settings.md)。下文历史核查表与建议不能全部当作当前行为，测试统一归位等未完成项仍保留。

## 已落实的有限范围

`electron/services/dataDirectoryService.js` 在主进程导入数据服务前运行。源码开发版将 userData 和 sessionData 设为 `<源码仓库父目录>/Mika-Data/development/<规范化仓库路径SHA256前16位>/profile`，为子进程显式设置该 profile 下的 `memory-v1`。本仓库默认路径为 `D:/Lenovo/Documents/Mika-Data/development/437fb56ff9078a26/profile`。可用绝对路径环境变量 `MIKA_DEVELOPMENT_DATA_ROOT` 覆盖 development 基目录，仍追加仓库 ID/profile；不使用 LOCALAPPDATA/home 回退，Windows 下拒绝 C 盘。开发 temp、进程 TEMP/TMP/TMPDIR 指向 profile/tmp，crashDumps 指向 profile/crash-dumps；不修改全局环境，也不保证第三方工具的所有缓存均受此控制。路径在仓库内、与原 userData 重叠、包含链接/非目录或不可写时停止启动，不回退到旧数据。已有数据不自动迁移或删除。

`npm start`、dev.ps1 普通/Watch 和启动开发版.cmd 都进入同一 main.js，因此不需要分别维护数据路径参数。初始化和单实例锁已前移到配置、凭据兼容迁移之前。正式打包分支不设置路径、不创建 profile，也不改记忆环境配置。

第一次使用新开发 profile 是新环境，需要自行登录和配置；不会自动导入 10 个历史浏览器目录、正式配置或旧记忆。发行版本及 MCP Schema 未更改。默认端口已按环境分开：正式 MCP/Tunnel 健康端口为 `18765/18081`，开发为 `28765/28081`。开发配置首次升级仅替换完整旧默认组合，保留自定义或混合组合，并保存 `developmentPortsMigrated` 标记，之后用户明确保存的端口不再自动改写。端口仍可能被其他程序占用，现有启动检查会报错，需手动选择端口；不自动结束未知进程。多个开发仓库仍共用开发默认端口，选择同一工作区仍共享 `.coding-tools/`，不能把默认端口分离描述成完全的进程或项目隔离。正式目录选择和冷迁移已有源码实现，验证范围见 [使用说明](storage-settings.md)。

本轮用真实 Electron Session、SettingsStore 和 Python 路径解析探针验证了独立目录、重启后配置及人工 localStorage 持久化；探针没有启动完整业务 UI、连接 ChatGPT 或读取 Cookies。正式分支不改路径的证据来自定向测试与代码审查，不冒充正式版实机迁移测试。

## 1. 设计目标与现状

`Mika-Repository` 是源码和构建产物的“加工厂”，不应成为正式配置、登录会话、密钥或长期记忆的默认存储位置。应用目录、用户数据目录、项目工作区和测试输出必须分别管理；源码仓库搬家不应带动正式数据搬家。

当前已经成立的分工：

- `electron/paths.js` 将配置、技能、提示词、加密密钥、服务状态与助手日志统一放在 `app.getPath('userData')` 下。
- ChatGPT 使用 `persist:chatgpt-session`；分区名相同不等于与其他 profile 共享文件，实际隔离仍取决于 Electron 的会话根目录。
- 桌面启动 Python 时将 Runtime 临时根固定在 `<userData>/runtime-workspace`，包含归属标记及可恢复归档；任务与历史仍属于所选工作区的 `.coding-tools/`。
- 长期记忆默认在 `%LOCALAPPDATA%/Mika/memory-v1`，而非 Electron userData；独立 Python 支持 `CODING_TOOLS_MCP_MEMORY_ROOT` 覆盖。

初次核查时仍缺少显式的环境身份、早期目录初始化、统一测试输出入口、整套 profile 迁移协议。上方“已落实的有限范围”说明了后续修复；以下启动入口核查表保留为修复前依据，不代表修复后的开发入口仍未隔离。

## 2. 启动入口核查

| 入口 | 当前行为（静态证据） | 缺口 |
| --- | --- | --- |
| 安装版 EXE、`dist/win-unpacked` 成品 | 均由 `package.json` 的 `electron/main.js` 启动；`paths.js` 直接读取 Electron userData。 | 没有应用自己的固定环境/目录策略，也没有整套数据目录选择与迁移入口。 |
| `npm start` | `electron . --no-sandbox --disable-gpu --enable-logging`。 | 没有显式独立开发数据目录；启动参数不构成数据隔离。 |
| `dev.ps1` 普通/Watch | 普通调用 npm start，Watch 直接调用 Electron；仅清除影响 Electron 执行方式的环境变量。 | 两条路径均未设置独立 userData；重启沿用环境，不能靠入口名称认定安全。 |
| `启动开发版.cmd` | 直接调用 Electron，失败时换 GPU 参数重试；日志写在仓库根 `启动日志.txt`。 | 两次启动都没有数据隔离；开发日志位置未按任务用途归位。文件用代码页 936，本轮未修改其编码。 |
| `npm test` / `npm run verify` | Python 测试脚本后接 Node 测试；单项通常使用 os.tmpdir/tempfile。 | 没有统一显式设置 TEMP/TMP、Runtime 根和记忆根；部分测试自己指定 cwd，环境变量不能统一解决所有输出。 |
| UI/真实链路探针 | 已有本机探针手动注入独立 userData 和临时路径。 | 只证明那些探针的配置，不等于正式启动或全体测试已自动遵守。历史脚本是证据，不是当前启动规范。 |

主要源码依据：`package.json` 的 scripts/main、`dev.ps1`、`启动开发版.cmd`、`scripts/run-python-tests.js`、`tests/source-root-clean.test.js`、`resources/coding-tools-mcp/tests/test_task_state_and_build.py`。

## 3. 建议路径与数据归属

以下路径属于建议目标，尚未实施。Windows 特殊目录由系统 API 取得，不将 `C:/Users/某个用户名` 或 `D:/Lenovo/...` 写入交付程序。

| 环境/数据 | 建议位置 | 规则 |
| --- | --- | --- |
| 正式 profile 默认值 | `%APPDATA%/mika-mcp/` | 显式稳定标识，不随产品展示名称或安装目录改变。实施前核对已有实际 userData；若不同，先做迁移决策，不能自动打开空目录代替旧数据。 |
| 正式 profile 自定义位置 | 用户选择的工作区外绝对目录，例如 `D:/MikaData/production/` | 示例不是默认承诺；需要专门迁移流程与重启后生效，不修改全局 PATH 或系统环境。 |
| 开发 profile | `<源码仓库父目录>/Mika-Data/development/<仓库ID>/profile/` | 与正式分离；可用 MIKA_DEVELOPMENT_DATA_ROOT 覆盖基目录，Windows 拒绝 C 盘。仓库 ID 来自规范化源码路径的稳定哈希，不是发行版本号。仓库换位置形成新的开发身份，旧 profile 不自动导入。 |
| 测试 profile/产物 | `<repo>/tmp/<任务或测试运行ID>/userdata/`、`workspace/`、`temp/`、`logs/` | 每次运行隔离；不得隐式使用正式 profile。测试 Runtime 根必须在所选测试工作区之外，否则继续由 Runtime 拒绝。 |
| Runtime 临时内容与回收 | `<已选profile>/runtime-workspace/` | 延续现有归属与 retired 规则，不把实例残留当作普通浏览器数据清理。 |
| 长期记忆目标 | `<已选profile>/memory-v1/` | 各环境独立。正式旧 `%LOCALAPPDATA%/Mika/memory-v1` 必须单独确认迁移；第一阶段保留其兼容位置，不能因规范变更使已有记忆变成不可见。开发/测试先显式指定自己的记忆根。 |
| 项目任务、历史、worktrees | `<用户选择的工作区>/.coding-tools/` | 不属于 profile 迁移。即使 profile 已隔离，两个环境选同一工作区仍会共享任务状态；测试必须使用隔离工作区。 |
| 历史探针、恢复证据 | 独立维护归档与任务记录目录 | 不是交付依赖，不由新启动逻辑自动扫描、合并或清空。 |

正式与开发 profile 均保持现有 Electron 数据布局。建议显式把 `userData` 和 `sessionData` 绑定到同一已选 profile，避免只迁移 settings.json 却留下浏览器数据。`Partitions/chatgpt-session` 等真实子目录由 Electron 管理，不手工拼造新“浏览器目录”。

### 数据类别与责任

- **持久、需备份**：配置、技能、提示词、浏览器 profile、加密凭据、记忆正文与配置。选择位置、迁移与保留周期由用户决定，应用负责校验及恢复机制。
- **运行身份，不直接迁移复用**：Runtime/Tunnel PID、端口状态、launch ID、源码/运行指纹、启动时间、绝对路径。新 profile 要重新建立身份，不能对复制来的 PID 执行 taskkill。
- **诊断证据**：日志、性能记录、迁移清单、失败清理票据。保留并区分旧根与新根，不冒充当前活跃服务状态。
- **可重建内容**：受支持的记忆索引及已确认的测试/编译缓存。浏览器文件不能仅凭名称批量列为可删除缓存；归档可以原样保留。
- **测试夹具**：创建者负责自己的样本与空目录收尾；意外内容或占用时应报告失败、保留，不递归清理不明历史目录。

## 4. 原设计约束与后续实现

### 4.1 初始化必须早于持久读写

建议顺序：加载 Electron → 判定正式/开发/显式测试身份 → 解析并验证数据根 → 创建/校验必要目录 → 设置 userData/sessionData → 获取相应单实例/目录占用保护 → 实例化数据服务并执行已授权的兼容迁移 → ready 后创建 Session 和窗口。

修复前 `electron/main.js` 在模块顶层实例化服务并读取配置、执行明文 Tunnel ID 兼容迁移，而 `requestSingleInstanceLock()` 直到接近文件末尾才调用。现在目录解析和单实例锁均已置于这些读写之前；后续目录选择逻辑也必须遵守此顺序，而不能只放在 whenReady 回调或开发启动脚本里。

Electron 随包类型声明 `setPath` 要求目录已存在，`sessionData` 覆盖必须在 ready 之前；`Session.getStoragePath()` 可用于后续真实路径验收。这里是 API 文档依据，不是已经生效的动态证据。

### 4.2 自定义根的配置发现

现有实现使用固定的 `<Electron appData>/Mika/storage/production.json`，Windows 通常位于 `%APPDATA%`，只存格式版本、默认根、当前根及迁移状态，不存 Token/Cookies。它位于 profile 之外，移动 profile 后仍能找到配置。正常启动与恢复启动均使用其同级 `instance-lock` 目录获取单实例锁，不占用可迁移的默认 profile；获得锁后再处理待迁移任务。校验失败保留原根，已选活动根不可用则停止启动。

优先使用本环境已验证的定位配置，缺省采用本环境默认值。不悄悄接受父进程继承的任意数据根来切换正式身份；路径无效/不可写、身份不匹配或出现迁移中断时明确报错，不回退到 cwd 或另一个空 profile。定位文件更新采用原子写入，只有目标验证成功后才切换。

开发身份不得注册正式开机启动或接管正式更新流程。`app.isPackaged` 区分正式/源码开发，测试身份只能从受控测试入口显式指定；“界面里的开发者模式”只是维护操作保护开关，不是开发运行环境。

### 4.3 数据隔离不等于进程隔离

正式保持 MCP 18765、Tunnel health 18081，开发默认为 28765/28081；不自动杀死占用端口的未知进程。

目录选定后再申请实例锁；同一 profile 只能有一个写入实例。正式与开发能否同时运行必须实机检查，不能只凭根目录不同就认定锁、服务或端口已经分离。Runtime/Tunnel 状态与凭据均应随 profile 分开，MCP 认证 Token 不能从正式自动复制到开发/测试。

长期记忆还需要桌面启动端显式传入按环境选定的 MEMORY_ROOT，不能只改 userData。独立 Python 的现有路径参数与环境配置保留，不把桌面 profile 规则强加给所有独立客户端。

### 4.4 路径显示必须来自实际配置

已修复记忆目录入口不一致：主进程每次打开时读取本地 Runtime 的 `memory_control config`，使用其 `config.root`，校验绝对路径、目录及祖先无链接、目录非空后调用系统打开；不创建或猜测旧目录。界面统一显示 Runtime 根，不再要求路径位于工作区内，也不回退 `.coding-tools/memory`。无法获取路径时显示待获取状态，目录未创建时禁用打开入口；打开错误统一提示。正式记忆根保持原有配置，开发记忆根使用独立 D 盘 profile。

## 5. 迁移与恢复规则

profile 的改址与“开一个新环境”是不同动作。开发/测试默认创建全新 profile，不导入正式登录或凭据；正式改址只能由用户显式选择来源和目标。

1. **识别来源**：展示规范化绝对路径、环境/身份、内容类别及预计大小；不能从 `.probe-userdata*` 名称或最新修改时间自动选择“正式数据”。当前 10 个旧浏览器目录继续保留，用户决定是否选其中某一个作为来源，禁止自动合并登录会话。
2. **关闭写入者**：确认 Electron、后台 Runtime/Tunnel、浏览器会话及相关工作都停止；仅关窗口可能仍在托盘运行。核对服务身份后停止，不凭旧 PID 杀未知进程。检测占用、重解析点与权限，源码/构建目录、磁盘根、源目录内的目标及已有非空目标均不作为迁移目标。
3. **保存备份与清单**：源保持不动，保存文件路径/大小/哈希和环境版本，不输出 Cookie 或凭据值。浏览器数据必须作为完整 profile 冷复制；不得在运行中只拷 Cookies、只拷 Partitions 或只复制 settings。目标复制中不作为活跃 profile。
4. **分清持久数据与旧状态**：保留完整源备份，但新活跃目标不复用 `runtime-state.json` 的 PID/指纹、临时 Runtime 实例目录或旧 notification 游标。旧清理队列含绝对根，单独保存恢复记录；按原根确认/处理后再移交，不把它改写成新根票据。通知基线重新建立，避免旧完成事件重播。
5. **单独处理记忆**：旧库目前在 profile 之外，必须明确选择。受支持的 ZIP 导出/导入涵盖 Markdown 与配置，排除 memory.db 和 candidates；索引重建，候选若需保留应在关闭写入者后另作完整备份，不能宣称 ZIP 已保留所有候选或历史文件。
6. **校验并切换**：先验证持久文件、可写性、身份以及安全存储上下文，再原子更新定位配置；下一次完整重启才用新根。凭据与 Chromium 加密存储受 Windows 用户/安全上下文等条件约束，文件哈希一致不等于登录仍有效；无法解密时明确提示，保留原源，不自动清空或写成“没有凭据”。
7. **验收与回滚**：真实检查 app.getPath(userData/sessionData)、持久分区 getStoragePath、实际服务 PID/端口/Schema 身份、配置可读与重启持久化。用户正常确认登录可用后，才认定会话迁移成功；不为路径取证读取或记录 Cookies 明文。失败时停止新目标并恢复旧定位，保留两份数据和失败记录，不自动覆盖旧数据。

源数据、归档与备份的最终删除是另一次用户决策。跨盘迁移必须复制和验证后保留原源，不能先删除源；同盘也不能仅因为重命名成功就跳过验证。

## 6. 分阶段实施及最低验收

| 阶段 | 修改范围 | 验收 |
| --- | --- | --- |
| 1：启动隔离 | 早期 bootstrap、paths、主进程初始化顺序、所有开发启动入口、开发/测试记忆根与端口身份。正式 profile 与正式旧记忆先保持兼容，不迁移旧会话。 | 默认路径与无效路径解析测试；真实正式/开发 profile 与 Session 位置不同；没有正式目录写入；服务/锁/端口身份正确；旧正式配置仍可读。 |
| 2：测试归位 | npm test/verify 的受控输出根与逐项夹具，审查强制 cwd、共享 cache 和产生诊断证据的脚本。 | TEMP/TMP/Runtime/记忆输出归位，失败路径收尾或留证据，仓库根无新增随机目录，不影响正式用户数据。 |
| 3：展示修正 | 桌面显示实际 profile/记忆根，“打开目录”与真实根一致。 | 实机打开正确目录，不把工作区任务路径显示成应用记忆路径；此阶段不实现自动迁移。 |
| 4：自定义与迁移 | 用户目录选择、固定定位文件、完整备份/清单、冷迁移和回滚流程。 | 空/非空目标、占用、不可写、路径链接、跨盘失败与中断可恢复；旧 PID不复用；真实重启后仍能读目标数据；用户确认登录。 |

上方“已落实的有限范围”之外的行为验收仍为后续实施要求，不表示已经执行。产品发行版本保持不变；公开 MCP 工具契约若在后续改变，另按 AGENTS.md 处理 Schema，不因目录规范自动升版本。
