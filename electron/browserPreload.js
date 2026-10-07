const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('browserAssistant', {
  /* 第 22 轮：设置改为主窗口内的全尺寸视图（不再是独立窗口），
   * 名字随之改为 openSettings，与「返回主界面」的 closeSettings 对应。 */
  openSettings: (page) => ipcRenderer.invoke('manager:open', page),
  navigate: (action) => ipcRenderer.invoke('chat:navigate', action),
  chatStatus: () => ipcRenderer.invoke('chat:status'),
  lightweightStatus: () => ipcRenderer.invoke('app:lightweight-snapshot'),
  workspaceHub: () => ipcRenderer.invoke('workspace:hub'),
  switchWorkspace: (workspace) => ipcRenderer.invoke('workspace:switch', workspace),
  chooseAndSwitchWorkspace: () => ipcRenderer.invoke('workspace:choose-and-switch'),
  removeWorkspace: (workspace) => ipcRenderer.invoke('workspace:remove', workspace),
  popupWorkspaceMenu: (rect) => ipcRenderer.invoke('workspace:popup-menu', rect),
  popupWorkspaceDropdown: (rect) => ipcRenderer.invoke('workspace:popup-dropdown', rect),
  closeWorkspaceDropdown: () => ipcRenderer.invoke('dropdown:close'),
  popupHealthDropdown: (rect) => ipcRenderer.invoke('service-health:popup', rect),
  closeHealthDropdown: () => ipcRenderer.invoke('service-health:close'),
  chooseAuthorizedRoot: () => ipcRenderer.invoke('workspace:choose-authorized-root'),
  onWorkspaceChanged: (listener) => {
    const wrapped = (_event, ws) => listener(ws);
    ipcRenderer.on('workspace:changed', wrapped);
    return () => ipcRenderer.removeListener('workspace:changed', wrapped);
  },
  onWorkspaceDropdownClosed: (listener) => {
    const wrapped = () => listener();
    ipcRenderer.on('workspace-dropdown:closed', wrapped);
    return () => ipcRenderer.removeListener('workspace-dropdown:closed', wrapped);
  },
  onHealthDropdownClosed: (listener) => {
    const wrapped = () => listener();
    ipcRenderer.on('service-health:closed', wrapped);
    return () => ipcRenderer.removeListener('service-health:closed', wrapped);
  },
  onChatState: (listener) => {
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on('chat:state', wrapped);
    return () => ipcRenderer.removeListener('chat:state', wrapped);
  },
  onHeartbeat: (listener) => {
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on('runtime:heartbeat', wrapped);
    return () => ipcRenderer.removeListener('runtime:heartbeat', wrapped);
  },
  onDownload: (listener) => {
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on('chat:download', wrapped);
    return () => ipcRenderer.removeListener('chat:download', wrapped);
  },
  taskState: () => ipcRenderer.invoke('task-state:read'),
  taskRuntime: (options = {}) => ipcRenderer.invoke('mcp:task-runtime', options),
  performanceTrace: () => ipcRenderer.invoke('performance:read'),
  pauseTask: () => ipcRenderer.invoke('task-state:pause'),
  resumeTask: () => ipcRenderer.invoke('task-state:resume'),
  stopTask: () => ipcRenderer.invoke('task-state:stop'),
  listSkills: () => ipcRenderer.invoke('skills:list'),
  listPrompts: () => ipcRenderer.invoke('prompts:list'),
  insertPrompt: (text) => ipcRenderer.invoke('chat:insert-prompt', text),
  setSidebarWidth: (width) => ipcRenderer.invoke('chat:set-sidebar-width', width),
  /* 聊天页顶栏的主题开关：把用户选择落库并同步原生标题栏。
   * 这是 browser.css 那套 `[data-theme="dark"]` 规则一直缺的上报通道 ——
   * 没有它，聊天页的深色规则永远是死代码（详见 main.js 的 'theme' 处理器）。 */
  setTheme: (theme) => ipcRenderer.invoke('theme', theme),
  /* 主进程推来的、已解析的明暗结果（不是 'system' 而是 'dark'/'light'）。
   * 聊天页据此即时切换 data-theme，与原生标题栏保持同一拍。 */
  onThemeChange: (listener) => {
    const wrapped = (_event, theme) => listener(theme);
    ipcRenderer.on('chat:theme', wrapped);
    return () => ipcRenderer.removeListener('chat:theme', wrapped);
  },
  /* 任务通知提示音推送监听：主聊天视图在后台也能准时响应出声 */
  onNotificationSound: (listener) => {
    const wrapped = (_event) => listener();
    ipcRenderer.on('notification:play-sound', wrapped);
    return () => ipcRenderer.removeListener('notification:play-sound', wrapped);
  },
  /* 第 44 轮：自绘窗口按钮（titleBarOverlay 已移除，见 main.js 窗口创建处）。
   * 三个按钮与顶栏同属一个渲染帧，切主题时严格同步、零延迟。 */
  windowControls: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    onMaximizedChange: (listener) => {
      const wrapped = (_event, payload) => listener(payload);
      ipcRenderer.on('window:maximized-changed', wrapped);
      return () => ipcRenderer.removeListener('window:maximized-changed', wrapped);
    }
  }
});
