const path = require('node:path');

const DEFAULTS = Object.freeze({
  configVersion: 9,
  connectionMode: 'official',
  bridgeRemovedNotice: false,
  workspace: '',
  permissionMode: 'safe',
  mcpPort: 18765,
  healthPort: 18081,
  proxyMode: 'auto',
  proxyUrl: '',
  tunnelId: '',
  startWithWindows: false,
  autoStartServices: false,
  keepRunningOnClose: true,
  closeAction: 'tray',
  showTrayIcon: true,
  progressReportSeconds: 90,
  taskNotifications: true,
  taskNotificationSound: true,
  theme: 'light',
  /* 第 28 轮新增：开发者模式总开关。
   *
   * 作用：控制「高级设置与维护」里的破坏性操作是否可用
   * （删除运行通道密钥 / 重新生成 MCP 认证令牌 / 清除 ChatGPT 登录数据），
   * 以及任务页「性能分析」面板是否显示。
   *
   * 默认必须是 false —— 这是**安全默认**，不是体验偏好：
   * 上面三个动作分别会清掉加密密钥、让已部署的服务失效、以及退出登录，
   * 都属于"误点一次就有后果"的类别。默认关闭符合最小惊讶原则。
   * 用户要主动打开它才生效（见 index.html 的设置页开关）。 */
  developerMode: false,
  firstRunCompleted: false,
  guideProgress: {},
  recentWorkspaces: [],
  authorizedRoots: []
});

function normalizeWorkspacePath(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const normalized = path.normalize(text).replace(/[\\/]+$/, '');
  return normalized || path.parse(text).root || text;
}

function workspaceKey(value) {
  const normalized = normalizeWorkspacePath(value);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function mergeRecentWorkspaces(existing, workspace, limit = 50) {
  const candidates = [
    normalizeWorkspacePath(workspace),
    ...(Array.isArray(existing) ? existing : []).map(normalizeWorkspacePath)
  ].filter(Boolean);
  const seen = new Set();
  const result = [];
  for (const item of candidates) {
    const key = workspaceKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}

function normalize(input = {}) {
  const sourceVersion = Number(input.configVersion) || 0;
  const sourceMode = String(input.connectionMode || '').trim();
  const merged = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS)) {
    if (Object.hasOwn(input, key)) merged[key] = input[key];
  }
  merged.configVersion = 9;
  merged.connectionMode = 'official';
  merged.bridgeRemovedNotice = Boolean(merged.bridgeRemovedNotice);
  if (sourceVersion > 0 && sourceVersion <= 6 && sourceMode === 'bridge') {
    merged.autoStartServices = false;
    merged.bridgeRemovedNotice = true;
  }
  merged.permissionMode = ['safe', 'trusted'].includes(merged.permissionMode) ? merged.permissionMode : 'safe';
  merged.proxyMode = ['auto', 'system', 'manual', 'direct'].includes(merged.proxyMode) ? merged.proxyMode : 'auto';
  merged.mcpPort = Number.isInteger(Number(merged.mcpPort)) ? Number(merged.mcpPort) : 18765;
  merged.healthPort = Number.isInteger(Number(merged.healthPort)) ? Number(merged.healthPort) : 18081;
  merged.proxyUrl = String(merged.proxyUrl || '').trim();
  merged.workspace = normalizeWorkspacePath(merged.workspace);
  merged.tunnelId = String(merged.tunnelId || '').trim();
  if (sourceVersion < 5 && merged.theme === 'dark') merged.theme = 'light';
  /* 主题必须是三档，不能只有 dark/light。
   *
   * 旧写法 `merged.theme === 'dark' ? 'dark' : 'light'` 是个静默坍塌：
   * 除 'dark' 外的一切值都被写成 'light'，于是**'system'（跟随系统）永远存不下来**
   * ——设置页点「跟随系统」，落库变成「浅色」，再读回来自然也回不到跟随系统。
   * 而渲染层是完整支持三档的（app.js 有 getSystemTheme()，index.html 有三张
   * 主题卡片，main.js 的 isDark 也专门判了 'system'），唯独这里是断点，
   * 造成"UI 上有这个选项、选了却不生效"。
   *
   * 与上一条 sourceVersion<5 的迁移**不冲突**：那条是对老版本文件的单向纠正，
   * 本条只是不再把 'system' 误判为非法值。 */
  merged.theme = ['dark', 'light', 'system'].includes(merged.theme) ? merged.theme : 'light';
  merged.progressReportSeconds = [60, 90, 120, 180].includes(Number(merged.progressReportSeconds))
    ? Number(merged.progressReportSeconds)
    : 90;
  merged.taskNotifications = Boolean(merged.taskNotifications);
  merged.taskNotificationSound = Boolean(merged.taskNotificationSound);
  merged.closeAction = ['tray', 'quit'].includes(merged.closeAction)
    ? merged.closeAction
    : (merged.keepRunningOnClose === false ? 'quit' : 'tray');
  merged.keepRunningOnClose = merged.closeAction === 'tray';
  merged.showTrayIcon = merged.showTrayIcon !== false;
  /* 第 28 轮：开发者模式强制布尔化。默认 false 见 DEFAULTS。 */
  merged.developerMode = Boolean(merged.developerMode);
  merged.firstRunCompleted = Boolean(merged.firstRunCompleted);
  merged.guideProgress = merged.guideProgress && typeof merged.guideProgress === 'object' ? merged.guideProgress : {};
  merged.recentWorkspaces = mergeRecentWorkspaces(merged.recentWorkspaces, merged.workspace, 50);
  merged.authorizedRoots = (Array.isArray(merged.authorizedRoots) ? merged.authorizedRoots : [])
    .map(normalizeWorkspacePath)
    .filter(Boolean)
    .filter((item, index, all) => all.findIndex((other) => workspaceKey(other) === workspaceKey(item)) === index)
    .filter((item) => workspaceKey(item) !== workspaceKey(merged.workspace))
    .slice(0, 32);
  return merged;
}

function validateRuntimeSettings(settings) {
  if (!Number.isInteger(settings.mcpPort) || settings.mcpPort < 1024 || settings.mcpPort > 65535) {
    throw new Error('MCP 端口必须在 1024-65535 之间。');
  }
  if (!Number.isInteger(settings.healthPort) || settings.healthPort < 1024 || settings.healthPort > 65535) {
    throw new Error('Tunnel 健康端口必须在 1024-65535 之间。');
  }
  if (settings.mcpPort === settings.healthPort) throw new Error('MCP 端口和 Tunnel 健康端口不能相同。');
  if (settings.tunnelId && !/^tunnel_[A-Za-z0-9_-]{4,}$/.test(settings.tunnelId)) {
    throw new Error('Tunnel ID 格式不正确，应以 tunnel_ 开头。');
  }
  if (settings.proxyMode === 'manual' && !settings.proxyUrl) {
    throw new Error('手动代理模式需要填写代理地址。');
  }
  if (settings.proxyUrl) {
    let parsed;
    try { parsed = new URL(settings.proxyUrl); } catch { throw new Error('代理地址不是有效 URL。'); }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('代理地址只支持 http:// 或 https://。');
    if (parsed.username || parsed.password) throw new Error('请不要在代理地址中保存用户名或密码。');
  }
}

module.exports = {
  DEFAULTS,
  normalize,
  validateRuntimeSettings,
  normalizeWorkspacePath,
  workspaceKey,
  mergeRecentWorkspaces
};

