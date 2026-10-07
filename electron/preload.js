const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mcpAssistant', {
  snapshot: (options) => ipcRenderer.invoke('app:snapshot', options),
  chooseWorkspace: () => ipcRenderer.invoke('dialog:workspace'),
  switchWorkspace: (workspace) => ipcRenderer.invoke('workspace:switch', workspace),
  workspaceHub: () => ipcRenderer.invoke('workspace:hub'),
  chooseAndSwitchWorkspace: () => ipcRenderer.invoke('workspace:choose-and-switch'),
  removeWorkspace: (workspace) => ipcRenderer.invoke('workspace:remove', workspace),
  updateAuthorizedRoots: (roots) => ipcRenderer.invoke('workspace:authorized-roots', roots),
  taskState: () => ipcRenderer.invoke('task-state:read'),
  clearTaskState: () => ipcRenderer.invoke('task-state:clear'),
  pauseTask: () => ipcRenderer.invoke('task-state:pause'),
  resumeTask: () => ipcRenderer.invoke('task-state:resume'),
  stopTask: () => ipcRenderer.invoke('task-state:stop'),
  taskHistory: () => ipcRenderer.invoke('task-state:history'),
  /* 第 28 轮：历史任务的隐藏（=删除记录）能力。
   * 只暴露"删哪一条"，不暴露"写整个列表" —— 列表的真身在磁盘上，
   * 且另一个写入方（本地工具）也会往同一个文件归档，
   * 让渲染层回传整份列表会产生互相覆盖。 */
  removeTaskHistory: (key) => ipcRenderer.invoke('task-state:history-remove', key),
  clearTaskHistory: () => ipcRenderer.invoke('task-state:history-clear'),
  performanceTrace: () => ipcRenderer.invoke('performance:read'),
  clearPerformanceTrace: () => ipcRenderer.invoke('performance:clear'),
  workspaceContext: () => ipcRenderer.invoke('mcp:workspace-context'),
  codingToolsGuide: (options = {}) => ipcRenderer.invoke('mcp:coding-tools-guide', options),
  taskRuntime: (options = {}) => ipcRenderer.invoke('mcp:task-runtime', options),
  taskWorktrees: () => ipcRenderer.invoke('mcp:task-worktrees'),
  taskWorktreeDiff: (runId) => ipcRenderer.invoke('mcp:task-worktree-diff', runId),
  applyTaskWorktree: (runId) => ipcRenderer.invoke('mcp:task-worktree-apply', runId),
  discardTaskWorktree: (runId) => ipcRenderer.invoke('mcp:task-worktree-discard', runId),
  /* 长期记忆。桌面是唯一能写记忆的通道 —— 模型只能回忆和提议，
   * 确认/修改/删除只在这里。渲染层同样只透传参数，真正的来源判定和拒绝
   * 都在运行时的 memory_control（X-Coding-Tools-Origin: desktop）。 */
  memoryConfig: () => ipcRenderer.invoke('memory:config'),
  memoryList: (options = {}) => ipcRenderer.invoke('memory:list', options),
  memorySearch: (options = {}) => ipcRenderer.invoke('memory:search', options),
  memoryCandidates: () => ipcRenderer.invoke('memory:candidates'),
  memoryConfirm: (payload = {}) => ipcRenderer.invoke('memory:confirm', payload),
  memoryReject: (candidateId) => ipcRenderer.invoke('memory:reject', candidateId),
  memoryCreate: (payload = {}) => ipcRenderer.invoke('memory:create', payload),
  memoryUpdate: (payload = {}) => ipcRenderer.invoke('memory:update', payload),
  memoryArchive: (memoryId) => ipcRenderer.invoke('memory:archive', memoryId),
  memoryDelete: (memoryId) => ipcRenderer.invoke('memory:delete', memoryId),
  memorySetConfig: (payload = {}) => ipcRenderer.invoke('memory:set-config', payload),
  memoryExport: (target) => ipcRenderer.invoke('memory:export', target),
  memoryImport: (source) => ipcRenderer.invoke('memory:import', source),
  memoryChooseExportPath: () => ipcRenderer.invoke('memory:choose-export-path'),
  memoryChooseImportPath: () => ipcRenderer.invoke('memory:choose-import-path'),
  memoryRevisions: (memoryId) => ipcRenderer.invoke('memory:revisions', memoryId),
  memoryRestoreRevision: (payload = {}) => ipcRenderer.invoke('memory:restore-revision', payload),
  memoryRebuildIndex: () => ipcRenderer.invoke('memory:rebuild-index'),
  openMemoryFolder: () => ipcRenderer.invoke('memory:open-folder'),
  testTaskNotification: () => ipcRenderer.invoke('notification:test'),
  playBeep: () => ipcRenderer.invoke('notification:play-beep'),
  inspectBuild: () => ipcRenderer.invoke('build:inspect'),
  runBuild: (options) => ipcRenderer.invoke('build:run', options),
  inspectHealth: () => ipcRenderer.invoke('health:inspect'),
  repairHealth: () => ipcRenderer.invoke('health:repair'),
  /* 第 22 轮：设置从「独立窗口」变成「主窗口内的全尺寸视图」，
   * 这个动作的语义随之从「关闭一个窗口」变成「返回 ChatGPT 界面」。
   * 名字必须跟着改 —— closeManager 会让人以为在关窗口。 */
  closeSettings: () => ipcRenderer.invoke('manager:close'),
  quitApp: () => ipcRenderer.invoke('app:quit-completely'),
  saveSettings: (patch) => ipcRenderer.invoke('settings:save', patch),
  syncTitleBar: (theme) => ipcRenderer.invoke('theme:sync-titlebar', theme),
  saveRuntimeKey: (value) => ipcRenderer.invoke('secrets:runtime-key', value),
  removeRuntimeKey: () => ipcRenderer.invoke('secrets:runtime-key-remove'),
  regenerateMcpToken: () => ipcRenderer.invoke('secrets:mcp-token-regenerate'),
  start: () => ipcRenderer.invoke('runtime:start'),
  stop: () => ipcRenderer.invoke('runtime:stop'),
  restart: () => ipcRenderer.invoke('runtime:restart'),
  logs: () => ipcRenderer.invoke('logs:read'),
  clearLogs: () => ipcRenderer.invoke('logs:clear'),
  openExternal: (target) => ipcRenderer.invoke('shell:open', target),
  installPython: () => ipcRenderer.invoke('environment:install-python'),
  detectProxy: () => ipcRenderer.invoke('environment:detect-proxy'),
  clearChatSession: () => ipcRenderer.invoke('chat:clear-session'),
  chatAuthStatus: () => ipcRenderer.invoke('chat:auth-status'),
  listSkills: () => ipcRenderer.invoke('skills:list'),
  saveSkill: (skill) => ipcRenderer.invoke('skills:save', skill),
  deleteSkill: (id) => ipcRenderer.invoke('skills:delete', id),
  toggleSkill: (id, enabled) => ipcRenderer.invoke('skills:toggle', id, enabled),
  importSkill: (content, filename) => ipcRenderer.invoke('skills:import', content, filename),
  openUploadSkillDialog: () => ipcRenderer.invoke('skills:open-upload-dialog'),
  listPrompts: () => ipcRenderer.invoke('prompts:list'),
  savePrompt: (prompt) => ipcRenderer.invoke('prompts:save', prompt),
  deletePrompt: (id) => ipcRenderer.invoke('prompts:delete', id),
  insertPrompt: (text) => ipcRenderer.invoke('chat:insert-prompt', text),
  writeClipboardText: (text) => ipcRenderer.invoke('clipboard:write-text', text),
  setSidebarWidth: (width) => ipcRenderer.invoke('chat:set-sidebar-width', width),
  onProgress: (listener) => {
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on('runtime:progress', wrapped);
    return () => ipcRenderer.removeListener('runtime:progress', wrapped);
  },
  onLog: (listener) => {
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on('logs:entry', wrapped);
    return () => ipcRenderer.removeListener('logs:entry', wrapped);
  },
  onStatus: (listener) => { const wrapped = (_event, payload) => listener(payload); ipcRenderer.on('runtime:status-changed', wrapped); return () => ipcRenderer.removeListener('runtime:status-changed', wrapped); },
  onWorkspaceChanged: (listener) => {
    const wrapped = (_event, workspace) => listener(workspace);
    ipcRenderer.on('workspace:changed', wrapped);
    return () => ipcRenderer.removeListener('workspace:changed', wrapped);
  },
  onHeartbeat: (listener) => { const wrapped = (_event, payload) => listener(payload); ipcRenderer.on('runtime:heartbeat', wrapped); return () => ipcRenderer.removeListener('runtime:heartbeat', wrapped); },
  onBuildProgress: (listener) => { const wrapped = (_event, payload) => listener(payload); ipcRenderer.on('build:progress', wrapped); return () => ipcRenderer.removeListener('build:progress', wrapped); },
  onNavigate: (listener) => {
    const wrapped = (_event, page) => listener(page);
    ipcRenderer.on('settings:navigate', wrapped);
    return () => ipcRenderer.removeListener('settings:navigate', wrapped);
  },
  onLockDeveloperMode: (listener) => {
    const wrapped = (_event) => listener();
    ipcRenderer.on('settings:lock-developer-mode', wrapped);
    return () => ipcRenderer.removeListener('settings:lock-developer-mode', wrapped);
  },
  onNotificationSound: (listener) => {
    const wrapped = (_event) => listener();
    ipcRenderer.on('notification:play-sound', wrapped);
    return () => ipcRenderer.removeListener('notification:play-sound', wrapped);
  },
  /* 第 44 轮：自绘窗口按钮（titleBarOverlay 已移除）。设置视图占满整个窗口，
   * 所以它也必须自带这三个按钮 —— 与聊天页同一套通道。 */
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


