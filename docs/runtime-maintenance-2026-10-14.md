# 2026-10-14 本机 MCP 运行环境维护

## 内置 Python 完整性标签

维护前，`resources/native-python/python.exe` 与 `pythonw.exe` 均继承 Low no-write-up 标签。普通用户启动后，实测进程完整性 RID 为 4096，向正常权限的任务用户数据目录写入失败。

本次保存两个文件的所有者、组、DACL、完整性标签和 SHA256，然后仅对这两个文件执行 `icacls <文件路径> /setintegritylevel M`。修改后，标签为 Medium no-write-up；两个文件的内容哈希、所有者、组和 DACL 均与备份一致。实测两个入口的进程完整性 RID 为 8192，向同一任务目录写入成功。

以桌面采用的 `pythonw.exe`，在正常权限的隔离任务用户数据目录验证了真实 MCP 启动、命令执行、旧进程退出、端口释放、同端口同 Token 重新发现，以及中断后台操作的持久记录恢复。健康端点与 discovery 的进程、实例、launch、源码指纹、Schema 和工作区信息保持一致；主仓库 Git index 未改变。该验证使用真实 Python 进程与 HTTP 通信，桌面路径和解释器选择由探针提供隔离配置，未启动正式桌面界面。

完整性标签是本机 NTFS 元数据，不由 Git 保存。父目录的继承标签未在本次修改；重新解压或替换内置解释器后，应重新核对这两个入口的标签和实际进程写入能力。

## 原有 24 个运行时哈希目录

通过目录所有者的普通用户权限检查了仓库根下的 `coding-tools-mcp/`：恰有 24 个哈希命名子目录，全部为空，没有发现进程引用。子目录所有者为当前用户，访问控制允许 SYSTEM、管理员和 OWNER RIGHTS；未发现需要通过接管所有权或重置 ACL 才能读取的情况。此前受限终端中的拒绝访问，不足以证明这些目录的 ACL 损坏。

在检查绝对路径、重解析点、目录身份、内容和占用后，已将整个 `coding-tools-mcp/` 移入 Windows 回收站，并核验新增回收条目的原位置为本仓库。共处理 25 个目录（外层目录 1 个、空子目录 24 个），0 个文件，文件总大小 0 B；未永久删除，也不报告磁盘空间释放。可在回收站找到 `coding-tools-mcp` 并还原。

本次只处理这一组仓库根目录残留，未改动其他探测用户数据目录。

## 运行时可恢复归档验证

本步新增实例归属标记、移动前恢复记录及桌面持久重试队列。以真实 `pythonw.exe` 和 HTTP 调用验证了强制停止、旧 PID 退出、端口释放、同端口同 Token discovery 身份换代、后台操作恢复，以及实例内容归档后保持不变。测试未启动正式桌面界面。

真实探针将 1 个实例目录同盘移入以下位置，未永久删除：

`D:\Lenovo\Documents\Mika-Repository\tmp\mika-runtime-retirement\http-userdata-unsandboxed\runtime-workspace\retired\1d2dcd067f5d7bb9-qCiOBcJbDWEVYtVe-a0cf226bc0f76d95`

包含 `.runtime-owner.json`、`retirement.json` 和 `tmp/preserve.txt`，共 3 个文件、文件总大小 1282 B（含本步新增的恢复记录）。原路径写在 `retirement.json` 中。归档同盘保留，未释放磁盘空间；测试归档与日志暂留作为证据，不清空 `retired/`。

受限终端的首轮真实停止未能确认 PID 退出，随后在正常用户权限下重跑。首轮留下的测试目录访问权限不同，未重置 ACL、未移动或删除；成功探针使用独立的 `http-userdata-unsandboxed/`。这些测试路径不属于正式用户数据目录。

本步探针和验证日志保存在 `D:\Lenovo\Documents\Local_codex\tmp\mika-runtime-retirement/`，其中 `live-result.json` 记录真实运行结果，`full-test.log` 记录全量回归结果。

最终全量回归通过：174 项 Python 测试、181 项 Node 测试及源码根目录检查；Schema 保持 v8、10 个工具，契约一致。期间修正了任务恢复测试的夹具竞态：该测试不再启动与其目标无关的异步预热，避免临时目录在销毁时被预热子进程占用；未修改实际预热行为。Python 全量测试仍输出未关闭管道的 `ResourceWarning`，本步未扩展处理这一告警。主 Git index SHA256 保持 `D6BA53C0128E45AA9FB3402C75041A7E973A64ADB89B5BDEC2B20E793310E473`。

## Windows 进程树测试管道收尾

后续以 `-X tracemalloc=10 -W always::ResourceWarning` 定向复现了两条未关闭管道告警，分配栈均指向 `tests/test_windows_process_tree_v024.py` 中的父进程 `Popen`。本步只修改该测试的收尾：为 taskkill 增加超时，等待父进程退出，超时后强制终止并再次等待；即使父进程收尾失败，也尝试确认子进程退出，并通过嵌套 finally 显式关闭两条管道。未修改 Runtime 业务逻辑。

主 Agent 独立执行了三个真实场景：正常路径、正常终止调用抛错、正常终止抛错且父进程树兜底超时。三者均确认父子 PID 已退出、stdout/stderr 已关闭、没有 ResourceWarning；注入异常仍传播，未被吞掉。本轮未重复运行无关全量测试。证据保存在 `D:\Lenovo\Documents\Local_codex\tmp\mika-process-pipes/` 的 `baseline.log` 和 `targeted.log`，Git index 哈希未变。

静态编译检查显式生成的 `resources/coding-tools-mcp/tests/__pycache__/test_windows_process_tree_v024.cpython-312.pyc` 已移入 Windows 回收站并核验原目录与文件名，共 1 个文件、13116 B。未永久删除、未释放磁盘空间；其他缓存未处理。恢复条目记录在上述证据目录的 `cache-recycle-result.log`。

## 本机证据与恢复记录

### 开发版数据隔离与 Electron 标签

本步在统一 Electron 主进程入口增加开发数据目录初始化，并在持久读写前申请单实例锁。开发 userData/sessionData 使用 `%LOCALAPPDATA%/Mika/development/<仓库路径哈希>/profile`，开发记忆根为其中的 memory-v1；正式打包分支不改路径或记忆环境。没有迁移或删除历史会话及正式数据。

真实 Electron 探针首轮发现仓库内 `node_modules/electron/dist/electron.exe` 继承 Low no-write-up 标签，无法向正常权限的隔离目录 mkdir。通过权限流程，仅将该开发依赖文件的标签恢复为 Medium；SHA256 `8593DB40C0C6E5E3C4B6B0A225B1DC9A549ECDF10F6CF2010CF5B6CE869CE07F`、所有者、组和 DACL 前后相同。仅结束此前失败的任务探针进程树，没有结束正式 Mika 或其他 Electron 应用。该标签是本机 NTFS 元数据，不由 Git 保存；重新安装开发依赖后须按实际失败证据核对，不能假定标签永久保持。

标签修复后，同一独立 profile 的两个真实 Electron 进程均成功创建持久 Session；第二次启动读到了第一次保存的配置与人工 localStorage，Python Runtime 也解析到开发记忆根。验证使用任务专属 LOCALAPPDATA、模拟正式根哨兵和本地静态页面，没有启动完整业务 UI、连接 ChatGPT、读取真实 Cookies 或凭据。哨兵未被写入。正式分支保持原配置来自代码审查和定向模拟测试，未声称对正式安装版做了迁移验证。

## 开发数据改到 D 盘

记忆目录入口随后完成修复：新增 memoryDirectoryService，主进程从 Runtime 配置读取根并校验后打开；renderer 路径文字、按钮及快捷入口使用同一来源，不再猜测工作区路径。原生 luna6_worker 经 followup_task 仅新增 memory-directory.test.js，15 项通过；主 Agent 独立审阅实现/测试，运行4项现有记忆界面接线测试，均通过。隔离真实 Electron 探针调用 Python Runtime 获取 D 盘人工配置，在实际 DOM 中执行当前页面函数验证文字、三个点击入口和缺失路径禁用，再调用真实 shell.openPath 成功；没有验证完整业务 UI 或观察资源管理器窗口内容。证据保留于 Local_codex/tmp/mika-memory-directory/result.json。首次受限 Electron 启动失败，权限流程后发现探针 Runtime 根与测试工作区嵌套，修正探针并仅结束确认的失败探针 PID 125096 后通过；业务代码没有因此扩大修改。未读取、迁移或删除真实记忆，测试资料和日志保留。

用户要求不在 C 盘堆放开发数据，随后修正上述默认策略：不再读取 LOCALAPPDATA/home，默认使用源码仓库父目录的 `Mika-Data/development/<仓库ID>/profile`。本仓库对应 `D:/Lenovo/Documents/Mika-Data/development/437fb56ff9078a26/profile`；绝对路径环境变量 `MIKA_DEVELOPMENT_DATA_ROOT` 可覆盖 development 基目录。Windows C 盘目标直接拒绝，不回退。开发 temp、当前进程 TEMP/TMP/TMPDIR 和 crashDumps 归入 profile；不改全局环境，不自动迁移或删除已有开发、正式或历史探针数据。

原生 luna6_worker 通过 followup_task 更新限定的 `tests/data-directory.test.js`，12 项定向测试全部通过（含 C 盘拒绝及 junction 防护）。主 Agent 阅读实现和测试，独立运行两次真实 Electron 探针：使用授权 D 盘任务覆盖基目录，验证 userData/sessionData、temp/crashDumps、环境变量、Python 记忆根和重启持久化；正式根哨兵未变，Git index 未变。证据保留在 Local_codex/tmp/mika-development-isolation/d-drive-first.json、d-drive-second.json 和对应日志。未启动完整业务界面，也未在默认 Mika-Data 目录创建真实用户 profile。

新增 10 项目录与启动顺序回归由原生 luna6_worker 实现，主 Agent 独立复核代码并完成真实验证与全量验收。全量 174 项 Python、191 项 Node 测试及 Schema 契约均通过，Git index 哈希未变。验证脚本、标签快照、live-first.json、live-second.json 和 full-test.log 保存在 `D:\Lenovo\Documents\Local_codex\tmp\mika-development-isolation/`；测试夹具保留在仓库 `tmp/mika-development-isolation/`，本轮未新增仓库根散落文件。

权限快照、前后写入探针、真实运行结果、历史目录清单及回收站恢复条目保存在：

`D:\Lenovo\Documents\Local_codex\tmp\mika-runtime-permissions/`

主要记录为 `integrity-before.json`、`integrity-after.json`、`live-result.json`、`legacy-inspection.json` 和 `legacy-recycle-result.json`。这些记录用于本机维护和恢复，不是项目运行依赖。维护中未更改发行版本号，未创建提交或发布产物。
