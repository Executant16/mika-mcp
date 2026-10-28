# MCP 运行时目录

桌面助手启动 MCP 时，明确将 `CODING_TOOLS_MCP_RUNTIME_ROOT` 设置为 Electron 用户数据目录下的 `runtime-workspace/`。该值覆盖父进程继承的同名环境变量，并参与运行时复用指纹；用户数据目录改变后，旧进程不会继续按原指纹复用。

目录结构为：

```text
<userData>/runtime-workspace/<工作区路径哈希>/<运行时实例 ID>/
  home/
  tmp/
  cache/
  .runtime-owner.json

<userData>/runtime-workspace/retired/<工作区哈希>-<实例 ID>-<随机后缀>/
  retirement.json
  （原实例内容及归属标记）
```

这些目录供命令执行时使用。任务状态、任务历史和后台操作记录仍保存在所选工作区的 `.coding-tools/` 中，不随运行时临时目录迁移。

源码开发版的 `<userData>` 由早期初始化设为 `<源码仓库父目录>/Mika-Data/development/<仓库路径哈希>/profile`，浏览器 sessionData 同根，子进程记忆根为该目录的 `memory-v1/`；临时目录为 `tmp/`，崩溃转储为 `crash-dumps/`。可用绝对路径 `MIKA_DEVELOPMENT_DATA_ROOT` 覆盖 development 基目录；Windows 下拒绝 C 盘，不使用 LOCALAPPDATA/home 回退。仅设置当前进程 TEMP/TMP/TMPDIR，不改变全局环境。正式版默认沿用原位置，用户可通过设置确认冷迁移到自定义目录；详见 [自定义正式数据目录](storage-settings.md)。开发版不导入正式或历史探针数据。已选活动目录不可用时停止启动，不猜测其他 profile。

独立启动 Python MCP 时，可设置 `CODING_TOOLS_MCP_RUNTIME_ROOT` 指向工作区外的可写目录。显式路径落入当前工作区时返回 `INVALID_ARGUMENT`。未设置时使用系统临时目录；如果临时目录退回当前启动目录，或运行时根目录落入工作区，必须有工作区外的可用备用路径，否则返回 `RUNTIME_DIR_UNWRITABLE`。Windows 没有自动备用路径，须提供有效的显式目录。

新实例创建目录时写入 `.runtime-owner.json`，记录工作区、哈希、根目录、实例 ID、launch ID 和 PID。正常关闭或热切换时，只有确认没有正在启动/运行的命令及未完成后台操作，才将匹配归属的旧实例同盘改名到 `retired/`；关闭后禁止重新创建命令临时目录。后台操作未完成时拒绝热切换，避免任务状态和目录归属混用。

桌面强制停止服务后，先确认旧 PID 已退出，将旧 PID、launch ID、运行时根目录写入 `nativeCleanupPending`，再调用独立 console Python 归档。目录、归属或进程状态不确定时保持原样；失败写入桌面日志并保留请求，在后续停止或启动新实例时重试。用户数据根目录发生改变时，不自动处理旧根目录的请求。

恢复记录 `retirement.json` 在移动前写入，包含原路径、归档路径、实例身份、时间和原因。记录写入失败不移动；移动失败可使用原记录重试。只尝试移除已经为空的工作区哈希父目录，不递归删除实例内容，不跟随链接或重解析点，也不自动清空 `retired/`。恢复前停止相关实例，核对记录及目标无冲突，再按记录还原；归档不是释放磁盘空间。

无归属标记的历史目录不自动认领；权限恢复、占用检查及可恢复清理由独立维护步骤处理。独立启动 Python MCP 的关闭若因忙碌或权限失败而留下目录，会在 stderr 输出 `runtime-cleanup` JSON；它不具备桌面端的持久重试队列，可在确认退出后按标记中的 PID/launch ID 使用内部 `coding_tools_mcp.runtime_cleanup` CLI 处理。

Windows 目录可否访问还取决于进程身份、DACL 和完整性标签。固定路径不会修复已有权限或标签；测试和维护应分别核对路径选择与实际写入结果。
