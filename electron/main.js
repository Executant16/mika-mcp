process.on('uncaughtException', (err) => {
  console.error('>>> [Electron 致命未捕获异常 uncaughtException]:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('>>> [Electron 未捕获 Promise 拒绝 unhandledRejection]:', reason);
});

const path = require('node:path');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const crypto = require('node:crypto');
const { app, BrowserWindow, WebContentsView, dialog, ipcMain, shell, Tray, Menu, nativeImage, session, Notification, nativeTheme, clipboard } = require('electron');
const { autoUpdater } = require('electron-updater');
const { SettingsStore } = require('./services/settingsStore');
const { SkillStore } = require('./services/skillStore');
const { PromptStore } = require('./services/promptStore');
const { SecretStore } = require('./services/secretStore');
const { LogService } = require('./services/logService');
const { EnvironmentService } = require('./services/environmentService');
const { RuntimeOrchestrator } = require('./services/runtimeOrchestrator');
const { ChatViewController } = require('./chatViewController');
const { run } = require('./services/commandRunner');
const { resolveProxy, clearProxyCache } = require('./services/proxyService');
const { BuildVerificationService } = require('./services/buildVerificationService');
const { HealthService } = require('./services/healthService');
const { readJson, writeJsonAtomic } = require('./services/jsonStore');
const { LocalMcpClient } = require('./services/localMcpClient');
const {
  memoryListArgs,
  memorySearchArgs,
  memoryCreateArgs,
  memoryUpdateArgs,
  memorySetConfigArgs,
  memoryConfirmArgs,
  memoryRejectArgs,
  memoryIdArgs,
  memoryRestoreRevisionArgs,
  memoryExportArgs,
  memoryImportArgs
} = require('./services/memoryRequests');
const { TaskNotificationService } = require('./services/taskNotificationService');
const { NotificationCheckpointStore } = require('./services/notificationCheckpointStore');
const { notificationStateFile, settingsFile } = require('./paths');

let chatWindow;
let settingsView;
let settingsViewReady = null;
let workspaceDropdownWindow = null;
let activeSurface = 'chat';
let chatController;
let orchestrator;
let forceQuit = false;
let tray = null;
let buildVerification;
let healthService;
let taskNotificationService;
let sharedLocalMcpClient = null;
let isDirectoryDialogOpen = false;
const settings = new SettingsStore();
const skillStore = new SkillStore();
const promptStore = new PromptStore();
const secrets = new SecretStore();
const log = new LogService();
const environment = new EnvironmentService();
const notificationCheckpoints = new NotificationCheckpointStore(notificationStateFile);

// 敏感连接凭据加密迁移：检查 settings.json 是否存在明文 tunnelId，若存在则自动安全迁移进 SecretStore (DPAPI 加密)，并从 settings.json 中彻底抹除明文
try {
  const diskSettings = readJson(settingsFile(), {});
  if (diskSettings && typeof diskSettings.tunnelId === 'string' && diskSettings.tunnelId.trim()) {
    const rawTunnelId = diskSettings.tunnelId.trim();
    if (!secrets.get('tunnelId')) {
      secrets.set('tunnelId', rawTunnelId);
    }
    delete diskSettings.tunnelId;
    writeJsonAtomic(settingsFile(), diskSettings);
  }
} catch (migErr) {
  console.warn('>>> [Mika-MCP] 明文 Tunnel ID 迁移警告：', migErr?.message || migErr);
}

/* Windows 任务栏图标（第 29 轮 / 用户第 11 条「windows 任务栏上的应用图标
 * 还是原作者设置的，需要改成我们自己的」）。
 *
 * ★ 实测结论（这条注释只写被实验证实的事，推测一律标明）：
 *
 * 1) 窗口图标本身是对的。用 ctypes 把 WM_GETICON(ICON_BIG) 的位图 dump 出来，
 *    与 electron/app-icon.ico 的 48px 项逐像素比对，**差异 0 像素、sha256 相同**。
 *    形状也对：深色圆角底 + 白色尖角 › + 强调蓝下划线 _（底色 #191c22 / 蓝 #6c8cff）。
 *    说明 BrowserWindow 的 icon: appIconPath() 一直生效，不需要改。
 *
 * 2) AUMID **不影响**这个窗口图标。A/B 对照：把 setAppUserModelId 改为无条件执行
 *    再重启，窗口图标的 sha256 与不注册时**完全一致**。
 *    （所以"是 AUMID 导致回退到 electron.exe 图标"是不成立的推测，已删。）
 *
 * 3) 用户看到"原作者的图标"，实际来源是**机器上另有一份原作者打包版**：
 *      D:\web-mcp-assistant\网页 MCP 助手.exe      （2026-08-29 安装，Electron 43.2.0）
 *    开始菜单快捷方式「网页 MCP 助手」的 LinkInfo.LocalBasePath 正指向它，
 *    且该快捷方式**没有自定义图标**（link_flags=0x97，IconLocation 位未设），
 *    所以它显示 exe 自带图标 —— 配色是 #09193a 深海军蓝 + #72f6ff 青，
 *    与我们的品牌图（#191c22 + #6c8cff）明显不同。
 *    ★ 这是**用户机器上的既存安装**，不是本仓库代码能改掉的东西。
 *
 * 保留 AUMID（收紧到打包后）的理由：它服务于"固定到任务栏"和通知归属，
 * 这两件事只由打包版承担；开发模式（命令行起进程）注册 AUMID 反而会让
 * shell 去开始菜单找带该 AUMID 的快捷方式（即上面那份原作者安装的），
 * 存在把图标解析带偏的风险，而开发模式并不需要它。 */
if (process.platform === 'win32' && app.isPackaged) {
  app.setAppUserModelId('com.executant.mika-mcp');
}

/* ChatGPT 视图从窗口顶部往下的偏移量（= browser.html 里 .browser-toolbar 的高度）。
 * 设置视图则占满整个内容区（y=0），这正是"设置和主界面一样大（含顶部工具栏）"的实现。
 *
 * 这个数字必须与 renderer/browser.css 的 --toolbar-height 保持一致。
 * 第 24 轮之前它被抄成了 5 份字面量（CSS 2 处、这里 1 处、chatViewController
 * 的默认值 1 处、测试断言 1 处），且 chatViewController 那份写错成 64。
 * 主进程与渲染进程之间没有共享模块，CSS 变量跨不过来，所以这里保留具名常量，
 * 由测试断言"常量值 == CSS 变量值"来守住两者同步。
 *
 * ★ 第 32 轮：112 → 76（用户第 2 条「顶部两栏的高度分别规范为 40px 和 36px」）。
 *   改前是 63（第一行）+ 49（第二行）= 112。两行各自把多余空白收掉：
 *   第一行 63→40（当时按钮 38px 且带常驻边框，需要一个更大的容器；
 *   现在按钮 26px 的幽灵形态，40px 已含 7px 上下呼吸），
 *   第二行 49→36（那一行只有 26px 高的控件）。
 *   不要漏改另外两处（browser.css 的 --toolbar-height、chatViewController
 *   的默认值），测试会断言三者相等。 */
const CHAT_TOOLBAR_HEIGHT = 64;

/* 窗口/任务栏图标。
 *
 * 第 25 轮改为**按平台选格式**：Windows 优先用 .ico。
 * 原因：Windows 任务栏与 alt-tab 走的是 shell 的图标接口，.ico 里可以内嵌
 * 16/24/32/48/64/128/256 七档位图，shell 直接挑最合适的一档；PNG 只能靠
 * 运行时缩放，在部分 DPI 与固定到任务栏的场景下会退回默认 Electron 图标。
 * macOS 用 PNG（icns 由打包器生成）。两只文件都由 scripts/generate-icon.js 产出，
 * 内容同源，所以换格式不会造成两套图标。
 *
 * 注：若"固定到任务栏"的旧图标仍在，属于系统图标缓存
 * （%LOCALAPPDATA%/IconCache.db 与 Explorer 的 iconcache_*.db），需重启资源管理器才会刷新。 */
function appIconPath() {
  const png = path.join(__dirname, 'app-icon.png');
  const ico = path.join(__dirname, 'app-icon.ico');
  if (fsSync.existsSync(png)) return png;
  return ico;
}

function getAppNativeIcon() {
  const png = path.join(__dirname, 'app-icon.png');
  try {
    if (fsSync.existsSync(png)) {
      const img = nativeImage.createFromPath(png);
      if (!img.isEmpty()) return img;
    }
  } catch (_) {}
  const p = appIconPath();
  try {
    const img = nativeImage.createFromPath(p);
    if (!img.isEmpty()) return img;
  } catch (_) {}
  return p;
}

/* 设置界面现在是主窗口里的一个原生视图，不再是独立的 BrowserWindow。
 * 为什么必须用原生视图、不能靠 CSS 隐藏：
 *   ChatGPT 页面是 WebContentsView（原生层），它盖在 renderer 的 DOM 之上。
 *   给 DOM 元素设 display:none 无法盖住一个原生视图，只有原生层之间的
 *   setVisible()/removeChildView() 才能互相遮挡。
 * 为什么不让设置页和 ChatGPT 共用一份 CSS：
 *   browser.css 自带 :root{--border/--text/--muted/--green/--red}，
 *   与 design-tokens.css **同名不同值**。若两套 CSS 同时加载，
 *   设置页的 var(--border) 会拿到 ChatGPT 风格的色值，颜色全乱。
 *   分成两个视图后，两套 CSS 各自隔离，互不污染。 */
function sendManager(channel, payload) {
  if (settingsView && !settingsView.webContents.isDestroyed()) {
    settingsView.webContents.send(channel, payload);
  }
}

function surfaceBounds(includeToolbar) {
  if (!chatWindow || chatWindow.isDestroyed()) return { x: 0, y: 0, width: 0, height: 0 };
  const [width, height] = chatWindow.getContentSize();
  const rightMargin = (!includeToolbar && chatController?.sidebarWidth) ? chatController.sidebarWidth : 0;
  return {
    x: 0,
    y: includeToolbar ? 0 : CHAT_TOOLBAR_HEIGHT,
    width: Math.max(0, width - rightMargin),
    height: Math.max(0, height - (includeToolbar ? 0 : CHAT_TOOLBAR_HEIGHT))
  };
}

function createSettingsView() {
  if (settingsView && !settingsView.webContents.isDestroyed()) return settingsView;
  settingsView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  const savedTheme = settings.load().theme || 'dark';
  const isSysDark = nativeTheme ? nativeTheme.shouldUseDarkColors : false;
  const isDark = savedTheme === 'dark' || (savedTheme === 'system' && isSysDark) || (savedTheme === 'custom' && settings.load().customTone !== 'light');
  settingsView.setBackgroundColor(isDark ? (savedTheme === 'custom' ? '#0f172a' : '#141414') : '#ffffff');
  const initialTheme = isDark ? (savedTheme === 'custom' ? 'custom' : 'dark') : 'light';
  settingsView.setBounds(surfaceBounds(true));
  settingsView.setVisible(false);
  chatWindow.contentView.addChildView(settingsView);
  settingsView.webContents.on('before-input-event', (_event, input) => {
    if ((input.control && input.key && input.key.toLowerCase() === 'r') || input.key === 'F5') {
      settingsView.webContents.reload();
    }
  });
  settingsViewReady = settingsView.webContents
    .loadFile(path.join(__dirname, '..', 'renderer', 'index.html'), { query: { theme: initialTheme } })
    .catch((error) => log.error(safeMessage(error), { stage: 'settings-view-load' }));
  return settingsView;
}

/* 第 44 轮：本函数不再操作原生标题栏（titleBarOverlay 已移除，三个按钮改自绘，
 * 见 renderer 里的 .window-controls）。它现在只做三件事：
 *   ① 把用户选择落到 nativeTheme.themeSource —— 「GPT 原生页面跟随主题」的开关；
 *   ② 把已解析的 dark/light 推给聊天页（chat:theme → data-theme）；
 *   ③ 同步窗口与设置视图的底色，避免切换瞬间露白/露黑。
 * 名字保留（调用点多），语义已从「同步标题栏」变为「应用主题」。 */
function syncTitleBarOverlay(themeOverride) {
  if (!chatWindow || chatWindow.isDestroyed()) return;
  const currentTheme = typeof themeOverride === 'string'
    ? themeOverride
    : (themeOverride?.theme || settings.load().theme || 'dark');

  /* ① nativeTheme.themeSource —— 全应用级开关。
   *
   * 用户第 44 轮明确要求「主界面只有任务栏切换好奇怪，GPT 原生页面也要跟着切换」：
   * 只有写 themeSource，宿主里所有渲染进程（含 chatgpt.com 自己的文档）的
   * prefers-color-scheme 才会跟着变，ChatGPT 站点才会自己切深浅色。
   * Mika 自己的界面仍走显式 data-theme + chat:theme（两套并存不冲突：
   * 显式 data-theme 决定 Mika 配色，themeSource 负责把偏好广播给 ChatGPT）。
   *
   * ★ 必须先写后读：shouldUseDarkColors 只有在 themeSource 落到新值之后才会反映
   *   用户选择；先读后写会读到上一次的残留值（第 42 轮实测复现过）。 */
  const customIsLight = settings.load().customTone === 'light';
  const targetSource = currentTheme === 'system' ? 'system'
    : currentTheme === 'custom' ? (customIsLight ? 'light' : 'dark')
    : currentTheme === 'dark' ? 'dark' : 'light';
  try {
    if (nativeTheme && nativeTheme.themeSource !== targetSource) {
      nativeTheme.themeSource = targetSource;
    }
  } catch (_) {}
  const isSysDark = nativeTheme ? nativeTheme.shouldUseDarkColors : false;

  /* 双条件判断"当前是不是设置面"：
   *   activeSurface === 'settings'  —— 逻辑状态
   *   settingsView.getVisible()      —— 原生层真实可见性
   * 两者都看，是为了防"逻辑已切走、原生还没 hide"的中间态。
   *
   * ⚠ 这里必须是 getVisible()，不能写 isVisible()。
   *   WebContentsView 的 API 是 getVisible()/setVisible()，**没有** isVisible()
   *   —— isVisible() 是 BrowserWindow 的方法，两者名字很像但不通用。
   *   实测：写成 isVisible() 会抛 TypeError，而这一行位于本函数最前部、
   *   setTitleBarOverlay 之前，于是**每次调用都在此处中断**，
   *   原生标题栏从此再不会被更新（深色/浅色切换完全失灵）。
   *   这一条是本轮"浅色/深色模式有问题"的主根因，属实测捕获，非推断。 */
  const isSettingsActive = activeSurface === 'settings'
    || Boolean(settingsView && settingsView.getVisible && settingsView.getVisible());
  const isDark = currentTheme === 'dark' ||
    (currentTheme === 'custom' && !customIsLight) ||
    (currentTheme === 'system' && isSysDark);

  /* 只留底色：它是窗口/视图的背景色，防止主题切换瞬间露白/露黑。
   * symbolColor / height 是原生按钮条的参数，随 titleBarOverlay 一并删除。 */
  const barColor = isSettingsActive
    ? (isDark ? (currentTheme === 'custom' ? '#1e293b' : '#242424') : '#ffffff')
    : (isDark ? '#171717' : '#ffffff');

  /* ② 把解析后的主题推给聊天页。
   * 聊天页 browser.html 是**独立文档**，设置页那套 applyTheme / theme-bootstrap
   * 走不到它，必须由主进程推（否则聊天页顶栏永远停在首帧的色）。
   * 无论原生按钮是否变化都要推，所以它排在所有提前返回之前。 */
  try {
    if (chatWindow && !chatWindow.isDestroyed()) {
      chatWindow.webContents.send('chat:theme', isDark ? 'dark' : 'light');
    }
  } catch (_) {}

  /* ③ 窗口与设置视图底色：0ms 同步，避免主题切换瞬间露白/露黑。 */
  try {
    chatWindow.setBackgroundColor(barColor);
  } catch (_) {}
  try {
    if (settingsView && !settingsView.webContents.isDestroyed()) {
      settingsView.setBackgroundColor(barColor);
    }
  } catch (_) {}
}

/* 主窗口的"当前表面"：chat（ChatGPT）或 settings（设置）。
 * 两者互斥显示，尺寸都等于整个窗口内容区。 */
function setActiveSurface(kind, focus = true) {
  if (!chatWindow || chatWindow.isDestroyed()) return false;
  const next = kind === 'settings' ? 'settings' : 'chat';
  if (activeSurface === next) return true;
  if (next === 'settings') {
    createSettingsView();
    settingsView.setBounds(surfaceBounds(true));
    settingsView.setVisible(true);
    chatController?.setSurfaceVisible(false);
    activeSurface = 'settings';
    if (focus) settingsView.webContents.focus();
  } else {
    const view = chatController?.view;
    if (view) {
      view.setBounds(surfaceBounds(false));
      chatController.setSurfaceVisible(true);
    }
    settingsView?.setVisible(false);
    activeSurface = 'chat';
    if (focus) view?.webContents?.focus();
  }
  syncTitleBarOverlay(undefined);
  return true;
}

function openSettingsSurface(initialPage = 'overview') {
  if (!chatWindow || chatWindow.isDestroyed()) createChatWindow();
  if (chatWindow.isMinimized()) chatWindow.restore();
  chatWindow.show();
  chatWindow.focus();
  setActiveSurface('settings');
  const targetPage = initialPage || 'overview';
  if (settingsView && !settingsView.webContents.isDestroyed()) {
    const sendNav = () => {
      try {
        if (settingsView && !settingsView.webContents.isDestroyed()) {
          settingsView.webContents.send('settings:navigate', targetPage);
        }
      } catch (_) {}
    };
    if (settingsView.webContents.isLoading()) {
      settingsView.webContents.once('did-finish-load', sendNav);
    } else {
      sendNav();
    }
  }
  return true;
}

function closeSettingsSurface() {
  setActiveSurface('chat');
  try {
    if (settings.load().developerMode) {
      settings.save({ developerMode: false });
      sendManager('settings:lock-developer-mode');
    }
  } catch (_) {}
  return true;
}

function safeMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function assertTrustedIpc(event) {
  const url = event.senderFrame?.url || event.sender?.getURL?.() || '';
  if (!url.startsWith('file://')) throw new Error('已阻止来自非本地页面的 IPC 调用。');
}

function secureHandle(channel, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    assertTrustedIpc(event);
    return handler(event, ...args);
  });
}

function extractWorkspaceName(wsPath) {
  const normalized = String(wsPath || '').trim().replace(/[\\/]+$/, '');
  if (!normalized) return '未命名项目';
  const parts = normalized.split(/[\\/]/);
  return parts.at(-1) || normalized;
}

function workspaceStatePaths() {
  const workspace = String(settings.load().workspace || '').trim();
  if (!workspace) throw new Error('请先选择工作目录。');
  const root = path.resolve(workspace);
  return {
    root,
    statePath: path.join(root, '.coding-tools', 'task-state.json'),
    historyPath: path.join(root, '.coding-tools', 'task-history.json'),
    performancePath: path.join(root, '.coding-tools', 'performance.json')
  };
}

function archiveTask(state, historyPath, reason) {
  if (!state || typeof state !== 'object' || (!state.task_id && !state.objective)) return;
  const history = readJson(historyPath, []);
  const items = Array.isArray(history) ? history : [];
  items.push({ ...state, archived_at: new Date().toISOString(), archive_reason: reason });
  writeJsonAtomic(historyPath, items.slice(-100));
}

async function invokeSafely(action) {
  try { return { ok: true, data: await action() }; }
  catch (error) { return { ok: false, error: safeMessage(error) }; }
}

async function callLocalMcpTool(name, args = {}) {
  const current = settings.load();
  const token = secrets.get('mcpAuthToken');
  if (!token) throw new Error('本地 MCP 尚未生成认证 Token。');
  if (!sharedLocalMcpClient) sharedLocalMcpClient = new LocalMcpClient({ port: current.mcpPort, token, log });
  else sharedLocalMcpClient.configure({ port: current.mcpPort, token });
  const client = sharedLocalMcpClient;
  if (!client.tools.length) await client.discoverTools();
  let result;
  try {
    result = await client.callTool(name, args);
  } catch (error) {
    client.resetDiscoveryState();
    if (!localMcpCallCanRetry(name, args)) throw error;
    await client.discoverTools();
    result = await client.callTool(name, args);
  }
  if (result?.isError) {
    const text = result?.content?.find?.((item) => item?.type === 'text')?.text;
    throw new Error(text || `${name} 调用失败。`);
  }
  return result?.structuredContent ?? result;
}

function invalidateLocalMcpDiscovery() {
  sharedLocalMcpClient?.resetDiscoveryState();
}

function localMcpCallCanRetry(name, args = {}) {
  if (name === 'workspace_context' || name === 'coding_tools_guide') return true;
  if (name !== 'task_control') return false;
  return ['get', 'history', 'operation', 'worktree_list', 'worktree_get', 'worktree_diff']
    .includes(String(args?.action || 'get').toLowerCase());
}

function showChatWindow() {
  const target = createChatWindow();
  if (target.isMinimized()) target.restore();
  target.show();
  target.focus();
  return target;
}

// ---- 自动更新（electron-updater）----
// 运行时只从公开 Release 拉取更新，公开仓库免鉴权；GH_TOKEN 仅用于本机发布 Release。
let updaterWired = false;
let updaterBusy = false;

function wireUpdaterEvents() {
  if (updaterWired) return;
  updaterWired = true;
  autoUpdater.autoDownload = true;
  autoUpdater.on('checking-for-update', () => {
    sendManager('app:update-status', { status: 'checking' });
  });
  autoUpdater.on('update-available', (info) => {
    updaterBusy = true;
    sendManager('app:update-status', { status: 'available', version: info && info.version });
  });
  autoUpdater.on('update-not-available', (info) => {
    updaterBusy = false;
    sendManager('app:update-status', { status: 'not-available', version: info && info.version });
  });
  autoUpdater.on('download-progress', (progress) => {
    sendManager('app:update-progress', {
      percent: progress && progress.percent,
      transferred: progress && progress.transferred,
      total: progress && progress.total
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    updaterBusy = false;
    sendManager('app:update-status', { status: 'downloaded', version: info && info.version });
    notifyUpdateDownloaded(info && info.version);
  });
  autoUpdater.on('error', (err) => {
    updaterBusy = false;
    const message = (err && (err.message || String(err))) || 'unknown';
    sendManager('app:update-status', { status: 'error', message });
    console.warn('>>> [Mika-MCP] 自动更新出错（已忽略）：', message);
  });
}

function notifyUpdateDownloaded(version) {
  try {
    const n = new Notification({
      title: 'Mika MCP 更新已就绪',
      body: `新版本 ${version || ''} 已下载，点击此处重启安装`
    });
    n.on('click', () => { try { autoUpdater.quitAndInstall(); } catch (_) {} });
    n.show();
  } catch (_) { /* 通知不可用时不阻塞主流程 */ }
}

function initAutoUpdater() {
  try {
    wireUpdaterEvents();
    if (app.isPackaged) {
      autoUpdater.checkForUpdates();
    }
  } catch (err) {
    console.warn('>>> [Mika-MCP] 初始化自动更新失败（已忽略）：', (err && err.message) || err);
  }
}

function checkForUpdatesManually() {
  if (updaterBusy) {
    sendManager('app:update-status', { status: 'checking' });
    return;
  }
  try {
    updaterBusy = true;
    autoUpdater.checkForUpdates();
  } catch (err) {
    updaterBusy = false;
    const message = (err && (err.message || String(err))) || 'unknown';
    sendManager('app:update-status', { status: 'error', message });
  }
}

function createTray() {
  if (tray && !tray.isDestroyed()) return tray;
  if (settings.load().showTrayIcon === false) return null;
  try {
    const icon = getAppNativeIcon();
    tray = new Tray(icon);
    tray.setToolTip('Mika MCP · 后台运行中');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '打开 Mika MCP', click: () => showChatWindow() },
      { label: '打开管理设置', click: () => { showChatWindow(); openSettingsSurface('settings'); } },
      { label: '检查更新', click: () => checkForUpdatesManually() },
      { type: 'separator' },
      { label: '退出 Mika MCP', click: () => { forceQuit = true; app.quit(); } }
    ]));
    tray.on('click', () => showChatWindow());
    tray.on('double-click', () => showChatWindow());
  } catch (err) {
    console.warn('>>> [Mika-MCP] 托盘图标创建异常，已跳过以保护主界面正常运行：', err?.message || err);
  }
  return tray;
}

function createChatWindow() {
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.show();
    chatWindow.focus();
    return chatWindow;
  }

  const winIcon = getAppNativeIcon();
  chatWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 620,
    center: true,
    show: false,
    backgroundColor: '#ffffff',
    title: 'Mika MCP',
    icon: winIcon,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'browserPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  if (process.platform === 'win32') {
    try {
      chatWindow.setIcon(winIcon);
    } catch (_) {}
  }
  chatWindow.removeMenu();
  const startupForTheme = settings.load();
  /* 首帧必须拿到**已解析**的 dark/light，不能把 'system' 原样传下去：
   * theme-bootstrap.js 只认 light/custom/dark，'system' 会落到 dark ——
   * 系统实际是浅色时，首帧就会闪一下黑。 */
  const startupSysDark = nativeTheme ? nativeTheme.shouldUseDarkColors : false;
  const startupTheme = (startupForTheme.theme === 'dark'
    || (startupForTheme.theme === 'system' && startupSysDark)) ? 'dark' : 'light';

  chatWindow.loadFile(
    path.join(__dirname, '..', 'renderer', 'browser.html'),
    /* 通过 URL 参数把初始主题交付给聊天页。
     * 为什么走 URL 而不是偏好设置：
     *   browser.html 的 CSP 是 script-src 'self'，内联脚本被禁，无法像
     *   settings 页那样内联引导；而聊天页在窗口显示前就要定好底色，
     *   等浏览器进程异步读配置会闪一下白。
     *   URL 参数在文档解析期就可用，theme-bootstrap.js 一执行即可定色，
     *   零闪烁、零新增 IPC。后续切换由 syncTitleBarOverlay 的 'chat:theme'
     *   推送接管。
     * 注意：这里必须用 settings.load() 而不能用 app.whenReady 里的
     *   startupSettings —— 后者是该回调的局部变量，本函数看不到（实测踩过）。 */
    { query: { theme: startupTheme } }
  );

  chatController = new ChatViewController({
    window: chatWindow,
    log,
    settings,
    toolbarHeight: CHAT_TOOLBAR_HEIGHT,
    onState: (payload) => {
      if (chatWindow && !chatWindow.isDestroyed()) chatWindow.webContents.send('chat:state', payload);
    },
    onDownload: (payload) => {
      if (chatWindow && !chatWindow.isDestroyed()) chatWindow.webContents.send('chat:download', payload);
    }
  });
  chatController.mount();

  /* 窗口尺寸变化时，两个视图都要跟着改。
   * 为什么不能只靠 ChatViewController 自己的 resize 监听：
   *   它的 setBounds 永远留出 CHAT_TOOLBAR_HEIGHT —— 那是 ChatGPT 视图的规则。
   *   设置视图要占满整个内容区（y=0），规则不同，必须在这里分别处理。 */
  chatWindow.on('resize', () => {
    hideWorkspaceDropdown();
    hideHealthDropdown();
    if (!chatWindow || chatWindow.isDestroyed()) return;
    const chatView = chatController?.view;
    if (chatView) chatView.setBounds(surfaceBounds(false));
    if (settingsView && !settingsView.webContents.isDestroyed()) settingsView.setBounds(surfaceBounds(true));
  });
  chatWindow.on('move', () => {
    hideWorkspaceDropdown();
    hideHealthDropdown();
  });
  chatWindow.on('minimize', () => {
    hideWorkspaceDropdown();
    hideHealthDropdown();
  });

  /* 第 44 轮：自绘按钮的图标要跟着最大化状态走（最大化→"还原"，否则→"最大化"）。
   * 把状态广播给两个渲染视图（聊天页 + 设置页），它们各自订阅
   * 'window:maximized-changed' 换图标。 */
  const broadcastMaximized = () => {
    const maximized = Boolean(chatWindow && !chatWindow.isDestroyed() && chatWindow.isMaximized());
    try {
      if (chatWindow && !chatWindow.isDestroyed()) {
        chatWindow.webContents.send('window:maximized-changed', { maximized });
      }
    } catch (_) {}
    sendManager('window:maximized-changed', { maximized });
  };
  chatWindow.on('maximize', broadcastMaximized);
  chatWindow.on('unmaximize', broadcastMaximized);

  chatWindow.once('ready-to-show', () => {
    syncTitleBarOverlay(undefined);
    chatWindow.show();
    // 预热工作区下拉窗口，确保用户首次点击时无需等待页面冷启动
    ensureWorkspaceDropdownWindow();
    ensureHealthDropdownWindow();
    // 预热设置中心视图（WebContentsView），在后台静默完成渲染与脚本加载，实现零延迟秒开
    setTimeout(() => {
      if (chatWindow && !chatWindow.isDestroyed()) {
        createSettingsView();
      }
    }, 300);
  });
  chatWindow.on('closed', () => {
    if (workspaceDropdownWindow && !workspaceDropdownWindow.isDestroyed()) {
      workspaceDropdownWindow.destroy();
      workspaceDropdownWindow = null;
    }
    if (healthDropdownWindow && !healthDropdownWindow.isDestroyed()) {
      healthDropdownWindow.destroy();
      healthDropdownWindow = null;
    }
    if (chatController) chatController.dispose();
    chatController = null;
    settingsView = null;
    settingsViewReady = null;
    activeSurface = 'chat';
    chatWindow = null;
  });
  chatWindow.on('close', (event) => {
    if (forceQuit) return;
    event.preventDefault();
    const current = settings.load();
    const shouldKeepRunning = current.closeAction ? current.closeAction === 'tray' : Boolean(current.keepRunningOnClose);
    if (shouldKeepRunning) {
      chatWindow.hide();
      return;
    }
    if (!orchestrator) {
      forceQuit = true;
      app.quit();
      return;
    }
    orchestrator.stop().catch((error) => log.error(error.message, { stage: 'close' })).finally(() => {
      forceQuit = true;
      app.quit();
    });
  });
  return chatWindow;
}

let isDropdownPopupRequested = false;
let dropdownShowTimer = null;

function hideWorkspaceDropdown() {
  isDropdownPopupRequested = false;
  if (dropdownShowTimer) {
    clearTimeout(dropdownShowTimer);
    dropdownShowTimer = null;
  }
  if (workspaceDropdownWindow && !workspaceDropdownWindow.isDestroyed()) {
    try {
      // ★ 防闪烁核心：绝不用 hide()（会让 DWM 销毁并重建分层窗口→白屏闪）。
      // 改为「屏蔽鼠标 + 移出屏幕 + 透明度归零」三步停放，窗口始终存活，
      // 下次打开时只靠 setOpacity(1) 揭示，不再触发层重建。
      workspaceDropdownWindow.setIgnoreMouseEvents(true);
      const b = workspaceDropdownWindow.getBounds();
      workspaceDropdownWindow.setBounds({ x: -10000, y: b.y, width: b.width, height: b.height }, false);
      workspaceDropdownWindow.setOpacity(0);
    } catch (_) {}
  }
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.webContents.send('workspace-dropdown:closed');
  }
}

const WORKSPACE_DROPDOWN_WIDTH = 456;
let cachedWorkspaceDropdownHeight = 0;

// ★ 关键防频闪串行队列：把"隐藏对方 + 显示自己"这对操作串行化。
// 工作区浮层与服务健康浮层共用本队列，确保高频连点时不会出现
// 「两个 handler 同时 hide 对方 + show 自己 → 两窗口都可见」的竞态。
let dropdownShowQueue = Promise.resolve();
function withDropdownQueue(task) {
  const run = dropdownShowQueue.then(() => Promise.resolve().then(task).catch((err) => {
    console.warn('浮层弹出示任务异常：', err?.message || err);
  }));
  dropdownShowQueue = run.catch(() => {});
  return run;
}

// ★ 防闪烁核心：揭示浮层时避免 hide()/show() 触发的 DWM 分层窗口重建（白屏闪）。
// 关闭时窗口只被「停放」（见 hide*Dropdown：opacity 0 + 离屏 + 屏蔽鼠标），
// 这里先把它就位再 setOpacity(1) 揭示；已存活的窗口不会再次走 show()，
// 从根本上消除「透明无边框子窗口反复显隐 → 闪屏」的问题。
function revealDropdown(win, x, y, w, h) {
  if (!win || win.isDestroyed()) return;
  try {
    win.setBounds({ x, y, width: w, height: h }, false);
    win.setIgnoreMouseEvents(false);
    if (!win.isVisible()) {
      // 仅首次需要 show()：先以透明度 0 显示，等合成器绘制完成再揭示，规避首帧白屏。
      win.setOpacity(0);
      win.show();
      win.setOpacity(1);
    } else {
      win.setOpacity(1);
    }
    // ★ 让浮层拿到焦点：仅 setOpacity(1) 不会让窗口获得焦点（与 show() 不同），
    // 不显式 focus() 会导致点击空白区域时 blur 事件无法触发 → 「点外面不收起」。
    // 这里和原 show() 的行为保持一致：弹出的浮层必然是当前焦点窗口。
    win.focus();
  } catch (_) {}
}

function estimateWorkspaceDropdownHeight(recentCount = 0) {
  const count = Number(recentCount) || 0;
  if (count <= 0) {
    return 236; // 暂无可用工作区时的标准空态高度，与前端实际渲染完全吻合
  }
  const listH = Math.min(280, count * 52 + (count > 1 ? (count - 1) * 4 : 0));
  return 190 + listH;
}

function ensureWorkspaceDropdownWindow() {
  if (workspaceDropdownWindow && !workspaceDropdownWindow.isDestroyed()) {
    return workspaceDropdownWindow;
  }
  const current = settings.load();
  const recentCount = Array.isArray(current.recentWorkspaces) ? current.recentWorkspaces.length : 0;
  const initialH = cachedWorkspaceDropdownHeight || estimateWorkspaceDropdownHeight(recentCount);
  workspaceDropdownWindow = new BrowserWindow({
    width: WORKSPACE_DROPDOWN_WIDTH,
    height: initialH,
    parent: chatWindow,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: false,
    webPreferences: {
      preload: path.join(__dirname, 'dropdownPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  workspaceDropdownWindow.loadFile(path.join(__dirname, '..', 'renderer', 'dropdown.html'));
  workspaceDropdownWindow.webContents.once('did-finish-load', () => {
    try {
      const current = settings.load();
      workspaceDropdownWindow.webContents.send('dropdown:data', {
        activeWorkspace: current.workspace,
        recentWorkspaces: current.recentWorkspaces || [],
        theme: current.theme
      });
    } catch (_) {}
  });
  workspaceDropdownWindow.on('blur', () => {
    hideWorkspaceDropdown();
  });
  return workspaceDropdownWindow;
}

function syncWorkspaceDropdownData() {
  if (workspaceDropdownWindow && !workspaceDropdownWindow.isDestroyed()) {
    try {
      const current = settings.load();
      workspaceDropdownWindow.webContents.send('dropdown:data', {
        activeWorkspace: current.workspace,
        recentWorkspaces: current.recentWorkspaces || [],
        theme: current.theme
      });
    } catch (_) {}
  }
}

// ── 服务健康详情浮层窗口（独立透明浮层，杜绝WebContentsView遮盖、溢出与层叠） ──
let healthDropdownWindow = null;
const HEALTH_DROPDOWN_WIDTH = 520;
const HEALTH_DROPDOWN_HEIGHT = 316;

function hideHealthDropdown() {
  if (healthDropdownWindow && !healthDropdownWindow.isDestroyed()) {
    try {
      // ★ 防闪烁：与健康浮层对称处理，停放而非 hide()，避免 DWM 层重建白屏闪。
      healthDropdownWindow.setIgnoreMouseEvents(true);
      const b = healthDropdownWindow.getBounds();
      healthDropdownWindow.setBounds({ x: -10000, y: b.y, width: b.width, height: b.height }, false);
      healthDropdownWindow.setOpacity(0);
    } catch (_) {}
  }
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.webContents.send('service-health:closed');
  }
}

function ensureHealthDropdownWindow() {
  if (healthDropdownWindow && !healthDropdownWindow.isDestroyed()) {
    return healthDropdownWindow;
  }
  healthDropdownWindow = new BrowserWindow({
    width: HEALTH_DROPDOWN_WIDTH,
    height: HEALTH_DROPDOWN_HEIGHT,
    parent: chatWindow,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: false,
    webPreferences: {
      preload: path.join(__dirname, 'healthDropdownPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  healthDropdownWindow.loadFile(path.join(__dirname, '..', 'renderer', 'health-dropdown.html'));
  healthDropdownWindow.webContents.once('did-finish-load', () => {
    syncHealthDropdownData();
  });
  healthDropdownWindow.on('blur', () => {
    hideHealthDropdown();
  });
  return healthDropdownWindow;
}

function syncHealthDropdownData() {
  if (!healthDropdownWindow || healthDropdownWindow.isDestroyed()) return;
  try {
    const current = settings.load();
    const snap = orchestrator?.latestSnapshot || null;
    const mcpRunning = Boolean(snap?.status?.runtimeRunning || snap?.status?.mcpRunning);
    const tunnelRunning = Boolean(snap?.status?.tunnelRunning || snap?.status?.connectionRunning);
    healthDropdownWindow.webContents.send('service-health:data', {
      mcpRunning,
      tunnelRunning,
      theme: current.theme
    });

    // 后台静默刷新一次最新轻量快照，确保数据 100% 鲜活且绝不卡顿主线程
    orchestrator?.lightweightSnapshot?.().then((latest) => {
      if (healthDropdownWindow && !healthDropdownWindow.isDestroyed()) {
        healthDropdownWindow.webContents.send('service-health:data', {
          mcpRunning: Boolean(latest?.status?.mcpRunning),
          tunnelRunning: Boolean(latest?.status?.tunnelRunning),
          theme: settings.load().theme
        });
      }
    }).catch(() => {});
  } catch (_) {}
}

/* 原 openManagerWindow() 在此删除。
 * 它创建的是一个独立的无边框 BrowserWindow（frame:false / skipTaskbar /
 * 居中浮动 / 980×720），也就是"设置是单独一个界面"的根源。
 * 第 22 轮合并后，设置改为主窗口内的一个全尺寸原生视图（见 createSettingsView），
 * 不再需要第二个窗口，故整段移除。 */

function registerIpc() {
  /* 第 30 轮（用户第 6 条「把 v0.2.4 这种去掉，应用的信息要单独一个模块」）：
   *
   * 原状是 index.html 里写死的字面量 `<h3>网页 MCP 助手 <span>v0.2.4</span></h3>` ——
   * 仓库里没有第二条通路能把真实版本送进渲染层。写死的版本号最大的问题是
   * **它会撒谎**：package.json 改了版本，界面上还是旧数字，而且看起来完全正常。
   *
   * 版本号现在由 orchestrator 随快照带出（见 services/runtimeOrchestrator.js
   * 的 constructor 与 _collectSnapshot），这里不再额外装饰 ——
   * 曾把 appVersion 加在这一层，真机实测漏了：初始渲染走
   * emitStatus → 'runtime:status-changed'，不经过 IPC，
   * 首屏版本号会一直空着，要手动 refresh 才有值。 */
  secureHandle('app:snapshot', (_event, options) => invokeSafely(() => orchestrator.snapshot(options || {})));
  secureHandle('app:lightweight-snapshot', () => invokeSafely(() => orchestrator.lightweightSnapshot()));
  secureHandle('app:check-for-updates', () => invokeSafely(() => checkForUpdatesManually()));
  secureHandle('workspace:hub', () => invokeSafely(async () => { const current = settings.load(); return { activeWorkspace: current.workspace, recentWorkspaces: current.recentWorkspaces || [] }; }));
  secureHandle('workspace:switch', (_event, workspace) => invokeSafely(async () => {
    const result = await orchestrator.switchWorkspace(workspace);
    invalidateLocalMcpDiscovery();
    taskNotificationService?.reset();
    taskNotificationService?.restartStream();
    if (chatWindow && !chatWindow.isDestroyed()) {
      chatWindow.webContents.send('workspace:changed', workspace);
    }
    sendManager('workspace:changed', workspace);
    syncWorkspaceDropdownData();
    return result;
  }));
  secureHandle('workspace:authorized-roots', (_event, roots) => invokeSafely(() => orchestrator.updateAuthorizedRoots(roots)));
  secureHandle('workspace:choose-authorized-root', () => invokeSafely(async () => {
    if (isDirectoryDialogOpen) return null;
    isDirectoryDialogOpen = true;
    try {
      const result = await dialog.showOpenDialog(chatWindow, { properties: ['openDirectory', 'createDirectory'] });
      if (result.canceled || !result.filePaths[0]) return null;
      const selected = path.resolve(result.filePaths[0]);
      const current = settings.load();
      const roots = Array.isArray(current.authorizedRoots) ? current.authorizedRoots : [];
      const key = selected.toLowerCase();
      const merged = roots.some((item) => String(item).toLowerCase() === key) ? roots : [...roots, selected];
      const snapshot = await orchestrator.updateAuthorizedRoots(merged);
      return { selected, snapshot };
    } finally {
      isDirectoryDialogOpen = false;
    }
  }));
  secureHandle('task-state:read', () => invokeSafely(async () => {
    let statePath;
    try { ({ statePath } = workspaceStatePaths()); } catch { return { exists: false, state: null }; }
    try {
      const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
      return { exists: true, statePath, state };
    } catch (error) {
      if (error?.code === 'ENOENT') return { exists: false, statePath, state: null };
      throw new Error(`任务状态读取失败：${safeMessage(error)}`);
    }
  }));
  secureHandle('task-state:clear', () => invokeSafely(async () => {
    let paths;
    try { paths = workspaceStatePaths(); } catch { return false; }
    const { statePath, historyPath } = paths;
    archiveTask(readJson(statePath, null), historyPath, 'cleared-from-assistant');
    await fs.unlink(statePath).catch((error) => { if (error?.code !== 'ENOENT') throw error; });
    return true;
  }));
  secureHandle('task-state:pause', () => invokeSafely(async () => {
    const { statePath } = workspaceStatePaths();
    const state = readJson(statePath, null); if (!state) throw new Error('当前没有可暂停的任务。');
    state.status = 'paused'; state.pause_reason = '用户从助手暂停'; state.updated_at = new Date().toISOString();
    writeJsonAtomic(statePath, state); return state;
  }));
  secureHandle('task-state:resume', () => invokeSafely(async () => {
    const { statePath } = workspaceStatePaths();
    const state = readJson(statePath, null); if (!state) throw new Error('当前没有可继续的任务。');
    state.status = 'active'; state.pause_reason = ''; state.updated_at = new Date().toISOString();
    writeJsonAtomic(statePath, state); return state;
  }));
  secureHandle('task-state:stop', () => invokeSafely(async () => {
    const { statePath } = workspaceStatePaths();
    const state = readJson(statePath, null); if (!state) throw new Error('当前没有可停止的任务。');
    state.status = 'stopped'; state.failure = '用户从助手停止任务';
    state.next_step = state.next_step || '确认后继续当前任务，或开始新任务。';
    state.updated_at = new Date().toISOString();
    writeJsonAtomic(statePath, state); return state;
  }));
  secureHandle('task-state:history', () => invokeSafely(async () => {
    let historyPath;
    try { ({ historyPath } = workspaceStatePaths()); } catch { return []; }
    try { const value = JSON.parse(await fs.readFile(historyPath, 'utf8')); return Array.isArray(value) ? value.slice(-50).reverse() : []; }
    catch (error) { if (error?.code === 'ENOENT') return []; throw error; }
  }));
  /* 第 28 轮（用户第 3 条「历史任务不能怎么搞，而且可以隐藏或者删除」）：
   * 给历史记录加两个写操作。两点设计取舍：
   *
   * ① 为什么按 task_id 匹配而不是按数组下标：
   *    列表在 renderer 侧是**倒序展示**的（上面那行 .reverse()），
   *    下标是"视图序"而非"存储序"。若把视图下标传回来删，
   *    一旦渲染与点击之间又归档了一条新任务，就会删错对象。
   *    task_id 是存储里就在的稳定键，与展示顺序无关。
   *    没有 task_id 的旧记录退回用 archived_at 比对（两者都缺则跳过该条）。
   *
   * ② 为什么每次重读文件再写，而不是把整个列表回传：
   *    task-history.json 有**两个写入方** —— 这个进程，
   *    以及本地工具（resources/coding-tools-mcp 的 TaskStateStore._archive）。
   *    renderer 手里的列表可能已经过期；若用它的副本整体覆盖，
   *    会静默丢掉 MCP 侧在此期间新归档的记录。
   *    所以这里以磁盘为准做"读-改-写"，renderer 只负责说"删哪一条"。
   *
   * 两者都走 updateJsonAtomic（内部是临时文件 + fsync + rename，失败时保留 .bak），
   * 与 archiveTask 用的是同一套原子写，不存在半截文件。 */
  const historyKeyOf = (item) => {
    if (!item || typeof item !== 'object') return null;
    const id = String(item.task_id ?? '').trim();
    if (id) return `id:${id}`;
    const at = String(item.archived_at ?? '').trim();
    return at ? `at:${at}` : null;
  };
  secureHandle('task-state:history-remove', (_event, key) => invokeSafely(async () => {
    const wanted = String(key ?? '').trim();
    if (!wanted) throw new Error('缺少要删除的历史任务标识。');
    const { historyPath } = workspaceStatePaths();
    const items = readJson(historyPath, []);
    if (!Array.isArray(items)) return 0;
    const kept = items.filter((item) => historyKeyOf(item) !== wanted);
    const removed = items.length - kept.length;
    if (removed > 0) writeJsonAtomic(historyPath, kept);
    return removed;
  }));
  secureHandle('task-state:history-clear', () => invokeSafely(async () => {
    let historyPath;
    try { ({ historyPath } = workspaceStatePaths()); } catch { return 0; }
    const items = readJson(historyPath, []);
    const count = Array.isArray(items) ? items.length : 0;
    if (count > 0) await fs.rm(historyPath, { force: true });
    return count;
  }));
  secureHandle('performance:read', () => invokeSafely(async () => {
    let performancePath;
    try { ({ performancePath } = workspaceStatePaths()); } catch { return null; }
    try { return JSON.parse(await fs.readFile(performancePath, 'utf8')); }
    catch (error) { if (error?.code === 'ENOENT') return null; throw error; }
  }));
  secureHandle('performance:clear', () => invokeSafely(async () => {
    const { performancePath } = workspaceStatePaths();
    await fs.rm(performancePath, { force: true });
    return true;
  }));
  secureHandle('mcp:workspace-context', () => invokeSafely(() => callLocalMcpTool('workspace_context', { detail: 'compact', max_entries: 80 })));
  secureHandle('mcp:coding-tools-guide', (_event, options) => invokeSafely(() => callLocalMcpTool('coding_tools_guide', options || {})));
  secureHandle('mcp:task-runtime', (_event, options = {}) => invokeSafely(() => callLocalMcpTool('task_control', {
    action: 'get',
    detail: String(options?.detail || 'compact') === 'full' ? 'full' : 'compact'
  })));
  secureHandle('mcp:task-worktrees', () => invokeSafely(() => callLocalMcpTool('task_control', { action: 'worktree_list' })));
  secureHandle('mcp:task-worktree-diff', (_event, runId) => invokeSafely(() => callLocalMcpTool('task_control', { action: 'worktree_diff', run_id: String(runId || ''), max_bytes: 262144 })));
  secureHandle('mcp:task-worktree-apply', (_event, runId) => invokeSafely(() => callLocalMcpTool('task_control', { action: 'worktree_apply', run_id: String(runId || '') })));
  secureHandle('mcp:task-worktree-discard', (_event, runId) => invokeSafely(() => callLocalMcpTool('task_control', { action: 'worktree_discard', run_id: String(runId || '') })));
  /* 长期记忆。写操作只允许桌面通道 —— LocalMcpClient 的每个请求都带
   * X-Coding-Tools-Origin: desktop（见 services/localMcpClient.js），运行时的
   * memory_control 据此拒绝模型通道的 confirm/update/delete/set_config。
   * 所以这里不需要再做一次判定，只需要把参数原样透传。 */
  secureHandle('memory:config', () => invokeSafely(() => callLocalMcpTool('memory_control', { action: 'config' })));
  secureHandle('memory:list', (_event, options = {}) => invokeSafely(() => callLocalMcpTool('memory_control', memoryListArgs(options))));
  secureHandle('memory:search', (_event, options = {}) => invokeSafely(() => callLocalMcpTool('memory_control', memorySearchArgs(options))));
  secureHandle('memory:candidates', () => invokeSafely(() => callLocalMcpTool('memory_control', { action: 'candidates' })));
  secureHandle('memory:confirm', (_event, payload = {}) => invokeSafely(() => callLocalMcpTool('memory_control', memoryConfirmArgs(payload))));
  secureHandle('memory:reject', (_event, candidateId) => invokeSafely(() => callLocalMcpTool('memory_control', memoryRejectArgs(candidateId))));
  secureHandle('memory:create', (_event, payload = {}) => invokeSafely(() => callLocalMcpTool('memory_control', memoryCreateArgs(payload))));
  secureHandle('memory:update', (_event, payload = {}) => invokeSafely(() => callLocalMcpTool('memory_control', memoryUpdateArgs(payload))));
  secureHandle('memory:archive', (_event, memoryId) => invokeSafely(() => callLocalMcpTool('memory_control', memoryIdArgs('archive', memoryId))));
  secureHandle('memory:delete', (_event, memoryId) => invokeSafely(() => callLocalMcpTool('memory_control', memoryIdArgs('delete', memoryId))));
  secureHandle('memory:set-config', (_event, payload = {}) => invokeSafely(() => callLocalMcpTool('memory_control', memorySetConfigArgs(payload))));
  secureHandle('memory:choose-export-path', () => invokeSafely(async () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const win = BrowserWindow.getFocusedWindow() || chatWindow || null;
    const result = await dialog.showSaveDialog(win, {
      title: '导出记忆备份',
      defaultPath: `mika-memory-${stamp}.zip`,
      filters: [{ name: 'ZIP 压缩包', extensions: ['zip'] }]
    });
    return result.canceled || !result.filePath ? null : { target: result.filePath };
  }));
  secureHandle('memory:choose-import-path', () => invokeSafely(async () => {
    const win = BrowserWindow.getFocusedWindow() || chatWindow || null;
    const result = await dialog.showOpenDialog(win, {
      title: '选择记忆备份',
      properties: ['openFile'],
      filters: [{ name: 'ZIP 压缩包', extensions: ['zip'] }]
    });
    return result.canceled || !result.filePaths?.length ? null : { source: result.filePaths[0] };
  }));
  secureHandle('memory:export', (_event, target) => invokeSafely(() => callLocalMcpTool('memory_control', memoryExportArgs(target))));
  secureHandle('memory:import', (_event, source) => invokeSafely(() => callLocalMcpTool('memory_control', memoryImportArgs(source))));
  secureHandle('memory:revisions', (_event, memoryId) => invokeSafely(() => callLocalMcpTool('memory_control', memoryIdArgs('revision_history', memoryId))));
  secureHandle('memory:restore-revision', (_event, payload = {}) => invokeSafely(() => callLocalMcpTool('memory_control', memoryRestoreRevisionArgs(payload))));
  secureHandle('memory:rebuild-index', () => invokeSafely(() => callLocalMcpTool('memory_control', { action: 'rebuild_index' })));
  secureHandle('memory:open-folder', () => invokeSafely(async () => {
    const currentWs = String(settings.load().workspace || '').trim();
    if (!currentWs) {
      throw new Error('未设置当前工作区，暂无记忆目录可供打开。');
    }
    const memDir = path.join(currentWs, '.coding-tools', 'memory');
    if (!fsSync.existsSync(memDir)) {
      throw new Error('当前暂无记忆文件，本地尚未创建记忆目录。');
    }
    const entries = await fs.readdir(memDir).catch(() => []);
    const validFiles = entries.filter((name) => !name.startsWith('.') && name !== '__pycache__');
    if (validFiles.length === 0) {
      throw new Error('记忆目录为空，暂无可查看的记忆文件。');
    }
    const failure = await shell.openPath(memDir);
    if (failure) throw new Error(`打开记忆文件夹失败：${failure}`);
    return { opened: true, root: memDir };
  }));
  secureHandle('notification:test', () => invokeSafely(() => taskNotificationService?.testNotification() ?? false));
  secureHandle('notification:play-beep', () => invokeSafely(async () => {
    shell.beep();
    return true;
  }));
  secureHandle('build:inspect', () => invokeSafely(() => buildVerification.inspect(settings.load().workspace)));
  secureHandle('build:run', (_event, options) => invokeSafely(() => buildVerification.execute(settings.load().workspace, options || {})));
  secureHandle('health:inspect', () => invokeSafely(() => healthService.inspect()));
  secureHandle('health:repair', () => invokeSafely(() => healthService.repair()));
  secureHandle('workspace:choose-and-switch', () => invokeSafely(async () => {
    if (isDirectoryDialogOpen) return null;
    isDirectoryDialogOpen = true;
    try {
      const result = await dialog.showOpenDialog(chatWindow, { properties: ['openDirectory', 'createDirectory'] });
      if (result.canceled) return null;
      const targetPath = result.filePaths[0];
      const switched = await orchestrator.switchWorkspace(targetPath);
      invalidateLocalMcpDiscovery();
      taskNotificationService?.reset();
      taskNotificationService?.restartStream();
      if (chatWindow && !chatWindow.isDestroyed()) {
        chatWindow.webContents.send('workspace:changed', targetPath);
      }
      sendManager('workspace:changed', targetPath);
      syncWorkspaceDropdownData();
      return switched;
    } finally {
      isDirectoryDialogOpen = false;
    }
  }));
  secureHandle('manager:close', () => invokeSafely(async () => closeSettingsSurface()));
  secureHandle('manager:open', (_event, targetPage) => invokeSafely(async () => openSettingsSurface(targetPage)));

  /* 第 44 轮：自绘窗口按钮（titleBarOverlay 已移除）需要这几个动作。
   * 语义与原生按钮严格对齐：
   *   - 最小化 → chatWindow.minimize()
   *   - 最大化/还原 → 切换（渲染层按返回的 maximized 换图标）
   *   - 关闭 → chatWindow.close()，**必须走 close() 而非 destroy()**，
   *     这样才会触发既有的 close 事件处理（托盘/退出策略），与点原生关闭按钮等价。 */
  secureHandle('window:minimize', () => invokeSafely(async () => {
    if (chatWindow && !chatWindow.isDestroyed()) chatWindow.minimize();
    return true;
  }));
  secureHandle('window:toggle-maximize', () => invokeSafely(async () => {
    if (!chatWindow || chatWindow.isDestroyed()) return { maximized: false };
    if (chatWindow.isMaximized()) chatWindow.unmaximize();
    else chatWindow.maximize();
    return { maximized: chatWindow.isMaximized() };
  }));
  secureHandle('window:close', () => invokeSafely(async () => {
    if (chatWindow && !chatWindow.isDestroyed()) chatWindow.close();
    return true;
  }));
  secureHandle('app:quit-completely', () => invokeSafely(async () => {
    forceQuit = true;
    app.quit();
    return true;
  }));
  secureHandle('window:is-maximized', () => invokeSafely(async () => ({
    maximized: Boolean(chatWindow && !chatWindow.isDestroyed() && chatWindow.isMaximized())
  })));
  secureHandle('workspace:remove', (_event, targetPath) => invokeSafely(async () => {
    const wanted = String(targetPath || '').trim();
    if (!wanted) throw new Error('缺少要移除的工作区路径。');
    const current = settings.load();
    const normalizeKey = (p) => {
      const s = String(p || '').trim().replace(/[\\/]+$/, '');
      return process.platform === 'win32' ? s.toLowerCase().replace(/\//g, '\\') : s;
    };
    const targetKey = normalizeKey(wanted);
    const kept = (current.recentWorkspaces || []).filter((item) => {
      return normalizeKey(item) !== targetKey;
    });
    const isActiveTarget = normalizeKey(current.workspace) === targetKey;

    if (isActiveTarget) {
      if (kept.length > 0) {
        const nextWorkspace = kept[0];
        try {
          await orchestrator.switchWorkspace(nextWorkspace);
        } catch {
          settings.save({ workspace: nextWorkspace });
        }
        settings.save({ recentWorkspaces: kept });
      } else {
        settings.save({ workspace: '', recentWorkspaces: [] });
        try {
          if (orchestrator) {
            await orchestrator.stop();
          }
        } catch (_) {}
      }
    } else {
      settings.save({ recentWorkspaces: kept });
    }

    const finalCurrent = settings.load();
    invalidateLocalMcpDiscovery();
    taskNotificationService?.reset();
    taskNotificationService?.restartStream();
    if (chatWindow && !chatWindow.isDestroyed()) {
      chatWindow.webContents.send('workspace:changed', finalCurrent.workspace);
    }
    sendManager('workspace:changed', finalCurrent.workspace);
    syncWorkspaceDropdownData();
    return { activeWorkspace: finalCurrent.workspace, recentWorkspaces: finalCurrent.recentWorkspaces || [] };
  }));

  secureHandle('workspace:popup-dropdown', (_event, rect) => invokeSafely(() => withDropdownQueue(async () => {
    if (!chatWindow || chatWindow.isDestroyed()) return false;
    hideHealthDropdown();
    isDropdownPopupRequested = true;
    const win = ensureWorkspaceDropdownWindow();
    const current = settings.load();
    const winBounds = chatWindow.getContentBounds();
    const winW = WORKSPACE_DROPDOWN_WIDTH;
    const x = Math.round(winBounds.x + Number(rect?.x || 0) - 8);
    const y = Math.round(winBounds.y + Number(rect?.y || 0) - 2);

    const recentCount = Array.isArray(current.recentWorkspaces) ? current.recentWorkspaces.length : 0;
    const targetH = cachedWorkspaceDropdownHeight || estimateWorkspaceDropdownHeight(recentCount);

    // 1. 原子调整位置与准确高度（如已贴合则不重复触发 Win32 重绘）
    const curBounds = win.getBounds();
    if (curBounds.x !== x || curBounds.y !== y || curBounds.width !== winW || curBounds.height !== targetH) {
      win.setBounds({ x, y, width: winW, height: targetH }, false);
    }

    // 2. 在展现前先行同步数据，杜绝窗口显示后清空重建 DOM 导致的闪烁
    const payload = {
      activeWorkspace: current.workspace,
      recentWorkspaces: current.recentWorkspaces || [],
      theme: current.theme
    };

    const sendPayload = () => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('dropdown:data', payload);
      }
    };

    if (win.webContents.isLoading()) {
      win.webContents.once('did-finish-load', sendPayload);
    } else {
      sendPayload();
    }

    // 3. 展现窗口（防闪：等首帧内容就绪后再揭示；已存活窗口靠 setOpacity 揭示，不触发 DWM 重建）
    const showNow = () => revealDropdown(win, x, y, winW, targetH);
    if (win.webContents.isLoading()) {
      win.webContents.once('did-finish-load', showNow);
    } else {
      showNow();
    }

    return true;
  })));
  const adjustDropdownHeight = (actualHeight) => {
    if (!workspaceDropdownWindow || workspaceDropdownWindow.isDestroyed()) return;
    const h = Number(actualHeight);
    if (h && h > 100) {
      const targetH = Math.min(640, Math.ceil(h) + 4);
      cachedWorkspaceDropdownHeight = targetH;
      // 关键防抖动与防闪烁策略：当窗口已处于用户眼前可见状态时，绝不二次调用 setBounds！
      // 测量高度只作为缓存供下次打开使用，绝不在用户眼皮底下动态拉伸窗口！
      if (!workspaceDropdownWindow.isVisible()) {
        const bounds = workspaceDropdownWindow.getBounds();
        workspaceDropdownWindow.setBounds({
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: targetH
        }, false);
      }
    }
  };
  secureHandle('dropdown:ready', (_event, actualHeight) => invokeSafely(async () => {
    adjustDropdownHeight(actualHeight);
    return true;
  }));
  secureHandle('dropdown:get-data', () => invokeSafely(async () => {
    const current = settings.load();
    return {
      activeWorkspace: current.workspace,
      recentWorkspaces: current.recentWorkspaces || [],
      theme: current.theme
    };
  }));
  secureHandle('dropdown:height', (_event, actualHeight) => invokeSafely(async () => {
    adjustDropdownHeight(actualHeight);
    return true;
  }));
  secureHandle('dropdown:switch', (_event, targetPath) => invokeSafely(async () => {
    const switched = await orchestrator.switchWorkspace(targetPath);
    invalidateLocalMcpDiscovery();
    taskNotificationService?.reset();
    taskNotificationService?.restartStream();
    if (chatWindow && !chatWindow.isDestroyed()) {
      chatWindow.webContents.send('workspace:changed', targetPath);
    }
    sendManager('workspace:changed', targetPath);
    return switched;
  }));
  secureHandle('dropdown:manage', () => invokeSafely(async () => {
    hideWorkspaceDropdown();
    openSettingsSurface('workspace');
    return true;
  }));
  /* ★ 防频闪：关闭也必须与打开共用同一条串行队列。
   * 之前只把两个 popup 进了队列，而 close 走的是独立通道 ——
   * 于是「打开」与「关闭」仍然会交错执行（show → hide → show → hide），
   * 用户在高频连点时看到的就是窗口反复闪现。
   * 现在 open/close 全部串行化，任何时刻只可能有一个窗口操作在飞。 */
  secureHandle('dropdown:close', () => invokeSafely(() => withDropdownQueue(async () => {
    hideWorkspaceDropdown();
    return true;
  })));

  // ── 服务健康状态浮层相关安全IPC ──
  secureHandle('service-health:popup', (_event, rect) => invokeSafely(() => withDropdownQueue(async () => {
    if (!chatWindow || chatWindow.isDestroyed()) return false;
    hideWorkspaceDropdown();

    const win = ensureHealthDropdownWindow();
    const winBounds = chatWindow.getContentBounds();
    const winW = HEALTH_DROPDOWN_WIDTH;
    const targetH = HEALTH_DROPDOWN_HEIGHT;

    // 定位算法：右对齐到胶囊按钮右端并保留微呼吸边距
    let x = Math.round(winBounds.x + Number(rect?.x || 0) + Number(rect?.width || 0) - winW);
    // 严格防溢出保护：确保不超出主窗口左右边界
    const minX = winBounds.x + 12;
    const maxX = winBounds.x + winBounds.width - winW - 12;
    x = Math.max(minX, Math.min(maxX, x));

    // 纵向定位：紧贴胶囊按钮下沿并留出 5px 缝隙，绝不与顶栏遮叠
    const y = Math.round(winBounds.y + Number(rect?.y || 0) + Number(rect?.height || 0) + 5);

    // 关键防频闪：如果坐标与尺寸完全一致，绝不在 Windows 上重复调用 setBounds（避免 DWM 透明层重建白屏闪烁）
    const curBounds = win.getBounds();
    if (curBounds.x !== x || curBounds.y !== y || curBounds.width !== winW || curBounds.height !== targetH) {
      win.setBounds({ x, y, width: winW, height: targetH }, false);
    }
    syncHealthDropdownData();
    revealDropdown(win, x, y, winW, targetH);
    return true;
  })));

  /* ★ 防频闪：健康浮层的关闭同样必须接入同一条串行队列。
   * 否则「打开工作区（show）→ 关闭健康（hide）→ 打开健康（show）」仍会因交错
   * 出现两个浮层同显的闪烁。与 workspace 的 dropdown:close 保持同一处理路径。 */
  secureHandle('service-health:close', () => invokeSafely(() => withDropdownQueue(async () => {
    hideHealthDropdown();
    return true;
  })));

  secureHandle('service-health:get-data', () => invokeSafely(async () => {
    const snap = orchestrator?.latestSnapshot || null;
    const current = settings.load();
    return {
      mcpRunning: Boolean(snap?.status?.runtimeRunning || snap?.status?.mcpRunning),
      tunnelRunning: Boolean(snap?.status?.tunnelRunning || snap?.status?.connectionRunning),
      theme: current.theme
    };
  }));

  secureHandle('service-health:height', () => invokeSafely(async () => {
    // 固定标准高度体系，绝不在用户眼皮底下动态重绘 setBounds，彻底杜绝 DWM 透明频闪
    return true;
  }));

  secureHandle('service-health:start', () => invokeSafely(async () => {
    const result = await orchestrator.start();
    invalidateLocalMcpDiscovery();
    await syncHealthDropdownData();
    const status = await orchestrator.supervise().catch(() => null);
    if (status && chatWindow && !chatWindow.isDestroyed()) {
      chatWindow.webContents.send('runtime:heartbeat', status);
    }
    return result;
  }));

  secureHandle('service-health:restart', () => invokeSafely(async () => {
    const result = await orchestrator.restart();
    invalidateLocalMcpDiscovery();
    await syncHealthDropdownData();
    const status = await orchestrator.supervise().catch(() => null);
    if (status && chatWindow && !chatWindow.isDestroyed()) {
      chatWindow.webContents.send('runtime:heartbeat', status);
    }
    return result;
  }));

  secureHandle('service-health:open-settings', (_event, targetPage) => invokeSafely(async () => {
    hideHealthDropdown();
    openSettingsSurface(targetPage || 'overview');
    return true;
  }));
  secureHandle('workspace:popup-menu', (_event, rect) => invokeSafely(async () => {
    return new Promise((resolve) => {
      const current = settings.load();
      const activeWorkspace = String(current.workspace || '').trim();
      const rawRecent = Array.isArray(current.recentWorkspaces) ? current.recentWorkspaces : [];

      const seen = new Set();
      const list = [];
      if (activeWorkspace) {
        seen.add(process.platform === 'win32' ? activeWorkspace.toLowerCase() : activeWorkspace);
        list.push({ path: activeWorkspace, isActive: true });
      }
      for (const item of rawRecent) {
        const p = String(item || '').trim();
        if (!p) continue;
        const k = process.platform === 'win32' ? p.toLowerCase() : p;
        if (seen.has(k)) continue;
        seen.add(k);
        list.push({ path: p, isActive: false });
      }

      const projectName = activeWorkspace ? extractWorkspaceName(activeWorkspace) : '尚未选择项目';

      const template = [
        { label: `当前项目：${projectName}`, enabled: false },
        { label: `📁 ${activeWorkspace || '尚未选择目录'}`, enabled: false },
        { type: 'separator' },
        { label: '工作区列表：', enabled: false }
      ];

      if (!list.length) {
        template.push({ label: '  (暂无工作区)', enabled: false });
      } else {
        list.forEach((item) => {
          const name = extractWorkspaceName(item.path);
          template.push({
            label: `${name}${item.isActive ? '   (当前)' : ''}`,
            type: 'checkbox',
            checked: item.isActive,
            click: async () => {
              if (!item.isActive) {
                try {
                  await orchestrator.switchWorkspace(item.path);
                  invalidateLocalMcpDiscovery();
                  taskNotificationService?.reset();
                  taskNotificationService?.restartStream();
                  if (chatWindow && !chatWindow.isDestroyed()) {
                    chatWindow.webContents.send('workspace:changed', item.path);
                  }
                  sendManager('workspace:changed', item.path);
                } catch (err) {
                  log.error(safeMessage(err), { stage: 'popup-menu-switch-workspace' });
                }
              }
            }
          });
        });
      }

      template.push({ type: 'separator' });
      template.push({
        label: '⚙ 管理工作区…',
        click: () => {
          openSettingsSurface('workspace');
        }
      });

      const menu = Menu.buildFromTemplate(template);
      const posX = typeof rect?.x === 'number' ? Math.round(rect.x) : undefined;
      const posY = typeof rect?.y === 'number' ? Math.round(rect.y) : undefined;

      menu.popup({
        window: chatWindow,
        x: posX,
        y: posY,
        callback: () => resolve(true)
      });
    });
  }));
  secureHandle('chat:navigate', (_event, action) => invokeSafely(async () => chatController?.navigate(action)));
  secureHandle('chat:status', () => invokeSafely(async () => chatController?.getState() || null));
  secureHandle('chat:auth-status', () => invokeSafely(async () => {
    if (!chatController) return { loggedIn: false, reason: 'not_initialized' };
    return chatController.checkAuthStatus();
  }));
  secureHandle('chat:clear-session', () => invokeSafely(async () => {
    if (!chatController) throw new Error('ChatGPT 页面尚未初始化。');
    await chatController.clearSession();
    return true;
  }));
  secureHandle('dialog:workspace', () => invokeSafely(async () => {
    if (isDirectoryDialogOpen) return '';
    isDirectoryDialogOpen = true;
    try {
      const result = await dialog.showOpenDialog(chatWindow, { properties: ['openDirectory', 'createDirectory'] });
      return result.canceled ? '' : result.filePaths[0];
    } finally {
      isDirectoryDialogOpen = false;
    }
  }));
  secureHandle('settings:save', (_event, patch) => invokeSafely(async () => {
    const allowed = ['workspace', 'permissionMode', 'mcpPort', 'healthPort', 'proxyMode', 'proxyUrl', 'tunnelId', 'startWithWindows', 'autoStartServices', 'keepRunningOnClose', 'closeAction', 'showTrayIcon', 'progressReportSeconds', 'taskNotifications', 'taskNotificationSound', 'theme', 'developerMode', 'guideProgress', 'firstRunCompleted', 'bridgeRemovedNotice', 'recentWorkspaces', 'customAccentColor', 'customTone'];
    const clean = Object.fromEntries(Object.entries(patch || {}).filter(([key]) => allowed.includes(key)));
    // 通道 ID 属敏感凭据，统一使用 Windows DPAPI 加密存入 SecretStore，防止明文落盘 settings.json
    if (Object.hasOwn(clean, 'tunnelId')) {
      const targetTunnelId = String(clean.tunnelId || '').trim();
      if (targetTunnelId) {
        secrets.set('tunnelId', targetTunnelId);
      } else {
        secrets.remove('tunnelId');
      }
      delete clean.tunnelId;
    }
    const prev = settings.load();
    const saved = settings.save(clean);
    // 内存中带回解密后的 tunnelId 供渲染层继续响应与使用
    saved.tunnelId = secrets.get('tunnelId');
    if (Object.hasOwn(clean, 'startWithWindows') && Boolean(clean.startWithWindows) !== Boolean(prev.startWithWindows)) {
      app.setLoginItemSettings({ openAtLogin: Boolean(saved.startWithWindows), path: process.execPath });
    }
    if (Object.hasOwn(clean, 'showTrayIcon') && Boolean(clean.showTrayIcon) !== Boolean(prev.showTrayIcon)) {
      if (saved.showTrayIcon) {
        createTray();
      } else if (tray && !tray.isDestroyed()) {
        tray.destroy();
        tray = null;
      }
    }
    if (Object.hasOwn(clean, 'theme') && clean.theme !== prev.theme) {
      syncTitleBarOverlay(saved.theme);
    }
    if (Object.hasOwn(clean, 'mcpPort') && clean.mcpPort !== prev.mcpPort) taskNotificationService?.restartStream();
    if (Object.hasOwn(clean, 'proxyMode') || Object.hasOwn(clean, 'proxyUrl')) clearProxyCache();
    return saved;
  }));
  secureHandle('theme:sync-titlebar', (_event, theme) => invokeSafely(async () => {
    syncTitleBarOverlay(theme);
    return true;
  }));

  /* 聊天页上报主题偏好。
   * 来由：browser.css 里早就写好了一整套 `[data-theme="dark"]` 规则，但
   * data-theme 从来没人写过 —— 因为聊天页与设置页是两个独立文档，设置页那条
   * （theme-bootstrap.js + applyTheme）走不到聊天页，聊天页也一直没有上报通道。
   * 于是深色下聊天页永久白底，整套暗色规则成了死代码。
   *
   * 语义与设置页的 themeSelect 完全一致，只有三档；落库后由
   * syncTitleBarOverlay 统一驱动原生标题栏与 nativeTheme，保证两处不各说各话。
   * 显式传 chosen（而非依赖 settings:update 的变更检测）——用户在已经是深色时
   * 再点一次深色，也要能把标题栏纠正回来。 */
  secureHandle('theme', (_event, theme) => invokeSafely(async () => {
    const chosen = (theme === 'light' || theme === 'dark' || theme === 'system') ? theme : 'dark';
    const saved = settings.save({ theme: chosen });
    syncTitleBarOverlay(chosen);
    return { theme: saved.theme };
  }));
  secureHandle('environment:detect-proxy', () => invokeSafely(async () => resolveProxy(settings.load(), { force: true })));
  secureHandle('secrets:runtime-key', (_event, value) => invokeSafely(async () => {
    if (String(value || '').trim().length < 12) throw new Error('Runtime API Key 长度不正确。');
    secrets.set('runtimeApiKey', value);
    return secrets.status();
  }));
  secureHandle('secrets:runtime-key-remove', () => invokeSafely(async () => {
    secrets.remove('runtimeApiKey');
    return secrets.status();
  }));
  secureHandle('secrets:mcp-token-regenerate', () => invokeSafely(async () => {
    secrets.set('mcpAuthToken', crypto.randomBytes(32).toString('base64url'));
    return secrets.status();
  }));
  secureHandle('runtime:start', () => invokeSafely(async () => { const result = await orchestrator.start(); invalidateLocalMcpDiscovery(); return result; }));
  secureHandle('runtime:stop', () => invokeSafely(async () => { const result = await orchestrator.stop(); invalidateLocalMcpDiscovery(); return result; }));
  secureHandle('runtime:restart', () => invokeSafely(async () => { const result = await orchestrator.restart(); invalidateLocalMcpDiscovery(); return result; }));
  secureHandle('logs:read', () => invokeSafely(async () => log.read()));
  secureHandle('logs:clear', () => invokeSafely(async () => { log.clear(); return true; }));
  secureHandle('environment:install-python', () => invokeSafely(async () => {
    const result = await run('winget.exe', ['install', '--id', 'Python.Python.3.12', '-e', '--accept-source-agreements', '--accept-package-agreements']);
    return result.stdout;
  }));
  secureHandle('shell:open', (_event, target) => invokeSafely(async () => {
    const allowed = new Set(['chatgpt-connectors', 'openai-tunnels', 'openai-runtime-keys', 'tunnel-ui', 'coding-tools-source']);
    if (!allowed.has(target)) throw new Error('不允许打开该地址。');
    if (target === 'chatgpt-connectors' && chatController) {
      await chatController.openUrl('https://chatgpt.com/#settings/Connectors');
      if (chatWindow && !chatWindow.isDestroyed()) {
        chatWindow.show();
        chatWindow.focus();
      }
      return true;
    }
    const current = settings.load();
    const urls = {
      'chatgpt-connectors': 'https://chatgpt.com/#settings/Connectors',
      'openai-tunnels': 'https://platform.openai.com/settings/organization/tunnels',
      'openai-runtime-keys': 'https://platform.openai.com/settings/organization/api-keys',
      'tunnel-ui': `http://127.0.0.1:${current.healthPort}/ui`,
      'coding-tools-source': 'https://github.com/xyTom/coding-tools-mcp'
    };
    await shell.openExternal(urls[target]);
    return true;
  }));

  // 技能（Skills）相关 IPC 通道
  secureHandle('skills:list', () => invokeSafely(async () => skillStore.list()));
  secureHandle('skills:save', (_event, skill) => invokeSafely(async () => skillStore.saveSkill(skill)));
  secureHandle('skills:delete', (_event, id) => invokeSafely(async () => skillStore.deleteSkill(id)));
  secureHandle('skills:toggle', (_event, id, enabled) => invokeSafely(async () => skillStore.toggleSkill(id, enabled)));
  secureHandle('skills:import', (_event, content, filename) => invokeSafely(async () => skillStore.importFromFile(content, filename)));
  secureHandle('skills:open-upload-dialog', () => invokeSafely(async () => {
    const result = await dialog.showOpenDialog(chatWindow, {
      title: '选择技能文件 (JSON 或 Markdown / SKILL.md)',
      filters: [
        { name: '技能描述与配置文件 (*.json, *.md, *.txt)', extensions: ['json', 'md', 'txt'] },
        { name: '所有文件 (*.*)', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const filePath = result.filePaths[0];
    const content = await fs.readFile(filePath, 'utf8');
    return skillStore.importFromFile(content, path.basename(filePath));
  }));

  // 提示词（Prompts）相关 IPC 通道
  secureHandle('prompts:list', () => invokeSafely(async () => promptStore.list()));
  secureHandle('prompts:save', (_event, prompt) => invokeSafely(async () => promptStore.savePrompt(prompt)));
  secureHandle('prompts:delete', (_event, id) => invokeSafely(async () => promptStore.deletePrompt(id)));

  // 将技能指令或提示词直接插入到当前 ChatGPT 聊天输入框中并同步剪贴板
  secureHandle('chat:insert-prompt', (_event, text) => invokeSafely(async () => {
    const payload = String(text || '').trim();
    if (!payload) return false;
    const { clipboard } = require('electron');
    clipboard.writeText(payload);
    if (chatController) {
      const result = await chatController.insertPrompt(payload);
      return result || true;
    }
    return true;
  }));

  // 设置右侧侧边栏宽度并自动避让原生 ChatGPT 页面
  secureHandle('chat:set-sidebar-width', (_event, width) => invokeSafely(async () => {
    if (chatController) {
      chatController.setSidebarWidth(width);
    }
    return true;
  }));

  // 系统剪贴板写入（绕过 WebContents 焦点限制与权限拒绝）
  secureHandle('clipboard:write-text', (_event, text) => invokeSafely(async () => {
    clipboard.writeText(String(text || ''));
    return true;
  }));
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  console.warn('>>> [Mika-MCP] 检测到后台已有运行中的应用实例，已尝试呼出已有窗口，当前新进程退出。');
  app.quit();
  process.exit(0);
} else {
  app.on('second-instance', () => showChatWindow());

  app.whenReady().then(async () => {
  app.setLoginItemSettings({ openAtLogin: Boolean(settings.load().startWithWindows), path: process.execPath });
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => event.preventDefault());
  });
  createTray();
  orchestrator = new RuntimeOrchestrator({
    settings,
    secrets,
    environment,
    log,
    /* 第 30 轮（用户第 6 条）：版本号的真源在这里 —— app.getVersion() 读的就是
     * package.json 的 version（打包后读应用包内的版本），不需要第二处手抄。
     * 传进 orchestrator 而不是只装饰 app:snapshot：初始渲染走的是
     * emitStatus → 'runtime:status-changed' 那条通路，不经过 IPC 装饰，
     * 只装饰 IPC 会让首屏版本号一直空着（已实测栽过）。 */
    appVersion: app.getVersion(),
    emitProgress: (payload) => sendManager('runtime:progress', payload),
    emitStatus: (payload) => sendManager('runtime:status-changed', payload)
  });
  buildVerification = new BuildVerificationService(log, (payload) => sendManager('build:progress', payload));
  healthService = new HealthService({ settings, secrets, environment, orchestrator });
  log.on('entry', (payload) => sendManager('logs:entry', payload));
  registerIpc();
  initAutoUpdater();
  const startupSettings = settings.load();

  /* 跟随系统档下的"系统亮度实时变化"监听。
   * 为什么必须有它：
   *   themeSource='system' 时，用户去 Windows 设置里切换深/浅色，Electron 只会
   *   更新 shouldUseDarkColors 并自动把新的 prefers-color-scheme 推给渲染进程
   *   （Mika 的 CSS 与 ChatGPT 页面都会自己跟上），但窗口/视图的**背景底色**
   *   与聊天页显式的 data-theme 仍需主进程重算 —— 缺了这条监听，切系统主题时
   *   窗口底层可能残留旧色。所以这里再跑一次 syncTitleBarOverlay。
   * 只在 system 档响应：dark/light 是用户的固定选择，不该被 OS 变化撬动。 */
  if (nativeTheme) {
    nativeTheme.on('updated', () => {
      try {
        if (settings.load().theme === 'system') syncTitleBarOverlay('system');
      } catch (_) {}
    });
  }

  createChatWindow();
  taskNotificationService = new TaskNotificationService({
    getSettings: () => settings.load(),
    getWorkspace: () => settings.load().workspace,
    loadNotificationCheckpoint: (workspace) => notificationCheckpoints.load(workspace),
    saveNotificationCheckpoint: (workspace, checkpoint) => notificationCheckpoints.save(workspace, checkpoint),
    readTaskState: () => {
      try { return readJson(workspaceStatePaths().statePath, null); }
      catch { return null; }
    },
    subscribeTaskEvents: (listener, onError, streamOptions = {}) => {
      const current = settings.load();
      const token = secrets.get('mcpAuthToken');
      const client = new LocalMcpClient({ port: current.mcpPort, token, log });
      return client.subscribeTaskEvents(listener, { onError, ...streamOptions });
    },
    getChatWindow: () => chatWindow,
    getTray: () => tray,
    showChatWindow,
    onPlaySound: () => {
      // 优先调度当前可见且活跃的视图发声，确保处于前台的渲染管线即刻出声，避免隐藏休眠视图丢声
      if (activeSurface === 'settings') {
        sendManager('notification:play-sound');
      } else if (chatWindow && !chatWindow.isDestroyed()) {
        chatWindow.webContents.send('notification:play-sound');
      }
    },
    NotificationClass: Notification,
    icon: appIconPath(),
    log
  });
  taskNotificationService.start();
  setInterval(() => orchestrator.supervise().then((status) => {
    taskNotificationService?.acceptRuntimeStatus?.(status);
    sendManager('runtime:heartbeat', status);
    if (chatWindow && !chatWindow.isDestroyed()) chatWindow.webContents.send('runtime:heartbeat', status);
    if (healthDropdownWindow && !healthDropdownWindow.isDestroyed() && healthDropdownWindow.isVisible()) {
      healthDropdownWindow.webContents.send('service-health:data', {
        mcpRunning: Boolean(status?.mcpRunning),
        tunnelRunning: Boolean(status?.tunnelRunning),
        theme: settings.load().theme
      });
    }
  }).catch(() => {}), 5000).unref();
  log.info('网页 MCP 助手已启动');
  if (!app.isPackaged) {
    try {
      const rendererDir = path.join(__dirname, '..', 'renderer');
      let reloadDebounceTimer = null;
      fsSync.watch(rendererDir, { recursive: true }, (_eventType, filename) => {
        if (filename && /\.(html|js|css)$/i.test(filename)) {
          clearTimeout(reloadDebounceTimer);
          reloadDebounceTimer = setTimeout(() => {
            if (settingsView && !settingsView.webContents.isDestroyed()) {
              settingsView.webContents.reload();
            }
          }, 150);
        }
      });
    } catch (_) {}
  }
  if (startupSettings.autoStartServices && !orchestrator.isManuallyStopped()) {
    orchestrator.start({ automatic: true }).catch((error) => log.error(error.message, { stage: 'auto-start' }));
  }
});
}

app.on('before-quit', () => {
  forceQuit = true;
  taskNotificationService?.stop();
  try { settings.save({ developerMode: false }); } catch (_) {}
});
app.on('window-all-closed', () => {
  const current = settings.load();
  const shouldKeepRunning = current.closeAction ? current.closeAction === 'tray' : Boolean(current.keepRunningOnClose);
  if (!forceQuit && shouldKeepRunning) return;
  if (!forceQuit) app.quit();
});
app.on('activate', () => showChatWindow());






