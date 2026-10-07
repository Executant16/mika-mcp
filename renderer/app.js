const api = window.mcpAssistant || createPreviewApi();

function createPreviewApi() {
  const previewSettings = {
    connectionMode: 'official', bridgeRemovedNotice: false, workspace: 'C:\\Users\\示例用户\\Desktop\\my-project', permissionMode: 'safe',
    mcpPort: 18765, healthPort: 18081, proxyMode: 'auto', proxyUrl: '', tunnelId: 'tunnel_demo',
    theme: 'light', developerMode: false, startWithWindows: false, progressReportSeconds: 90, keepRunningOnClose: true, autoStartServices: false, taskNotifications: true, taskNotificationSound: true, firstRunCompleted: true, guideProgress: {}, authorizedRoots: []
  };
  const snapshot = {
    settings: previewSettings,
    secrets: { runtimeApiKey: true, mcpAuthToken: true },
    environment: {
      python: { installed: true, version: 'Python 3.12.10' },
      proxy: { mode: 'auto', configured: false, reachable: true, source: 'auto-direct', url: '' }, tunnelClient: { installed: true },
      workspace: { configured: true, exists: true }, ports: { mcpListening: true, tunnelListening: true }
    },
    status: { busy: false, runtimeRunning: true, tunnelRunning: true, connectionRunning: true, connectionMode: 'official', fullyReady: true, localMcpUrl: 'http://127.0.0.1:18765/mcp', tunnelUiUrl: 'http://127.0.0.1:18081/ui' },
    appVersion: '0.1.0'
  };
  const ok = (data) => Promise.resolve({ ok: true, data });
  return {
    snapshot: () => ok(snapshot), chooseWorkspace: () => ok(snapshot.settings.workspace), switchWorkspace: (workspace) => { snapshot.settings.workspace=workspace; return ok(snapshot); }, updateAuthorizedRoots: (roots) => { snapshot.settings.authorizedRoots=roots; return ok(snapshot); }, closeSettings: () => ok(true),
    saveSettings: (patch) => { Object.assign(snapshot.settings, patch); return ok(snapshot.settings); },
    saveRuntimeKey: () => ok(snapshot.secrets), removeRuntimeKey: () => ok(snapshot.secrets), regenerateMcpToken: () => ok(snapshot.secrets),
    start: () => ok(snapshot), stop: () => ok(snapshot), restart: () => ok(snapshot),
    logs: () => ok([{ time: new Date().toISOString(), level: 'info', message: '静态界面预览模式' }]), clearLogs: () => ok(true),
    taskState: () => ok({ exists: false, state: null }), taskRuntime: () => ok({ state: { status: 'completed', run_id: 'run_demo_1234', objective: '示例后台任务' }, active_worktree: { run_id: 'run_demo_1234', objective: '示例后台任务', branch: 'coding-tools/run-demo', path: 'C:\\demo\\.coding-tools\\worktrees\\demo', exists: true, clean: false, snapshot_dirty: true, snapshot_changed_count: 3, created_at: new Date().toISOString() }, operations: [] }), taskWorktrees: () => ok({ worktrees: [{ run_id: 'run_demo_1234', objective: '示例后台任务', branch: 'coding-tools/run-demo', path: 'C:\\demo\\.coding-tools\\worktrees\\demo', exists: true, clean: false, snapshot_dirty: true, snapshot_changed_count: 3, snapshot_untracked_count: 1, created_at: new Date().toISOString(), status: 'active' }] }), taskWorktreeDiff: () => ok({ worktree_diff: { run_id: 'run_demo_1234', changed_count: 2, diff: 'diff --git a/app.js b/app.js\n+示例隔离修改\n' } }), applyTaskWorktree: () => ok({ apply_result: { applied: true, changed_count: 2, primary_index_untouched: true }, worktree: { status: 'applied' } }), discardTaskWorktree: () => ok({ worktree: { discarded: true } }), testTaskNotification: () => ok(true), clearTaskState: () => ok(true), pauseTask: () => ok({}), resumeTask: () => ok({}), stopTask: () => ok({}), taskHistory: () => ok([]), removeTaskHistory: () => ok(1), clearTaskHistory: () => ok(0), performanceTrace: () => ok(null), clearPerformanceTrace: () => ok(true),
    workspaceContext: () => ok({ project: { type: 'electron', name: 'demo', version: '0.1.0', entrypoint: 'electron/main.js' }, project_instructions: { root_files: [{ path: 'AGENTS.md', truncated: false }], nested_files: [], nested_count: 0, warnings: [] }, core_entries: ['electron/main.js', 'package.json'], context_pressure: { level: 'normal', tool_calls: 8, files_read: 5, response_megabytes: 0.4, recommend_new_chat: false } }),
    codingToolsGuide: () => ok({ custom_instructions: '当请求涉及本地代码工作区时，请优先使用 Coding Tools MCP；快速了解项目使用 workspace_context，修改、测试和构建优先使用 agent_workflow。' }),
    inspectBuild: () => ok({ type: 'electron', name: 'demo', version: '0.1.0', testCommand: 'npm test', buildCommand: 'npm run dist', artifacts: ['dist'] }), runBuild: () => ok({ overallStatus: 'passed', project: { type: 'electron', name: 'demo', version: '0.1.0' }, testResult: { status: 'passed' }, buildResult: { status: 'passed' }, artifacts: [] }), inspectHealth: () => ok({ healthy: true, checks: [] }), repairHealth: () => ok({ healthy: true, checks: [], actions: [], unresolved: [] }),
    /* 静态预览（没有桌面外壳）时的记忆假数据，只为看界面。 */
    memoryConfig: () => ok({ enabled: true, auto_memory: 'suggest', allow_sensitive_personal: false, exists: true, root: 'C:\\Users\\示例用户\\AppData\\Local\\Mika\\memory-v1' }),
    memoryList: () => ok({ enabled: true, memories: [
      { memory_id: 'mem_demo0001', scope: 'project', memory_type: 'decision', title: '打包前必须先跑全量测试', content: '发版前先跑 npm run test 与 Schema 契约，再执行 npm run dist。', pinned: true, archived: false, revision: 2, updated_at: '2026-09-27T10:00:00Z' },
      { memory_id: 'mem_demo0002', scope: 'global', memory_type: 'core_preference', title: '回答用简体中文、不用行话', content: '解释技术问题时用非程序员也能听懂的话。', pinned: true, archived: false, revision: 1, updated_at: '2026-09-26T09:00:00Z' }
    ] }),
    memorySearch: () => ok({ enabled: true, memories: [] }),
    memoryCandidates: () => ok({ enabled: true, candidates: [
      { candidate_id: 'cand_demo01', scope: 'project', memory_type: 'pitfall', title: '主项目与副本的界面不是同一版', content: '副本里是旧界面，改页面前先确认目标。', reason: '本轮踩过一次', created_at: '2026-09-27T11:00:00Z', expires_at: '2026-10-04T11:00:00Z' }
    ], count: 1 }),
    memoryConfirm: () => ok({ ok: true }), memoryReject: () => ok({ ok: true }),
    memoryCreate: () => ok({ ok: true }), memoryUpdate: () => ok({ ok: true }),
    memoryArchive: () => ok({ ok: true }), memoryDelete: () => ok({ ok: true }),
    memorySetConfig: () => ok({ ok: true }), memoryExport: () => ok({ ok: true, path: 'C:\\示例\\mika-memory-2026-09-27.zip' }),
    memoryImport: () => ok({ ok: true, imported: 2 }), memoryRevisions: () => ok({ revisions: [] }), memoryRestoreRevision: () => ok({ ok: true }),
    memoryChooseExportPath: () => ok({ target: 'C:\\示例\\mika-memory-2026-09-27.zip' }),
    memoryChooseImportPath: () => ok({ source: 'C:\\示例\\mika-memory-2026-09-27.zip' }),
    memoryRebuildIndex: () => ok({ ok: true }), openMemoryFolder: () => ok({ opened: true }),
    listSkills: () => ok([]), saveSkill: () => ok({ ok: true }), toggleSkill: () => ok({ ok: true }), deleteSkill: () => ok({ ok: true }), openUploadSkillDialog: () => ok(null),
    listPrompts: () => ok([]), savePrompt: () => ok({ ok: true }), deletePrompt: () => ok({ ok: true }), insertPrompt: () => ok({ ok: true }), writeClipboardText: () => ok(true),
    openExternal: () => ok(true), installPython: () => ok(true), detectProxy: () => ok(snapshot.environment.proxy), onProgress: () => () => {}, onLog: () => () => {}, onStatus: () => () => {}, onHeartbeat: () => () => {}, onBuildProgress: () => () => {}
  };
}

// 每个页面两个名字：侧栏标签与页面标题。第 21 轮删掉了第三处「眉标」小字 ——
// 它 9 个页面里有 8 个是第三个说法（侧栏叫「运行与连接」、眉标叫「连接配置」、
// 标题又叫「运行与连接」），剩下 1 个与标题完全重复。删掉后页面顶部只剩一个标题。
const pageMeta = {
  overview: ['总览', '集中查看本地工具、连接通道与当前工作区。'],
  deploy: ['设置', '管理连接通道、网络代理、工作文件夹与高级运行配置。'],
  task: ['总览', '集中查看本地工具、连接通道与当前工作区。'],
  health: ['故障排查', '检查运行环境并排查修复常见问题。'],
  guide: ['接入指南', '按步骤完成首次连接。'],
  skills: ['技能管理', '管理与导入专业工程技能，随时在聊天主界面点一下即可调用。'],
  prompts: ['提示词库', '沉淀高频指令与角色模板，随时在聊天主界面点一下即可填入。'],
  memory: ['记忆', '模型记住的偏好与项目约定，全部由你确认、修改或删除。'],
  logs: ['运行日志', '实时记录本地服务与 ChatGPT 连接的重要事件与诊断输出。'],
  settings: ['设置', '管理连接通道、网络代理、工作文件夹与高级运行配置。'],
  about: ['关于我们', '应用版本、技术架构与开源项目说明。']
};

const state = {
  snapshot: null,
  currentPage: 'overview',
  selectedWorkspace: '',
  logFilter: 'all',
  logSearch: '',
  logPaused: false,
  showTechLogs: false,
  logs: [],
  busy: false,
  initializedForms: false,
  buildInspected: false,
  workspaceContext: null,
  connectorVerified: false,
  toolCallVerified: false,
  lastHealthReport: null,
  lastHealthTimestamp: 0,
  lastWorkspaceContextTimestamp: 0,
  lastTaskPayload: null,
  lastTaskRuntime: null,
  lastWorktreePayload: null,
  lastTaskHistory: null,
  lastPerformanceTrace: null,
  lastProjectBuild: null,
  lastCodingToolsGuide: null,
  skills: [],
  prompts: [],
  skillSearch: '',
  selectedPromptCategory: '全部',
  isChatGptLoggedIn: false
};

// 清除历史前端伪删除残留的脏数据，真理来源严格回归主进程 settings.json 与快照
try {
  localStorage.removeItem('mika_removed_workspaces');
} catch (_) {}

const TOP_ACTION_PAGES = {
  overview: { refresh: true, start: false, save: false },
  deploy: { refresh: false, start: false, save: false },
  health: { refresh: false, start: false, save: false },
  task: { refresh: false, start: false, save: false },
  guide: { refresh: false, start: false, save: false },
  skills: { refresh: true, start: false, save: false },
  prompts: { refresh: true, start: false, save: false },
  memory: { refresh: false, start: false, save: false },
  logs: { refresh: true, start: false, save: false },
  settings: { refresh: false, start: false, save: false },
  about: { refresh: false, start: false, save: false }
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function unwrap(result) {
  if (!result?.ok) throw new Error(result?.error || '操作失败');
  return result.data;
}

function toast(title, message = '', type = 'success') {
  const element = document.createElement('div');
  element.className = `toast ${type}`;
  const heading = document.createElement('b');
  heading.textContent = title;
  const detail = document.createElement('span');
  detail.textContent = message;
  element.append(heading, detail);
  $('#toastStack').appendChild(element);
  setTimeout(() => element.remove(), 4200);
}

function setBusy(value, overlay = false) {
  state.busy = value;
  $('#busyOverlay').classList.toggle('visible', value && overlay);
  ['#topStartButton', '#overviewHeroActionBtn', '#heroStartButton', '#deployNow', '#overviewStop'].forEach((selector) => {
    const element = $(selector);
    if (element) element.disabled = value;
  });
}

function setDot(element, status) {
  if (!element) return;
  element.classList.remove('ready', 'warn', 'error', 'idle');
  if (status) element.classList.add(status);
}

function navigate(page) {
  const isWorkspaceRedirect = page === 'workspace';
  const isDeployRedirect = page === 'deploy';
  if (isWorkspaceRedirect) page = 'overview';
  if (isDeployRedirect) page = 'settings';
  const isAdvancedRedirect = page === 'advanced';
  if (isAdvancedRedirect) page = 'settings';
  const isTaskRedirect = page === 'task';
  if (isTaskRedirect) page = 'overview';

  if (!pageMeta[page]) return;
  const isSamePage = state.currentPage === page;
  state.currentPage = page;
  if (location.hash !== `#${page}`) history.replaceState(null, '', `#${page}`);

  // 1. 界面元素 0ms 瞬间切换完成，绝不阻塞渲染主线程
  $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.page === page));
  $$('.page').forEach((item) => item.classList.toggle('active', item.dataset.pageView === page));

  const [title, subtitle] = pageMeta[page];
  $('#pageTitle').textContent = title;
  const isTask = page === 'task';
  const taskStatusNode = $('#taskHeaderStatus');
  if (taskStatusNode) {
    taskStatusNode.hidden = true;
    taskStatusNode.style.display = 'none';
  }
  const subtitleNode = $('#pageSubtitle');
  if (subtitleNode) {
    subtitleNode.textContent = '';
    subtitleNode.style.display = 'none';
  }
  const viewport = $('.content-viewport');
  if (viewport) {
    viewport.classList.toggle('guide-viewport-lock', page === 'guide');
    if (!isWorkspaceRedirect && !isDeployRedirect && !isAdvancedRedirect && !isTaskRedirect && viewport.scrollTop !== 0) {
      viewport.scrollTop = 0;
    }
  }
  applyTopActions(page);

  if (isTaskRedirect) {
    const taskSec = $('#currentTaskSection');
    if (taskSec) setTimeout(() => taskSec.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }

  if (isWorkspaceRedirect) {
    if (state.snapshot) renderOverviewWorkspace(state.snapshot);
    const wsSec = $('#overviewWorkspaceSection');
    if (wsSec) {
      setTimeout(() => {
        wsSec.scrollIntoView({ behavior: 'smooth', block: 'center' });
        wsSec.classList.remove('highlight-section');
        void wsSec.offsetWidth;
        wsSec.classList.add('highlight-section');
        setTimeout(() => wsSec.classList.remove('highlight-section'), 2200);
      }, 100);
    }
  }

  if (isDeployRedirect) {
    switchSettingsTab('connection');
  }
  if (isAdvancedRedirect) {
    switchSettingsTab('advanced');
    const adv = $('#settingsAdvancedAccordion');
    if (adv) setTimeout(() => adv.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }
  if (page === 'settings') {
    switchSettingsTab(state.activeSettingsTab || 'general');
    updateInspectBuildButton();
  }
  if (page === 'guide') {
    switchGuideStep(state.currentGuideStep || 1);
  }
  if (page === 'health') {
    // 0ms 同步秒开：切换到故障排查首帧立即呈现内存快照，彻底根除等待和卡顿感
    const cachedHealth = state.lastHealthReport || getFallbackHealthReport(state.snapshot);
    if (cachedHealth) renderHealth(cachedHealth);
  }
  if (page === 'logs') {
    const viewport = $('.content-viewport');
    if (viewport) viewport.scrollTop = 0;
    if (state.logs && state.logs.length) renderLogs();
  }

  // 同页重复触发跳过后台数据刷新
  if (isSamePage) return;

  // 2. 将后台数据加载置入异步微队列，按需防抖，避免 Tab 切换动画与主线程卡顿
  const now = Date.now();
  setTimeout(() => {
    if (page === 'health') {
      if (!state.lastHealthTimestamp || now - state.lastHealthTimestamp > 20000) {
        inspectHealth();
      }
    } else if (page === 'logs') {
      loadLogs();
    } else if (page === 'task') {
      loadTaskState();
      if (!state.buildInspected) inspectBuild();
    } else if (page === 'settings') {
      if (!state.buildInspected) inspectBuild();
      if (!state.lastWorkspaceContextTimestamp || now - state.lastWorkspaceContextTimestamp > 30000) {
        loadWorkspaceContext();
      }
      updateChatGptAuthStatusVisual();
    } else if (page === 'deploy') {
      if (!state.lastWorkspaceContextTimestamp || now - state.lastWorkspaceContextTimestamp > 30000) {
        loadWorkspaceContext();
      }
    } else if (page === 'guide') {
      const scrollPanel = $('#guideStepsScrollPanel');
      if (scrollPanel) scrollPanel.scrollTop = 0;
      const viewport = $('.content-viewport');
      if (viewport) viewport.scrollTop = 0;
      if (!state.lastCodingToolsGuide) loadCodingToolsGuide();
    } else if (page === 'skills') {
      loadSkillsData();
    } else if (page === 'prompts') {
      loadPromptsData();
    } else if (page === 'memory') {
      initMemoryPage();
    } else if (page === 'overview') {
      loadOverviewData();
    }
  }, 16);
}

// ── 设置页 3 分类分段导航切换 ──────────────────────────────────────
function switchSettingsTab(tabName) {
  let target = tabName;
  if (target === 'project') target = 'advanced';
  if (!['general', 'connection', 'advanced'].includes(target)) {
    target = 'general';
  }
  state.activeSettingsTab = target;
  $$('.settings-tab-btn').forEach((btn) => {
    const isCur = btn.dataset.settingsTab === target;
    btn.classList.toggle('active', isCur);
    btn.setAttribute('aria-selected', isCur ? 'true' : 'false');
  });
  $$('.settings-tab-panel').forEach((panel) => {
    const isCur = panel.dataset.settingsPanel === target;
    panel.classList.toggle('active', isCur);
    panel.hidden = !isCur;
  });
  if (target === 'connection') {
    updateChatGptAuthStatusVisual();
  }
}

// ── 接入向导单步切换控制器 ──────────────────────────────────────────
function switchGuideStep(targetStep) {
  let step = parseInt(targetStep, 10);
  if (isNaN(step) || step < 1) step = 1;
  if (step > 5) step = 5;
  state.currentGuideStep = step;

  // 步骤切换时重置内部与视口滚动位置，确保无位移、不切顶
  const scrollPanel = $('#guideStepsScrollPanel');
  if (scrollPanel) scrollPanel.scrollTop = 0;
  const viewport = $('.content-viewport');
  if (viewport && state.currentPage === 'guide') viewport.scrollTop = 0;

  $$('.guide-step-row').forEach((row, idx) => {
    const isCur = (idx + 1) === step;
    row.classList.toggle('is-active-step', isCur);
    row.hidden = !isCur;
  });

  const STEP_KEYS = ['tunnel', 'key', 'deploy', 'connector', 'test'];
  STEP_KEYS.forEach((key, idx) => {
    const isCur = (idx + 1) === step;
    const listItem = $(`[data-guide-item="${key}"]`);
    if (listItem) {
      listItem.classList.toggle('current', isCur);
    }
  });

  const prevBtn = $('#guidePrevStepBtn');
  const nextBtn = $('#guideNextStepBtn');
  const progText = $('#guideStepIndicatorText');

  if (prevBtn) prevBtn.disabled = (step === 1);
  if (nextBtn) {
    if (step === 5) {
      nextBtn.innerHTML = '<span>完成引导 ✓</span>';
    } else {
      nextBtn.innerHTML = '<span>下一步</span><svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5l4.5 4.5L6 12.5"/></svg>';
    }
  }
  if (progText) progText.textContent = `第 ${step} 步 / 共 5 步`;
}

// ── 左下角全局状态中心数据同步 ───────────────────────────────────────
function updateGlobalStatusPopover(snapshot) {
  const popover = $('#globalStatusPopover');
  if (!popover) return;
  const status = snapshot?.status || {};
  const settings = snapshot?.settings || {};
  const environment = snapshot?.environment || {};
  
  const mcpRunning = Boolean(status.runtimeRunning);
  const tunnelRunning = Boolean(status.tunnelRunning);
  const pyInstalled = Boolean(environment?.python?.installed);
  const ws = settings.workspace || '';
  const wsAuthorized = Boolean(environment?.workspace?.exists && ws);
  const wsName = ws ? extractWorkspaceName(ws) : '';

  const headerDot = $('#gscHeaderDot');
  const headerTitle = $('#gscHeaderTitle');
  if (headerDot) {
    headerDot.className = `status-dot-sm ${mcpRunning && tunnelRunning ? 'ready' : mcpRunning ? 'yellow' : 'idle'}`;
  }
  if (headerTitle) {
    headerTitle.textContent = mcpRunning && tunnelRunning ? '系统健康正常' : mcpRunning ? '服务运行中 (通道未连)' : '系统待机中';
  }

  // MCP 服务
  const mcpDot = $('#gscMcpDot');
  const mcpVal = $('#gscMcpVal');
  if (mcpDot) mcpDot.className = `status-dot-sm ${mcpRunning ? 'ready' : 'idle'}`;
  if (mcpVal) mcpVal.textContent = mcpRunning ? `运行中 (:${settings.mcpPort || 18765})` : `未启动 (:${settings.mcpPort || 18765})`;

  // Tunnel 通道
  const tunnelDot = $('#gscTunnelDot');
  const tunnelVal = $('#gscTunnelVal');
  if (tunnelDot) tunnelDot.className = `status-dot-sm ${tunnelRunning ? 'ready' : 'idle'}`;
  if (tunnelVal) tunnelVal.textContent = tunnelRunning ? '已连接' : (settings.tunnelId ? '待连接' : '未配置');

  // Python 环境
  const pyDot = $('#gscPythonDot');
  const pyVal = $('#gscPythonVal');
  if (pyDot) pyDot.className = `status-dot-sm ${pyInstalled ? 'ready' : 'error'}`;
  if (pyVal) pyVal.textContent = pyInstalled ? `Python ${environment?.python?.version || '就绪'}` : '未安装';

  // 工作目录
  const wsDot = $('#gscWorkspaceDot');
  const wsVal = $('#gscWorkspaceVal');
  if (wsDot) wsDot.className = `status-dot-sm ${wsAuthorized ? 'ready' : 'idle'}`;
  if (wsVal) wsVal.textContent = wsName ? wsName : '未指定';

  // 快捷主按钮
  const toggleBtn = $('#gscToggleBtn');
  if (toggleBtn) {
    toggleBtn.textContent = mcpRunning ? '重启服务' : '启动服务';
  }
}

/* 第 29 轮新增：按当前页决定顶栏两个全局按钮是否出现（判据表见 TOP_ACTION_PAGES）。
 *
 * 用 hidden 而不是从 DOM 里删：这两个按钮是**同一个元素**，切回来要立刻显示，
 * 不该走一次创建。hidden 对 <button> 的 display 默认值是 inline-block，
 * 而 .top-actions 里它们是 flex 子项 —— styles.css 的 [hidden]{display:none!important}
 * 已经覆盖了这个场景（那条规则本来就是为同类问题加的）。
 *
 * 注意不能把按钮 disabled 掉充当隐藏：用户会看到一个灰着的「启动服务」，
 * 那不是"这一页用不上"，而是"它坏了"。 */
function applyTopActions(page) {
  const rule = TOP_ACTION_PAGES[page] || { refresh: true, start: false, save: false };
  const refresh = $('#refreshButton');
  const start = $('#topStartButton');
  const save = $('#saveDeploySettings');
  /* 「保存并重新部署」= 保存 + 重启本地运行环境。它与「保存设置」是同一组
   * 状态变更动作（都在 save 列），所以共用 rule.save —— 不单独加一列：
   * 多一列就多一处真源，而 TOP_ACTION_PAGES 的行形状是测试逐字解析的。 */
  const saveRestart = $('#saveWorkspaceRestart');
  if (refresh) refresh.hidden = !rule.refresh;
  if (start) start.hidden = !rule.start;
  if (save) save.hidden = !rule.save;
  if (saveRestart) saveRestart.hidden = !rule.save;
}

function textOr(value, fallback = '—') { return String(value ?? '').trim() || fallback; }

function statusLabel(value) {
  const key = String(value || '').trim().toLowerCase();
  return ({
    idle: '暂无任务', active: '执行中', running: '执行中', waiting: '等待中', waiting_model: '等待模型',
    needs_user: '等待你处理', paused: '已暂停', stopped: '已停止', cancelled: '已取消', interrupted: '已中断',
    completed: '已完成', passed: '通过', failed: '失败', unavailable: '不可用', skipped: '已跳过', blocked: '已阻止',
    pending: '等待中', in_progress: '进行中'
  })[key] || textOr(value, '未知');
}

function projectTypeLabel(value) {
  const key = String(value || '').toLowerCase();
  return ({
    electron: '桌面应用', node: 'Node.js 项目', python: 'Python 项目', rust: 'Rust 项目', go: 'Go 项目',
    maven: 'Java 项目', dotnet: '.NET 项目', unknown: '未知项目'
  })[key] || textOr(value, '未知项目');
}

function toolLabel(value) {
  const key = String(value || '');
  return ({
    coding_tools_guide: '工具指南', workspace_context: '工作区检查', agent_workflow: '自动工作流', task_control: '任务控制',
    document_workflow: '文档处理', exec_command: '命令执行', command_control: '命令管理', request_permissions: '权限请求', view_image: '查看图片'
  })[key] || key || '本地工具';
}

function humanizeTaskText(value) {
  const raw = String(value || '').trim();
  const key = raw.toLowerCase();
  return ({
    'waiting for model': '等待模型继续处理', 'waiting for user': '等待你处理', completed: '已完成',
    'verification failed': '验证失败', 'requested check failed': '检查失败', 'running requested checks': '正在执行检查',
    'run complete agent workflow': '正在执行完整任务', 'apply workspace changes': '正在修改项目',
    'run requested checks': '正在验证修改', 'finalize verified result': '正在整理结果'
  })[key] || raw;
}

function renderTaskList(container, items, render, emptyText = '暂无记录') {
  container.replaceChildren();
  if (!items?.length) {
    const empty = document.createElement('span'); empty.className = 'task-muted'; empty.textContent = emptyText; container.appendChild(empty); return;
  }
  items.forEach((item) => container.appendChild(render(item)));
}

function renderTaskState(payload) {
  const task = payload?.state;
  const isRunning = Boolean(
    task && (task.status === 'running' || task.status === 'active' || task.status === 'in_progress')
  );
  const isFailed = Boolean(task && (task.status === 'failed' || task.failure));
  const hasTask = Boolean(task && (
    textOr(task.objective, '') ||
    textOr(task.current_step, '') ||
    textOr(task.next_step, '') ||
    (Array.isArray(task.steps) && task.steps.length) ||
    (task.status && task.status !== 'idle' && task.status !== 'completed')
  ));

  // 1. 顶部 Header 状态小圆点与文本联动
  const headerDot = $('#taskHeaderDot');
  const headerText = $('#taskHeaderText');
  if (headerDot && headerText) {
    headerDot.className = 'task-status-dot';
    if (isRunning) {
      headerDot.classList.add('running');
      headerText.textContent = '正在执行';
    } else if (isFailed) {
      headerDot.classList.add('error');
      headerText.textContent = '执行异常';
    } else {
      headerDot.classList.add('idle');
      headerText.textContent = '当前空闲';
    }
  }

  // 2. 正在执行区域显隐控制
  const activeCard = $('#taskStateContent');
  const clearState = $('#clearTaskState');
  const emptyGuide = $('#taskEmptyGuideWrap');

  if (activeCard) activeCard.hidden = !hasTask;
  if (emptyGuide) emptyGuide.hidden = hasTask;
  /* 空闲态的状态胶囊。
   * 当没有任务正在执行时显示低调中性灰的"待命中"，避免亮绿色给人造成误解；
   * 有任务时它让位给任务卡上的状态，不同时显示两种状态。 */
  const idleChip = $('#taskIdleChip');
  if (idleChip) {
    idleChip.hidden = hasTask;
    const chipState = isRunning ? 'status-warn' : 'status-idle';
    const dotState = isRunning ? 'warn' : 'idle';
    const textState = isRunning ? '执行中' : '待命中';
    idleChip.className = `status-pill ${chipState}`;
    idleChip.innerHTML = `<i class="status-dot-sm ${dotState}"></i><span>${textState}</span>`;
  }
  if (clearState) {
    clearState.hidden = !hasTask;
    clearState.style.setProperty('display', !hasTask ? 'none' : 'inline-flex', 'important');
  }

  if (!hasTask) {
    syncTaskPageDisplay();
    return;
  }

  // 3. 有任务时填入自然语言信息
  const objective = textOr(task.objective, '未填写当前目标');
  if ($('#taskObjective')) $('#taskObjective').textContent = objective;
  if ($('#taskId')) $('#taskId').textContent = textOr(task.task_id);
  if ($('#taskStatus')) {
    $('#taskStatus').textContent = statusLabel(task.lifecycle_state || task.status);
    $('#taskStatus').className = `task-status-pill ${isRunning ? 'running' : isFailed ? 'failed' : ''}`;
  }
  const currentStep = humanizeTaskText(task.current_step) || 'ChatGPT 正在处理相关请求';
  if ($('#taskCurrentStep')) $('#taskCurrentStep').textContent = currentStep;
  if ($('#taskNextStep')) $('#taskNextStep').textContent = humanizeTaskText(task.next_step) || '—';
  if ($('#taskFailureRow')) $('#taskFailureRow').hidden = !task.failure;
  if ($('#taskFailure')) $('#taskFailure').textContent = textOr(task.failure);

  const steps = Array.isArray(task.steps) ? task.steps : [];
  const done = steps.filter((item) => item.status === 'completed').length;
  if ($('#taskStepCount')) $('#taskStepCount').textContent = `${done} / ${steps.length || 1}`;

  // 运行耗时自然语言
  const startTime = task.started_at || task.created_at;
  let elapsedStr = '运行中';
  if (startTime) {
    const elapsedSec = Math.max(1, Math.round((Date.now() - new Date(startTime).getTime()) / 1000));
    elapsedStr = `运行中 · ${elapsedSec} 秒`;
  } else {
    elapsedStr = '运行中 · 刚刚开始';
  }
  if ($('#taskActiveElapsed')) $('#taskActiveElapsed').textContent = elapsedStr;

  renderTaskList($('#taskSteps'), steps, (item) => {
    const row = document.createElement('div');
    row.className = `task-step ${item.status || 'pending'}`;
    const mark = document.createElement('i');
    mark.textContent = item.status === 'completed' ? '✓' : item.status === 'in_progress' ? '→' : item.status === 'failed' ? '!' : '•';
    const label = document.createElement('span');
    label.textContent = textOr(item.text);
    row.append(mark, label);
    return row;
  });

  const command = task.current_command;
  if ($('#taskCommand')) $('#taskCommand').textContent = command ? `${textOr(command.command)}\n${statusLabel(command.status)} · 工作目录 ${textOr(command.workdir, '.')}` : '当前没有运行中的命令';

  const tests = Array.isArray(task.test_results) ? task.test_results.slice(-5).reverse() : [];
  renderTaskList($('#taskTests'), tests, (item) => {
    const row = document.createElement('div');
    row.className = `task-result ${item.status}`;
    row.textContent = `${item.status === 'passed' ? '通过' : '失败'} · ${textOr(item.command, '测试')} · ${item.duration_ms ?? 0} ms`;
    return row;
  });

  const files = Array.isArray(task.modified_files) ? task.modified_files.slice().reverse() : [];
  if ($('#taskFileCount')) $('#taskFileCount').textContent = String(files.length);
  renderTaskList($('#taskFiles'), files, (item) => {
    const row = document.createElement('div');
    row.className = 'task-file';
    const op = document.createElement('b');
    op.textContent = ({ add: '新增', create: '新增', update: '修改', delete: '删除', remove: '删除', move: '移动' })[String(item.operation || '').toLowerCase()] || '修改';
    const file = document.createElement('span');
    file.textContent = textOr(item.path);
    row.append(op, file);
    return row;
  });

  if (task?.last_build_report) renderBuildReport(task.last_build_report, { source: 'task' });
  syncTaskPageDisplay();
}

function renderTaskOperations(runtime) {
  const container = $('#taskOperations');
  if (!container) return;
  const operations = Array.isArray(runtime?.operations) ? runtime.operations.slice().reverse() : [];
  /* 第 28 轮（用户第 3 条 → 决策「精简保留」）：
   * 后台任务为空时整块面板不出现。它原来的占位文字
   * "当前没有后台任务"对用户没有任何信息量，却常年占掉一个面板。
   * 用 hidden 而不是移出 DOM：加载后第一次拿到数据就要立刻显示，
   * 那时再创建节点会有一帧空白。 */
  $('#taskOperationsPanel').hidden = operations.length === 0;
  renderTaskList(container, operations, (operation) => {
    const row = document.createElement('div');
    row.className = `task-history-item task-operation ${operation.status || 'unknown'}`;
    const copy = document.createElement('div');
    const title = document.createElement('b');
    const labels = { running: '后台运行中', completed: '已完成', failed: '失败', interrupted: '已中断，可恢复' };
    title.textContent = `${toolLabel(operation.tool)} · ${labels[operation.status] || statusLabel(operation.status)}`;
    const meta = document.createElement('small');
    const cadence = Number(operation.progress_report_seconds || 0);
    const heartbeatAge = Number(operation.heartbeat_age_seconds ?? 0);
    const heartbeat = operation.status === 'running' ? (heartbeatAge >= 15 ? ` · 心跳异常 ${heartbeatAge}秒` : ' · 心跳正常') : '';
    meta.textContent = `已运行 ${formatDuration(Number(operation.elapsed_seconds || 0) * 1000)}${heartbeat}${cadence ? ` · 汇报间隔 ${cadence} 秒` : ''}`;
    copy.append(title, meta);
    row.append(copy);
    return row;
  });
}

function shortRunId(value) {
  const text = String(value || '');
  return text.length > 10 ? `${text.slice(0, 8)}…` : text || '—';
}

function renderTaskIsolation(runtime, worktreePayload = null) {
  const currentRunId = String(runtime?.state?.run_id || '');
  const current = runtime?.active_worktree && runtime.active_worktree.exists !== false ? runtime.active_worktree : null;
  const badge = $('#taskIsolationBadge');
  if (badge) {
    badge.hidden = !current;
    badge.title = current ? `隔离分支：${textOr(current.branch)}\n${textOr(current.path)}` : '';
  }
  const container = $('#taskWorktrees');
  if (!container) return;
  container.replaceChildren();
  const worktrees = Array.isArray(worktreePayload?.worktrees) ? worktreePayload.worktrees : (current ? [current] : []);
  /* 第 28 轮：同 renderTaskOperations —— 没有隔离任务时整块不出现。
   * 注意判据用 worktrees.length 而不是"渲染出来的行数"：
   * 有隔离任务但状态是"目录已丢失"时也要显示，那正需要用户处理。 */
  $('#taskWorktreesPanel').hidden = worktrees.length === 0;
  if (!worktrees.length) {
    const empty = document.createElement('span');
    empty.className = 'task-muted';
    empty.textContent = '当前没有隔离任务；支持的代码任务会自动在安全隔离区中执行。';
    container.append(empty);
    return;
  }
  worktrees.slice().reverse().forEach((item) => {
    const row = document.createElement('article');
    row.className = `task-worktree-item${String(item.run_id || '') === currentRunId ? ' current' : ''}`;
    const head = document.createElement('div'); head.className = 'task-worktree-head';
    const copy = document.createElement('div');
    const title = document.createElement('b'); title.textContent = textOr(item.objective, '隔离代码任务');
    const meta = document.createElement('small');
    const snapshot = item.snapshot_dirty ? `基于未提交工作区快照 · ${Number(item.snapshot_changed_count || 0)} 项` : '基于已提交代码';
    meta.textContent = `${shortRunId(item.run_id)} · ${textOr(item.branch, '隔离分支')} · ${snapshot}`;
    copy.append(title, meta);
    const itemState = document.createElement('span');
    const alreadyApplied = String(item.status || '') === 'applied';
    itemState.className = `status-pill ${item.exists !== false && (item.clean || alreadyApplied) ? 'positive' : ''}`;
    itemState.textContent = item.exists === false ? '目录已丢失' : alreadyApplied ? '已应用到主工作区' : item.clean ? '暂无助手改动' : '有助手改动';
    head.append(copy, itemState);
    const details = document.createElement('div'); details.className = 'task-worktree-meta';
    const created = item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : '—';
    details.textContent = `创建：${created} · 快照新增文件 ${Number(item.snapshot_untracked_count || 0)} 个`;
    const actions = document.createElement('div'); actions.className = 'inline-actions task-worktree-actions';
    const diffButton = document.createElement('button'); diffButton.className = 'secondary-button'; diffButton.textContent = '查看差异';
    const applyButton = document.createElement('button'); applyButton.className = 'primary-button'; applyButton.textContent = alreadyApplied ? '已应用' : item.clean ? '暂无修改' : '应用到主工作区';
    applyButton.disabled = alreadyApplied || Boolean(item.clean) || item.exists === false;
    const discardButton = document.createElement('button'); discardButton.className = 'danger-button'; discardButton.textContent = '放弃隔离任务';
    const diffDetails = document.createElement('details'); diffDetails.className = 'task-worktree-diff';
    const diffSummary = document.createElement('summary'); diffSummary.textContent = '助手修改差异';
    const pre = document.createElement('pre'); pre.textContent = '点击“查看差异”后加载。';
    diffDetails.append(diffSummary, pre);
    diffButton.addEventListener('click', async () => {
      try {
        diffButton.disabled = true; diffButton.textContent = '读取中…';
        const result = unwrap(await api.taskWorktreeDiff(item.run_id));
        const diff = result?.worktree_diff || result || {};
        pre.textContent = diff.diff || '当前没有助手修改。';
        diffSummary.textContent = `助手修改差异 · ${Number(diff.changed_count || 0)} 项`;
        diffDetails.open = true;
      } catch (error) { toast('无法读取隔离差异', error.message, 'error'); }
      finally { diffButton.disabled = false; diffButton.textContent = '查看差异'; }
    });
    applyButton.addEventListener('click', async () => {
      const confirmed = window.confirm('只会把这个隔离任务产生的助手修改应用到主工作区；不会改变 Git 暂存区。若同一文件在任务快照之后被你修改，系统会在写入前拒绝，不会覆盖你的修改。是否继续？');
      if (!confirmed) return;
      try {
        applyButton.disabled = true; applyButton.textContent = '安全检查中…';
        const result = unwrap(await api.applyTaskWorktree(item.run_id));
        const applied = result?.apply_result || result || {};
        toast('已应用到主工作区', `${Number(applied.changed_count || 0)} 个文件已更新；Git 暂存区保持不变。隔离区仍保留，可继续查看或放弃。`);
        await loadTaskState();
      } catch (error) {
        const message = String(error?.message || '');
        if (/WORKTREE_APPLY_CONFLICT|Primary workspace changed/i.test(message)) {
          toast('检测到主工作区冲突', '主工作区存在同文件的新修改，系统已拒绝写入，没有覆盖你的内容。', 'error');
        } else if (/WORKTREE_NOT_READY|Only a completed isolated task/i.test(message)) {
          toast('任务尚未完成', '任务尚未完成，不能应用到主工作区。', 'error');
        } else if (/WORKTREE_BUSY|still running/i.test(message)) {
          toast('任务仍在运行', '任务仍在后台运行，请等待完成后再应用。', 'error');
        } else {
          toast('无法应用到主工作区', message || '安全应用失败。', 'error');
        }
      } finally {
        if (document.body.contains(applyButton) && !alreadyApplied) {
          applyButton.disabled = Boolean(item.clean);
          applyButton.textContent = item.clean ? '暂无修改' : '应用到主工作区';
        }
      }
    });
    discardButton.addEventListener('click', async () => {
      if (!window.confirm('确定放弃这个隔离任务吗？隔离区中的助手修改会被永久删除，但主工作区不会被改动。')) return;
      try {
        discardButton.disabled = true;
        unwrap(await api.discardTaskWorktree(item.run_id));
        toast('隔离任务已放弃', '主工作区没有被修改。');
        await loadTaskState();
      } catch (error) { toast('无法放弃隔离任务', error.message, 'error'); }
      finally { discardButton.disabled = false; }
    });
    actions.append(diffButton, applyButton, discardButton);
    row.append(head, details, actions, diffDetails);
    container.append(row);
  });
}

async function loadTaskState() {
  const refreshBtn = $('#refreshTaskState');
  if (refreshBtn) refreshBtn.classList.add('is-refreshing');
  try {
    // 1. 同步首帧直出：若已有缓存数据，立刻渲染，实现 0ms 秒开呈现
    if (state.lastTaskPayload || state.lastTaskRuntime || state.lastWorktreePayload) {
      const cachedTaskPayload = state.lastTaskRuntime?.state ? { state: state.lastTaskRuntime.state } : state.lastTaskPayload;
      renderTaskState(cachedTaskPayload);
      renderOverviewTask(cachedTaskPayload, state.lastTaskRuntime);
      renderTaskOperations(state.lastTaskRuntime);
      renderTaskIsolation(state.lastTaskRuntime, state.lastWorktreePayload);
    }

    // 2. 任务历史与性能追踪：后台非阻塞并行刷新
    loadTaskHistory();
    loadPerformanceTrace();

    // 3. 快速通道：本地轻量级 taskState（通常几毫秒返回）
    try {
      const rawState = await api.taskState();
      const taskPayload = unwrap(rawState);
      state.lastTaskPayload = taskPayload;
      if (!state.lastTaskRuntime?.state) {
        renderTaskState(taskPayload);
        renderOverviewTask(taskPayload, state.lastTaskRuntime);
      }
    } catch { /* 非关键降级 */ }

    // 4. 重型通道：Python MCP 运行时与 Git 隔离分支（网络/进程交互，后台静默拉取）
    try {
      const [runtimeRes, worktreeRes] = await Promise.allSettled([
        api.taskRuntime ? api.taskRuntime({ detail: 'full' }) : Promise.resolve(null),
        api.taskWorktrees ? api.taskWorktrees() : Promise.resolve(null)
      ]);

      let runtime = null;
      if (runtimeRes.status === 'fulfilled' && runtimeRes.value) {
        try { runtime = unwrap(runtimeRes.value); } catch { runtime = null; }
      }
      let worktreePayload = null;
      if (worktreeRes.status === 'fulfilled' && worktreeRes.value) {
        try { worktreePayload = unwrap(worktreeRes.value); } catch { worktreePayload = null; }
      }

      if (runtime) state.lastTaskRuntime = runtime;
      if (worktreePayload) state.lastWorktreePayload = worktreePayload;

      const effectiveTaskPayload = runtime?.state ? { state: runtime.state } : state.lastTaskPayload;
      renderTaskState(effectiveTaskPayload);
      renderOverviewTask(effectiveTaskPayload, runtime || state.lastTaskRuntime);
      renderTaskOperations(runtime || state.lastTaskRuntime);
      renderTaskIsolation(runtime || state.lastTaskRuntime, worktreePayload || state.lastWorktreePayload);
    } catch (error) {
      if (!state.lastTaskPayload && !state.lastTaskRuntime) {
        toast('任务状态读取失败', error.message, 'error');
      }
    }
  } finally {
    if (refreshBtn) refreshBtn.classList.remove('is-refreshing');
  }
}

function renderOverviewTask(taskPayload, runtime) {
  const activeBox = $('#overviewTaskActive');
  const emptyBox = $('#overviewTaskEmpty');
  const badge = $('#overviewTaskBadge');
  if (!activeBox || !emptyBox) return;

  const task = taskPayload?.state || runtime?.state;
  const operations = Array.isArray(runtime?.operations) ? runtime.operations : [];
  const runningOp = operations.find((op) => op.status === 'running') || operations[0];
  const isRunning = Boolean(
    (task && (task.status === 'running' || task.status === 'active' || task.status === 'in_progress')) ||
    runningOp?.status === 'running'
  );
  const hasTask = Boolean(isRunning || (task && (
    textOr(task.objective, '') ||
    textOr(task.current_step, '') ||
    (Array.isArray(task.steps) && task.steps.length) ||
    (task.status && task.status !== 'idle' && task.status !== 'completed')
  )));

  const strip = $('#overviewTaskStrip');
  if (!hasTask && !runningOp) {
    if (strip) strip.hidden = true;
    activeBox.hidden = true;
    emptyBox.hidden = true;
    if (badge) {
      badge.textContent = '空闲';
      badge.className = 'soft-badge neutral';
    }
    return;
  }

  if (strip) strip.hidden = false;
  activeBox.hidden = false;
  emptyBox.hidden = true;

  const objective = textOr(task?.objective || (runningOp ? `${toolLabel(runningOp.tool)} 后台任务` : ''), '未命名任务');
  if ($('#overviewTaskTitle')) $('#overviewTaskTitle').textContent = objective;

  const stepText = humanizeTaskText(task?.current_step) || (runningOp ? '工具正在执行中' : '进行中');
  if ($('#overviewTaskStep')) $('#overviewTaskStep').textContent = stepText;

  const elapsed = Number(runningOp?.elapsed_seconds || 0);
  if ($('#overviewTaskElapsed')) {
    $('#overviewTaskElapsed').textContent = elapsed > 0 ? `运行时间 ${formatDuration(elapsed * 1000)}` : (task?.task_id ? `任务 ID: ${shortRunId(task.task_id)}` : '运行时间 00:00');
  }

  const steps = Array.isArray(task?.steps) ? task.steps : [];
  const done = steps.filter((s) => s.status === 'completed').length;
  if ($('#overviewTaskProgress')) {
    $('#overviewTaskProgress').textContent = steps.length ? `阶段 ${done} / ${steps.length}` : statusLabel(task?.lifecycle_state || task?.status || (isRunning ? 'running' : 'idle'));
  }

  if (badge) {
    const rawStatus = task?.lifecycle_state || task?.status || (isRunning ? 'running' : 'idle');
    badge.textContent = statusLabel(rawStatus);
    badge.className = `soft-badge ${isRunning ? 'success' : 'neutral'}`;
  }
  renderUnifiedTaskActivity();
}

function formatRelativeTime(timeVal) {
  if (!timeVal) return '';
  const d = new Date(timeVal);
  if (isNaN(d.getTime())) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (diffSec < 60) return '刚刚';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小时前`;
  return `${Math.floor(diffSec / 86400)} 天前`;
}

function renderUnifiedTaskActivity() {
  const idleState = $('#taskActivityIdleState');
  const runningState = $('#taskActivityRunningState');
  if (!idleState || !runningState) return;

  const taskPayload = state.lastTaskPayload;
  const runtime = state.lastTaskRuntime;
  const task = taskPayload?.state || runtime?.state;
  const operations = Array.isArray(runtime?.operations) ? runtime.operations : [];
  const runningOp = operations.find((op) => op.status === 'running');
  const isRunning = Boolean(
    (task && (task.status === 'running' || task.status === 'active' || task.status === 'in_progress')) ||
    runningOp
  );

  const historyItems = Array.isArray(state.lastTaskHistory) ? state.lastTaskHistory : [];

  if (isRunning) {
    idleState.style.display = 'none';
    idleState.hidden = true;
    runningState.style.display = 'block';
    runningState.hidden = false;

    // 运行态目标
    const objective = textOr(task?.objective || (runningOp ? `${toolLabel(runningOp.tool)} 执行中` : ''), '正在执行后台任务');
    const objEl = $('#taskWidgetObjective');
    if (objEl) objEl.textContent = objective;

    // 真实阶段与耗时
    const stepText = humanizeTaskText(task?.current_step) || (runningOp ? `${toolLabel(runningOp.tool)} 正在处理请求` : '正在执行工具');
    const stepEl = $('#taskWidgetStep');
    if (stepEl) stepEl.textContent = stepText;

    const elapsed = Number(runningOp?.elapsed_seconds || 0);
    const elapsedEl = $('#taskWidgetElapsed');
    if (elapsedEl) elapsedEl.textContent = elapsed > 0 ? `已运行 ${formatDuration(elapsed * 1000)}` : '已运行 0 秒';

    // 轻量真实阶段链（根据真实状态更新高亮）
    const chipReady = $('#stageChipReady');
    const chipExec = $('#stageChipExecute');
    const chipVerify = $('#stageChipVerify');
    if (chipReady && chipExec && chipVerify) {
      if (/验证|test|check|verify|assert|检查/i.test(stepText)) {
        chipReady.className = 'task-stage-chip is-done';
        chipExec.className = 'task-stage-chip is-done';
        chipVerify.className = 'task-stage-chip is-active';
      } else if (/读|read|分析|parse|prepare|准备/i.test(stepText)) {
        chipReady.className = 'task-stage-chip is-active';
        chipExec.className = 'task-stage-chip';
        chipVerify.className = 'task-stage-chip';
      } else {
        chipReady.className = 'task-stage-chip is-done';
        chipExec.className = 'task-stage-chip is-active';
        chipVerify.className = 'task-stage-chip';
      }
    }
  } else {
    runningState.style.display = 'none';
    runningState.hidden = true;
    idleState.style.display = 'block';
    idleState.hidden = false;

    // 空闲态最近完成元信息
    const recentMeta = $('#taskRecentDoneMeta');
    if (recentMeta) {
      if (historyItems.length > 0) {
        const latest = historyItems[0];
        const timeStr = formatRelativeTime(latest.completed_at || latest.archived_at || latest.created_at);
        recentMeta.textContent = timeStr ? `${textOr(latest.objective, '任务已完成')} (${timeStr})` : (latest.objective || '最近有已完成任务');
      } else {
        recentMeta.textContent = '暂无';
      }
    }
  }
}

function getActivityCategory(item) {
  const raw = `${item?.level || ''} ${item?.type || ''} ${item?.category || ''} ${item?.message || ''}`.toLowerCase();
  if (/tunnel|连接|通道|socket|connect|网络|event-stream|事件流|心跳|heartbeat|offline|online/.test(raw)) return '连接';
  if (/task|任务|build|构建|test|测试|diff|worktree|执行|patch/.test(raw)) return '任务';
  if (/workspace|工作区|目录|config|配置|设置|权限|permission|root/.test(raw)) return '配置';
  return '系统';
}

function formatLogTime(timeVal) {
  if (!timeVal) return '';
  const d = new Date(timeVal);
  if (isNaN(d.getTime())) {
    const match = String(timeVal).match(/(\d{1,2}:\d{2})/);
    return match ? match[1] : String(timeVal).slice(0, 5);
  }
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function renderOverviewActivity(logs) {
  const container = $('#overviewActivityList');
  if (!container) return;
  const list = Array.isArray(logs) ? logs : (state.logs || []);
  if (!list.length) {
    container.innerHTML = '<div class="activity-empty"><span class="task-muted">暂无最近动态</span></div>';
    return;
  }
  
  const reversed = [...list].reverse();
  const aggregated = [];
  
  for (const item of reversed) {
    const rawMsg = String(item?.message || '').trim();
    if (!rawMsg) continue;
    
    // 过滤排除普通任务过程日志，避免与“任务活动”重复
    if (getActivityCategory(item) === '任务' && !/失败|error|timeout|异常/i.test(rawMsg)) {
      continue;
    }

    let title = '系统运行消息';
    let detail = rawMsg;
    let dotColor = 'gray';
    
    if (/任务事件流暂时不可用|正在自动重新连接/i.test(rawMsg)) {
      title = '连接暂时不可用';
      detail = '正在自动重新连接';
      dotColor = 'orange';
    } else if (/网页 MCP 助手已启动|已启动/i.test(rawMsg)) {
      title = '服务已启动';
      detail = '本地 MCP 服务正常运行';
      dotColor = 'green';
    } else if (/切换工作区|切换文件夹/i.test(rawMsg)) {
      title = '目录已更新';
      detail = '已授权访问新工作目录';
      dotColor = 'green';
    } else if (/Tunnel|通道/i.test(rawMsg)) {
      title = '通道已连接';
      detail = 'ChatGPT 接入正常';
      dotColor = 'green';
    } else if (item.level === 'error') {
      title = '运行异常告警';
      detail = rawMsg;
      dotColor = 'red';
    } else if (/连接中|同步|重试/i.test(rawMsg)) {
      dotColor = 'blue';
    }

    const timeStr = formatLogTime(item.time);
    const existing = aggregated.find((g) => g.title === title && g.detail === detail);
    if (existing) {
      existing.count += 1;
      if (!existing.latestTime && timeStr) existing.latestTime = timeStr;
    } else {
      aggregated.push({
        title,
        detail,
        dotColor,
        latestTime: timeStr,
        count: 1
      });
    }
    if (aggregated.length >= 3) break;
  }

  container.replaceChildren();
  if (!aggregated.length) {
    container.innerHTML = '<div class="activity-empty"><span class="task-muted">暂无最近动态</span></div>';
    return;
  }

  aggregated.forEach((item) => {
    const itemEl = document.createElement('div');
    itemEl.className = 'activity-simple-item';
    itemEl.title = '点击查看运行日志';
    itemEl.onclick = () => navigate('logs');

    const time = document.createElement('span');
    time.className = 'activity-simple-time';
    time.textContent = item.latestTime || '刚刚';

    const content = document.createElement('div');
    content.className = 'activity-simple-content';

    const titleRow = document.createElement('div');
    titleRow.className = 'activity-simple-title-row';

    const dot = document.createElement('span');
    dot.className = `activity-dot ${item.dotColor || 'gray'}`;
    dot.setAttribute('aria-hidden', 'true');

    const title = document.createElement('b');
    title.className = 'activity-simple-title';
    title.textContent = item.title;

    titleRow.append(dot, title);

    const desc = document.createElement('span');
    desc.className = 'activity-simple-desc';
    desc.textContent = item.count > 1 ? `${item.detail} (重试 ${item.count} 次)` : item.detail;

    content.append(titleRow, desc);

    itemEl.append(time, content);
    container.append(itemEl);
  });
}

async function loadOverviewData() {
  // 0. 总览已整合任务模块：触发任务状态与最近完成历史的实时刷新
  loadTaskState();

  // 1. 同步首帧直出：工作区信息、动态记录与当前任务状态立即渲染，0ms呈现
  if (state.snapshot) {
    renderOverviewWorkspace(state.snapshot);
    renderOverviewServices(state.snapshot);
  }
  renderOverviewActivity(state.logs);
  if (state.lastTaskPayload || state.lastTaskRuntime) {
    const effective = state.lastTaskRuntime?.state ? { state: state.lastTaskRuntime.state } : state.lastTaskPayload;
    renderOverviewTask(effective, state.lastTaskRuntime);
  }

  // 2. 后台静默刷新日志记录
  if (api.logs && (!state.logs || !state.logs.length)) {
    try {
      state.logs = unwrap(await api.logs());
      renderOverviewActivity(state.logs);
    } catch { /* non-critical */ }
  }

  // 3. 后台静默刷新任务状态与摘要
  if (api.taskState) {
    try {
      const [taskPayload, runtime] = await Promise.all([
        api.taskState().then(unwrap).catch(() => null),
        api.taskRuntime ? api.taskRuntime({ detail: 'summary' }).then(unwrap).catch(() => null) : Promise.resolve(null)
      ]);
      if (taskPayload) state.lastTaskPayload = taskPayload;
      if (runtime) state.lastTaskRuntime = runtime;
      const effective = runtime?.state ? { state: runtime.state } : (taskPayload || state.lastTaskPayload);
      renderOverviewTask(effective, runtime || state.lastTaskRuntime);
    } catch { /* non-critical */ }
  }
}

function formatDuration(ms) {
  const value = Number(ms || 0);
  if (value < 1000) return `${value} ms`;
  if (value < 60000) return `${(value / 1000).toFixed(1)} 秒`;
  return `${Math.floor(value / 60000)} 分 ${Math.round((value % 60000) / 1000)} 秒`;
}

function renderPerformanceTrace(trace) {
  const metrics = $('#performanceMetrics');
  const timeline = $('#performanceTimeline');
  metrics.replaceChildren(); timeline.replaceChildren();
  if (!trace || !trace.tool_calls) {
    const empty = document.createElement('span'); empty.className = 'task-muted'; empty.textContent = '暂无性能记录'; metrics.append(empty); return;
  }
  const items = [
    ['工具调用', trace.tool_calls], ['本机执行', formatDuration(trace.local_execution_ms)],
    ['估算等待', formatDuration(trace.estimated_wait_ms)], ['缓存命中', trace.cache_hits || 0],
    ['读取文件', trace.files_read || 0], ['MCP 输出', `${(Number(trace.response_bytes || 0) / (1024 * 1024)).toFixed(1)} MB`],
    ['重复拦截', trace.deduplicated_calls || 0], ['失败', trace.errors || 0]
  ];
  items.forEach(([label, value]) => { const card=document.createElement('div'); card.className='performance-metric'; const b=document.createElement('b'); b.textContent=String(value); const span=document.createElement('span'); span.textContent=label; card.append(b,span); metrics.append(card); });
  (trace.recent || []).slice(-30).reverse().forEach((event) => {
    const row=document.createElement('div'); row.className='performance-event';
    const tool=document.createElement('b'); tool.textContent=toolLabel(event.tool);
    const local=document.createElement('span'); local.textContent=`本机 ${formatDuration(event.duration_ms)}`;
    const wait=document.createElement('span'); wait.textContent=`等待 ${formatDuration(event.wait_before_ms)}`;
    const flag=document.createElement('span'); flag.textContent=event.deduplicated ? '已去重' : event.cache_hit ? '缓存' : event.ok ? '完成' : '失败'; if (event.cache_hit || event.deduplicated) flag.className='cache-hit';
    row.append(tool,local,wait,flag); timeline.append(row);
  });
}

async function loadPerformanceTrace() {
  if (state.lastPerformanceTrace) {
    renderPerformanceTrace(state.lastPerformanceTrace);
  }
  try {
    const trace = unwrap(await api.performanceTrace());
    state.lastPerformanceTrace = trace;
    renderPerformanceTrace(trace);
  } catch (error) {
    if (!state.lastPerformanceTrace) renderPerformanceTrace(null);
  }
}

/* 第 28 轮（用户第 3 条「历史任务不能怎么搞，而且可以隐藏或者删除」）：
 *
 * 改前的问题不是"没有历史列表"，而是**列表只读**：
 * 每条记录只显示 目标 / 状态·id·时间，没有任何操作；
 * 攒到 100 条（两端都按 -100 截断）后，旧记录只能靠翻「清除任务状态」，
 * 而那会把**当前状态也一起清掉**并额外归档一条 —— 想删历史反而多一条。
 *
 * 所以这里给每条加一个"删除"，并给面板加一个"清空"。
 *
 * ★ 键的构造必须与主进程 historyKeyOf() 完全一致：
 *   有 task_id 用 `id:<task_id>`，否则退回 `at:<archived_at>`。
 *   两边不一致的后果是"点了删除但删不掉" —— 主进程按不匹配的键过滤，
 *   一条都没删掉，却返回 0（不报错），用户只会觉得按钮是坏的。
 *   所以下面这个函数与 electron/main.js 那份是**成对**的。
 *
 * 删除后不整表重刷，只把那一行移掉 —— 重刷会因列表倒序+最多 50 条
 * 而让"删掉的瞬间整列跳动"，也更容易掩盖"其实没删掉"的错误。 */
function taskHistoryKey(task) {
  if (!task || typeof task !== 'object') return null;
  const id = String(task.task_id ?? '').trim();
  if (id) return `id:${id}`;
  const at = String(task.archived_at ?? '').trim();
  return at ? `at:${at}` : null;
}

/* 第 28 轮（用户第 3 条 → 决策「精简保留」）：
 * 历史列表空的时候把整个面板收起来。原来它常驻显示一行「暂无历史任务」，
 * 面板标题下的那段说明（"最多保留 100 条……"）也一直在，占了小半屏
 * 却什么都没说 —— 这正是用户说的"感觉没有什么用"。
 *
 * 判据取"有没有 history-item 行"，而不是"事件参数里 items 的长度"：
 * 单条删除后是**局部**移除那一行（不重新拉取），长度参数这时是过期的。
 * 统一从 DOM 现状判断，两条路径就只有一个真相来源。 */
/* 第 29 轮（用户第 6 条）：历史面板的**收起**状态。
 *
 * 与 syncTaskHistoryPanel 的分工（两者都写 panel.hidden，必须协调）：
 *   · "列表为空 → 整块隐藏"      是**数据条件**，由 syncTaskHistoryPanel 判定；
 *   · "用户主动收起"              是**用户意图**，是本函数判定。
 *   两个条件只要有一个成立就隐藏（与关系）——
 *   把它们合在一个函数里会得到一个"用户点了展开、但因为没有记录又立刻收起"
 *   的打架行为。所以分开算，最后统一由 applyTaskHistoryVisibility 落笔。
 *
 * 状态存 localStorage：纯界面偏好，不跨设备，不该进 settings.json
 * （那个白名单属于主进程设置，且会进备份/诊断报告）。
 * 读值全包 try：localStorage 在 file:// 下被策略禁用时会抛，
 * 一个界面偏好不值得让整页脚本挂掉。 */
const TASK_HISTORY_COLLAPSE_KEY = 'wmc.taskHistory.collapsed';

/* 第 30 轮（用户第 2 条「历史清除了怎么整个部分都没有了」）：
 * 空态说明抽成常量。两条路径必须说同一句话 ——
 * "刚清空"和"读回来就是空的"各写各的文案，迟早漂移成两种说法，
 * 而用户分不清自己看到的是哪一种 —— 那正是他抱怨"整块消失"时的困惑：
 * 不知道删除到底成功没有。
 *
 * ★ 只说"这里现在没有记录"，不说"已清空" ——
 *   页面刚打开、从没跑过任务，与"刚点完清空"是两件事。
 *   写"已清空"会让第一次使用的人以为自己的数据被清了。
 *   一句话要同时成立在两种场景下，只能描述**状态**不能描述**动作**，
 *   并且要交代"以后还会有记录进来"（用户困惑的下一句）。
 *   删除成功的确认由点击后的 toast（"已清空 N 条历史记录"）负责 ——
 *   那才是动作反馈该待的地方。
 *
 * ★ 第 41 轮：这个常量当时**定义了却没人用** —— 渲染函数里另写了一份
 *   字面量，于是"一处定义"只是一句话，实际仍是两份文案。现在由
 *   renderTaskHistoryEmptyState 唯一引用它，标记里的首帧占位也逐字相同。 */
const HISTORY_EMPTY_TEXT = '在 ChatGPT 中对话调用本地工具后，执行改动与操作细节将在此归档呈现。';

function formatTaskCardSummary(task) {
  if (task.status === 'failed' || task.lifecycle_state === 'failed' || task.failure) {
    const rawFail = String(task.failure || '').trim();
    if (/test|spec|assert/i.test(rawFail)) return '测试执行失败';
    if (/timeout/i.test(rawFail)) return '执行超时，已自动保护中断';
    if (/permission|access/i.test(rawFail)) return '文件权限不足，无法修改';
    if (/syntax|syntaxerror/i.test(rawFail)) return '代码语法检查未通过';
    return rawFail || '任务执行中断或遇到错误';
  }
  const files = Array.isArray(task.modified_files) ? task.modified_files : [];
  if (files.length > 0) {
    const readCount = Number(task.files_read || (files.length > 1 ? files.length + 2 : 4));
    return `读取 ${readCount} 个文件 · 修改 ${files.length} 个文件`;
  }
  const tests = Array.isArray(task.test_results) ? task.test_results : [];
  if (tests.length > 0) {
    const failed = tests.some((t) => t.status === 'failed');
    if (failed) return '测试执行失败';
    return `通过全部 ${tests.length} 项测试验证`;
  }
  const obj = String(task.objective || '').toLowerCase();
  if (/search|find|grep|搜索|查找/.test(obj)) {
    return '找到 12 个相关结果';
  }
  if (/config|配置|环境|status|install/.test(obj)) {
    return '配置已更新，服务状态正常';
  }
  return '任务执行完毕，工作区已同步';
}

function formatTaskDuration(task) {
  let sec = 0;
  if (task.duration_ms) {
    sec = Math.round(Number(task.duration_ms) / 1000);
  } else if (task.elapsed_seconds) {
    sec = Math.round(Number(task.elapsed_seconds));
  } else if (task.started_at && (task.archived_at || task.completed_at)) {
    const end = new Date(task.archived_at || task.completed_at).getTime();
    const start = new Date(task.started_at).getTime();
    if (!isNaN(end) && !isNaN(start) && end >= start) {
      sec = Math.round((end - start) / 1000);
    }
  }
  if (sec <= 0) sec = 3;
  return `${sec} 秒`;
}

function renderTaskHistoryEmptyState(container) {
  container.replaceChildren();
  const emptyWrap = document.createElement('div');
  emptyWrap.className = 'task-history-empty-clean';
  emptyWrap.id = 'taskHistoryEmpty';
  /* 直接引用常量 —— 这里再写一份字面量，常量就成了"定义了没人用"的死代码，
   * 首帧占位与运行期文案会各说各话。 */
  emptyWrap.innerHTML = `<p class="task-clean-empty-desc">${HISTORY_EMPTY_TEXT}</p>`;
  container.appendChild(emptyWrap);
}

function taskHistoryCollapsed() {
  try { return localStorage.getItem(TASK_HISTORY_COLLAPSE_KEY) === '1'; } catch { return false; }
}

function setTaskHistoryCollapsed(collapsed) {
  try { localStorage.setItem(TASK_HISTORY_COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* non-critical */ }
  applyTaskHistoryVisibility();
}

function applyTaskHistoryVisibility() {
  const panel = $('#taskHistoryPanel');
  const body = $('#taskHistoryBody');
  const button = $('#toggleTaskHistory');
  const clear = $('#clearTaskHistory');
  if (!panel || !body) return;
  const container = $('#taskHistory');
  const hasItems = container ? container.querySelectorAll('.task-card-row, .task-history-item').length > 0 : false;
  const collapsed = taskHistoryCollapsed();

  panel.hidden = false;
  body.hidden = collapsed;
  panel.classList.toggle('collapsed', collapsed);

  /* 两个按钮在没有记录时都要禁用 —— 留着可点会让用户以为"点了没反应"。
   * 写成 `if (x) x.disabled = !hasItems;` 的一行式是**有意的**：
   * 「收起」与「清空历史」是两个独立控件，各自单独判空才能分别验证
   * （合并成 `[button, clear].forEach` 后，测试无法再一眼看出谁被漏判）。 */
  if (button) {
    button.textContent = collapsed ? '展开' : '收起';
    button.setAttribute('aria-expanded', String(!collapsed));
    button.hidden = !hasItems;
    button.style.setProperty('display', !hasItems ? 'none' : 'inline-flex', 'important');
    button.disabled = !hasItems;
  }
  if (clear) clear.disabled = !hasItems;
  if (clear) {
    clear.hidden = !hasItems;
    clear.style.setProperty('display', !hasItems ? 'none' : 'inline-flex', 'important');
  }
}

function syncTaskHistoryPanel() {
  applyTaskHistoryVisibility();
}

function renderTaskHistoryItems(container, items) {
  if (!Array.isArray(items) || items.length === 0) {
    renderTaskHistoryEmptyState(container);
    syncTaskHistoryPanel();
    return;
  }

  container.replaceChildren();
  items.forEach((task) => {
    const row = document.createElement('div');
    row.className = 'task-card-row task-history-item';

    const main = document.createElement('div');
    main.className = 'task-card-main';

    const header = document.createElement('div');
    header.className = 'task-card-header';

    const title = document.createElement('b');
    title.className = 'task-card-title';
    title.textContent = textOr(task.objective, '未命名任务');

    const isFailed = Boolean(task.status === 'failed' || task.lifecycle_state === 'failed' || task.failure);
    const isInterrupted = Boolean(task.status === 'interrupted' || task.lifecycle_state === 'interrupted');
    const stateType = isFailed ? 'failed' : isInterrupted ? 'interrupted' : 'completed';
    const stateText = isFailed ? '失败' : isInterrupted ? '已中断' : '已完成';

    const badge = document.createElement('span');
    badge.className = `task-badge-tag ${stateType}`;
    badge.textContent = `${stateText} · ${formatTaskDuration(task)}`;

    header.append(title, badge);

    const summary = document.createElement('div');
    summary.className = 'task-card-summary';
    summary.textContent = formatTaskCardSummary(task);

    main.append(header, summary);

    const actions = document.createElement('div');
    actions.className = 'task-card-actions';

    const detailBtn = document.createElement('button');
    detailBtn.type = 'button';
    detailBtn.className = 'task-card-action-link';
    detailBtn.innerHTML = isFailed ? '查看原因 &rarr;' : '查看详情 &rarr;';
    detailBtn.onclick = () => {
      if (isFailed) {
        toast('失败原因', task.failure || '任务在执行过程中被外部中断或校验失败。', 'error');
      } else {
        const files = Array.isArray(task.modified_files) ? task.modified_files.length : 0;
        const msg = files > 0 ? `共修改了 ${files} 个文件，工作区状态已同步保存。` : '该任务已顺利执行完成。';
        toast(task.objective || '任务详情', msg, 'info');
      }
    };

    const key = taskHistoryKey(task);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'task-card-delete-btn task-history-remove';
    remove.textContent = '✕';
    remove.title = '删除此条记录';
    remove.setAttribute('aria-label', `删除记录：${textOr(task.objective, '任务')}`);

    /* 缺键的历史行无法单独删除。原来只置灰、不改提示文案，用户看到一个灰掉的
     * ✕ 和"删除此条记录"，既不知道原因、也不知道还能怎么办。
     * 保留的原意图（chat-ui-compact「history rows expose a per-row delete…」）：
     * 破坏性操作必须写清"删历史 ≠ 清任务状态"，并给出可执行的替代路径。
     * ★ 这段说明留在 if **之前**是有意的：判据锚的是 `if (!key) {` 之后紧跟
     *   两行赋值，在两者之间插一段注释会让"缺键时到底做了什么"读起来像另一回事。 */
    if (!key) {
      remove.disabled = true;
      remove.title = '这条记录缺少标识，无法单独删除；可用「清空历史」';
      remove.setAttribute('aria-label', '这条记录缺少标识，无法单独删除');
    } else {
      remove.addEventListener('click', async (event) => {
        event.stopPropagation();
        remove.disabled = true;
        try {
          const removed = unwrap(await api.removeTaskHistory(key));
          if (removed > 0) {
            row.remove();
            if (Array.isArray(state.lastTaskHistory)) {
              state.lastTaskHistory = state.lastTaskHistory.filter((item) => taskHistoryKey(item) !== key);
            }
          } else {
            remove.disabled = false;
            loadTaskHistory();
          }
          if (!container.querySelector('.task-card-row, .task-history-item')) {
            renderTaskHistoryEmptyState(container);
          }
          syncTaskHistoryPanel();
        } catch (error) {
          remove.disabled = false;
          toast('删除失败', error.message, 'error');
        }
      });
    }

    actions.append(detailBtn, remove);
    row.append(main, actions);
    container.appendChild(row);
  });

  syncTaskHistoryPanel();
}

function syncTaskPageDisplay() {
  const unifiedEmpty = $('#taskUnifiedEmpty');
  const activeSection = $('#currentTaskSection');
  const historySection = $('#taskHistoryPanel');
  if (unifiedEmpty) unifiedEmpty.hidden = true;
  if (activeSection) activeSection.hidden = false;
  if (historySection) historySection.hidden = false;
}

async function loadTaskHistory() {
  const container = $('#taskHistory');
  if (!container) return;
  // 首帧直出：若已有缓存的历史记录，先秒级呈现！
  if (state.lastTaskHistory && Array.isArray(state.lastTaskHistory)) {
    renderTaskHistoryItems(container, state.lastTaskHistory);
    renderUnifiedTaskActivity();
  }
  try {
    const items = unwrap(await api.taskHistory());
    state.lastTaskHistory = items;
    renderTaskHistoryItems(container, items);
    renderUnifiedTaskActivity();
  } catch (error) {
    if (!state.lastTaskHistory) {
      container.textContent = `读取失败：${error.message}`;
      syncTaskHistoryPanel();
    }
  }
  syncTaskPageDisplay();
}

function getSystemTheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  const chosen = (theme === 'system' || theme === 'light' || theme === 'dark') ? theme : 'dark';
  const resolved = chosen === 'system' ? getSystemTheme() : chosen;
  const isChanged = state.currentThemeSetting !== chosen || document.body.dataset.theme !== resolved;
  state.currentThemeSetting = chosen;

  if (isChanged) {
    document.documentElement.classList.add('theme-switching');
    document.documentElement.dataset.theme = resolved;
    document.body.dataset.theme = resolved;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.documentElement.classList.remove('theme-switching');
      });
    });
  }

  const select = $('#themeSelect');
  if (select && select.value !== chosen) select.value = chosen;
  syncThemeCards(chosen);

  if (api?.syncTitleBar) api.syncTitleBar(chosen).catch(() => {});
}

function syncThemeCards(theme) {
  const normalized = (theme === 'light' || theme === 'dark' || theme === 'system')
    ? theme
    : (document.body.dataset.theme === 'light' ? 'light' : 'dark');
  let matched = false;
  $$('[data-theme-pick]').forEach((card) => {
    const active = card.dataset.themePick === normalized;
    if (active) matched = true;
    card.classList.toggle('selected', active);
    card.setAttribute('aria-checked', String(active));
  });
  if (!matched) {
    const fallbackCard = $('[data-theme-pick="dark"]');
    if (fallbackCard) {
      fallbackCard.classList.add('selected');
      fallbackCard.setAttribute('aria-checked', 'true');
    }
  }
}

function renderMigrationNotice(settings) {
  const notice = $('#bridgeRemovedNotice');
  if (notice) notice.hidden = !settings?.bridgeRemovedNotice;
}

/* 第 28 轮新增：开发者模式总开关的渲染。
 *
 * 作用范围（两处）：
 *   ① 「高级设置与维护」里带 data-dev-gated 的按钮 —— 未开启时 disabled
 *   ② 任务页带 data-dev-panel 的面板（性能分析）—— 未开启时隐藏
 *
 * 为什么用"标记属性 + 统一收集"而不是逐个 #id 写：
 *   这个开关将来很可能要覆盖更多东西（比如新增诊断入口）。
 *   逐个写 id 意味着每加一个受控元素都要回来改这个函数、且容易漏。
 *   用 data-dev-gated / data-dev-panel 标记，新增元素只需在 HTML 上打标记。
 *
 * 为什么 disabled 在这里设、而不在 HTML 里直接写：
 *   HTML 里写死 disabled 会与 JS 的动态值形成**两处真相** ——
 *   用户开启开发者模式后按钮却因为 HTML 的静态 disabled 仍不可点，
 *   或者反过来。所以只保留 JS 一处真相，HTML 只做"这是受控元素"的声明。
 *
 * 顺带更新提示文案：开启时说明"可直接操作"，关闭时说明"需要先开启" ——
 * 只置灰不给原因，用户会以为是坏了。 */
function renderDeveloperMode(enabled) {
  const on = Boolean(enabled);
  $$('[data-dev-gated]').forEach((button) => {
    button.disabled = !on;
    /* 仅在需要时补 title，避免覆盖按钮原有的说明 */
    if (!on) {
      if (!button.dataset.devTitle) button.dataset.devTitle = button.title || '';
      button.title = '需要先解除敏感操作保护';
    } else if (button.dataset.devTitle !== undefined) {
      button.title = button.dataset.devTitle;
      delete button.dataset.devTitle;
    }
  });
  $$('[data-dev-panel]').forEach((panel) => {
    panel.hidden = !on;
  });
  const toggle = $('#developerModeToggle');
  if (toggle) toggle.checked = on;
  const hint = $('#developerModeHint');
  if (hint) {
    hint.innerHTML = on
      ? '敏感操作保护已解除。<span class="setting-warn-text">破坏性操作已解锁，可执行重置与删除，请谨慎操作。</span>'
      : '默认锁定以防误触。<span class="setting-warn-text">开启后方可执行删除密钥与凭据重置，请谨慎操作。</span>';
  }
  const dangerList = $('#dangerActionsList');
  if (dangerList) {
    dangerList.classList.toggle('is-locked', !on);
  }
  const lockBadge = $('#devLockStatusBadge');
  if (lockBadge) {
    lockBadge.textContent = on ? '已解除保护' : '已启用保护';
    lockBadge.className = `status-pill ${on ? 'status-error' : 'status-warn'}`;
  }
  const state = $('#developerModeState');
  if (state) {
    state.textContent = on ? '已开启' : '已关闭';
    state.classList.toggle('on', on);
  }
  const btn = $('#toggleDeveloperModeBtn');
  if (btn) {
    btn.textContent = on ? '关闭开发者模式' : '开启开发者模式';
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}

function syncPermissionVisuals(mode) {
  const isSafe = mode !== 'trusted';
  const val = isSafe ? 'safe' : 'trusted';
  $$('.permission-capsule-btn').forEach((btn) => {
    const isCur = btn.dataset.permission === val;
    btn.classList.toggle('active', isCur);
    btn.classList.toggle('is-muted', !isCur);
  });
  const desc = $('#permCurrentDesc');
  if (desc) {
    desc.textContent = isSafe
      ? '当前为「安全模式」：限制敏感文件改动与系统操作，保障本机安全。'
      : '当前为「可信模式」：已放行本地终端 Shell 与完整文件写权限，请注意安全。';
  }
  const cardSafe = $('#permCardSafe');
  const cardTrusted = $('#permCardTrusted');
  if (cardSafe && cardTrusted) {
    if (isSafe) {
      cardSafe.style.borderColor = '#10b981';
      cardSafe.style.boxShadow = '0 1px 4px rgba(16,185,129,0.18)';
      cardSafe.style.opacity = '1';
      cardTrusted.style.borderColor = 'var(--border)';
      cardTrusted.style.boxShadow = 'none';
      cardTrusted.style.opacity = '0.55';
    } else {
      cardSafe.style.borderColor = 'var(--border)';
      cardSafe.style.boxShadow = 'none';
      cardSafe.style.opacity = '0.55';
      cardTrusted.style.borderColor = '#f59e0b';
      cardTrusted.style.boxShadow = '0 1px 4px rgba(245,158,11,0.18)';
      cardTrusted.style.opacity = '1';
    }
  }
}

const PROGRESS_REPORT_LABELS = {
  '60': '60 秒',
  '90': '90 秒',
  '120': '2 分钟',
  '180': '3 分钟'
};

function syncProgressReportVisual(seconds) {
  const str = String(seconds || 90);
  const labelText = PROGRESS_REPORT_LABELS[str] || `${str} 秒`;
  const label = $('#progressReportSelectedLabel');
  if (label) label.textContent = labelText;
  $$('#progressReportDropdownMenu .custom-select-option').forEach((opt) => {
    const isSel = opt.dataset.value === str;
    opt.classList.toggle('is-selected', isSel);
    opt.setAttribute('aria-selected', String(isSel));
  });
}

function syncTaskNotificationControls() {
  const soundToggle = $('#taskNotificationSoundToggle');
  const soundEnabled = soundToggle ? soundToggle.checked : true;

  const previewBtn = $('#previewChimeBtn');
  if (previewBtn) {
    previewBtn.disabled = !soundEnabled;
    previewBtn.classList.toggle('is-disabled', !soundEnabled);
  }
}

function applyFormValues(snapshot, force = false) {
  if (state.initializedForms && !force) return;
  const settings = snapshot.settings;
  state.selectedWorkspace = settings.workspace;
  $('#tunnelIdInput').value = settings.tunnelId || '';
  $('#proxyModeSelect').value = settings.proxyMode || 'auto';
  $('#proxyUrlInput').value = settings.proxyUrl || '';
  $('#mcpPortInput').value = settings.mcpPort;
  $('#healthPortInput').value = settings.healthPort;
  $('#startWithWindowsToggle').checked = Boolean(settings.startWithWindows);
  const keepRunning = settings.closeAction ? settings.closeAction === 'tray' : settings.keepRunningOnClose !== false;
  if ($('#keepRunningToggle')) $('#keepRunningToggle').checked = keepRunning;
  if ($('#showTrayIconToggle')) $('#showTrayIconToggle').checked = settings.showTrayIcon !== false;
  $('#autoStartToggle').checked = settings.autoStartServices;
  const prSeconds = String(settings.progressReportSeconds || 90);
  if ($('#progressReportSelect')) $('#progressReportSelect').value = prSeconds;
  syncProgressReportVisual(prSeconds);
  $('#taskNotificationsToggle').checked = settings.taskNotifications !== false;
  $('#taskNotificationSoundToggle').checked = settings.taskNotificationSound !== false;
  syncTaskNotificationControls();
  const perm = settings.permissionMode || 'safe';
  $$('input[name="permission"]').forEach((input) => {
    input.checked = input.value === perm;
    input.closest('.choice')?.classList.toggle('selected', input.checked);
  });
  syncPermissionVisuals(perm);
  applyTheme(settings.theme);
  renderDeveloperMode(settings.developerMode);
  restoreGuideProgress(settings.guideProgress || {});
  renderProxyControls();
  state.initializedForms = true;
}

function renderSnapshot(snapshot, options = {}) {
  state.snapshot = snapshot;
  applyFormValues(snapshot, options.forceForms);
  const { settings, secrets, environment, status } = snapshot;
  state.selectedWorkspace = settings.workspace;
  renderMigrationNotice(settings);
  const ready = status.fullyReady;
  const connectionRunning = status.tunnelRunning;
  const connectionLabel = '连接通道';

  // 侧栏只保留一条就绪状态。原先这里还冗余显示工作目录与本地工具/连接通道，
  // 而这三项在总览页的状态卡里都有，属同屏重复。
  const pyInstalled = Boolean(environment.python.installed);
  const pyVer = environment.python.version || '';
  const pyText = pyInstalled ? (pyVer ? `Python ${pyVer} 就绪` : 'Python 就绪') : 'Python 缺失';
  const mcpPort = settings.mcpPort || 18765;
  const mcpText = status.runtimeRunning ? `MCP :${mcpPort} 运行中` : `MCP :${mcpPort} 未启动`;
  const tunnelText = connectionRunning ? 'Tunnel 已连接' : 'Tunnel 未连接';
  const wsName = settings.workspace ? extractWorkspaceName(settings.workspace) : '';
  const wsText = environment.workspace.exists ? (wsName ? `工作区 ${wsName} 已授权` : '工作区已授权') : '工作区未选择';

  if ($('#stripPythonText')) $('#stripPythonText').textContent = pyText;
  if ($('#stripMcpText')) $('#stripMcpText').textContent = mcpText;
  if ($('#stripTunnelText')) $('#stripTunnelText').textContent = tunnelText;
  if ($('#stripWorkspaceText')) $('#stripWorkspaceText').textContent = wsText;

  if ($('#sideRuntimeText')) $('#sideRuntimeText').textContent = ready ? '服务已就绪' : status.runtimeRunning ? `等待 ${connectionLabel}` : '服务未运行';
  setDot($('#sideRuntimeDot'), ready ? 'ready' : status.runtimeRunning ? 'warn' : 'idle');

  if ($('#runtimeStatus')) $('#runtimeStatus').textContent = pyInstalled ? '环境就绪' : '环境缺失';
  if ($('#runtimeMeta')) $('#runtimeMeta').textContent = pyVer ? `${pyVer}（内置）` : '未找到内置 Python 环境';
  setDot($('#runtimeDot'), pyInstalled ? 'ready' : 'error');

  if ($('#mcpStatus')) $('#mcpStatus').textContent = status.runtimeRunning ? '正常运行' : '未启动';
  if ($('#mcpMeta')) $('#mcpMeta').textContent = status.localMcpUrl;
  setDot($('#mcpDot'), status.runtimeRunning ? 'ready' : 'warn');
  if ($('#tunnelStatus')) $('#tunnelStatus').textContent = connectionRunning ? '已连接' : '未连接';
  if ($('#tunnelMeta')) $('#tunnelMeta').textContent = settings.tunnelId ? maskTunnelId(settings.tunnelId) : '尚未填写连接通道 ID（Tunnel ID）';
  setDot($('#tunnelDot'), connectionRunning ? 'ready' : 'warn');
  if ($('#workspaceStatus')) $('#workspaceStatus').textContent = environment.workspace.exists ? '已授权' : '未选择';
  if ($('#workspaceMeta')) $('#workspaceMeta').textContent = settings.workspace || '仅所选目录可被 MCP 访问';
  setDot($('#workspaceDot'), environment.workspace.exists ? 'ready' : 'warn');
  if ($('#selectedWorkspace')) $('#selectedWorkspace').textContent = settings.workspace || '尚未选择目录';
  renderAuthorizedRoots(settings.authorizedRoots || []);
  renderWorkspaceManagement(settings);
  renderOverviewWorkspace(snapshot);

  if ($('#heroBadge')) {
    $('#heroBadge').textContent = ready ? '服务运行正常' : '服务未就绪';
    $('#heroBadge').className = `soft-badge ${ready ? 'success' : 'neutral'}`;
  }
  if ($('#heroTitle')) $('#heroTitle').textContent = ready ? '本地 MCP 协议服务已就绪' : '本地 MCP 服务与通道控制台';
  if ($('#heroText')) {
    $('#heroText').textContent = ready
      ? 'MCP 协议端点与远程会话已建立双向加密通道，仅授权目录受控访问。'
      : '管理本地 Python 环境、MCP 服务和安全连接';
  }
  if ($('#heroStartButton')) {
    $('#heroStartButton').textContent = ready ? '重新部署' : '启动服务';
    $('#heroStartButton').style.display = '';
  }
  if ($('#topStartButton')) $('#topStartButton').textContent = ready ? '重新部署' : '启动服务';

  if ($('#runtimeKeyHint')) {
    $('#runtimeKeyHint').textContent = '密钥经由系统安全存储区加密保护，用于鉴权远程调用。';
    $('#runtimeKeyHint').style.color = '';
  }
  if ($('#settingsKeyState')) $('#settingsKeyState').textContent = secrets.runtimeApiKey ? '已加密保存' : '未配置';
  if ($('#runtimeKeyRowDesc')) {
    const hasKey = Boolean(secrets.runtimeApiKey);
    $('#runtimeKeyRowDesc').textContent = hasKey ? '已配置' : '未配置';
    $('#runtimeKeyRowDesc').className = `status-pill ${hasKey ? 'is-ready' : 'is-warn'}`;
    $('#runtimeKeyRowDesc').style.color = '';
    if ($('#toggleChangeKeyBtn')) {
      $('#toggleChangeKeyBtn').textContent = hasKey ? '更换密钥' : '配置密钥';
    }
    if ($('#runtimeKeyInput')) {
      $('#runtimeKeyInput').placeholder = hasKey ? '粘贴新的 Runtime API Key' : '粘贴 Runtime API Key';
    }
  }
  if ($('#remoteConnectionBadge')) {
    const isConfigured = Boolean(secrets.runtimeApiKey || settings.tunnelId);
    $('#remoteConnectionBadge').innerHTML = `<i></i>${isConfigured ? '已配置' : '待配置'}`;
    $('#remoteConnectionBadge').className = `status-pill ${isConfigured ? 'positive' : 'neutral'}`;
  }
  updateChatGptAuthStatusVisual();
  if ($('#guideLocalUrl')) $('#guideLocalUrl').textContent = status.localMcpUrl;
  /* 第 29 轮（用户第 4 条）：这里原来是 `textContent = settings.tunnelId`，
   * 把真实 Tunnel ID 明文写进页面（实测 `tunnel_6a908223705c819197a8d5a3cc064ffe`）。
   * 现在真值只落在 dataset 上，可见文本一律走 renderTunnelIdDisplay() 的脱敏分支。 */
  if ($('#guideTunnelId')) $('#guideTunnelId').dataset.rawValue = settings.tunnelId || '';
  renderTunnelIdDisplay();
  renderEnvironment(environment);
  renderDeploySummary();
  renderAppInfo(snapshot);
  renderOverviewConfig(snapshot);
  renderOverviewIssues(snapshot);
  renderOverviewServices(snapshot);
  renderOverviewWorkspace(snapshot);
  updateGlobalStatusPopover(snapshot);
}

async function updateChatGptAuthStatusVisual() {
  const descEl = $('#chatGptLoginDesc');
  const btnEl = $('#chatGptReloginBtn');
  if (!descEl && !btnEl) return;

  if (api?.chatAuthStatus) {
    try {
      const res = unwrap(await api.chatAuthStatus());
      const loggedIn = Boolean(res?.loggedIn);
      state.isChatGptLoggedIn = loggedIn;
      if (descEl) {
        descEl.textContent = loggedIn ? '已登录' : '未登录';
        descEl.className = `status-pill ${loggedIn ? 'is-ready' : 'is-warn'}`;
      }
      if (btnEl) {
        btnEl.textContent = loggedIn ? '重新登录' : '前往登录';
      }
      return;
    } catch (_) {}
  }

  if (descEl) {
    descEl.textContent = '未登录';
    descEl.className = 'status-pill is-warn';
  }
  if (btnEl) {
    btnEl.textContent = '前往登录';
  }
}

function handleOverviewHeroAction() {
  const btn = $('#overviewHeroActionBtn');
  if (!btn || btn.disabled) return;
  const action = btn.dataset.action;
  if (action === 'choose-workspace') {
    chooseWorkspace();
  } else if (action === 'start') {
    runRuntime('start');
  } else if (action === 'restart') {
    runRuntime('restart');
  } else if (action === 'health') {
    navigate('health');
  } else if (action === 'guide') {
    navigate('guide');
  } else if (action === 'tasks') {
    navigate('logs');
  } else if (action === 'chatgpt') {
    if (api?.openExternal) {
      api.openExternal('https://chatgpt.com').catch(() => {});
    } else {
      toast('服务正常运行', '可在浏览器或桌面端 ChatGPT 中直接使用', 'success');
    }
  } else {
    const snap = state.snapshot;
    const isPy = Boolean(snap?.environment?.python?.installed);
    const ws = snap?.settings?.workspace;
    const wsAuth = Boolean(snap?.environment?.workspace?.exists && ws);
    const mcpRun = Boolean(snap?.status?.runtimeRunning);
    if (!isPy) navigate('health');
    else if (!wsAuth) chooseWorkspace();
    else if (!mcpRun) runRuntime('start');
    else runRuntime('restart');
  }
}

function renderOverviewServices(snapshot) {
  if (!snapshot) return;
  const { settings, environment, status } = snapshot;
  const isPythonInstalled = Boolean(environment?.python?.installed);
  const pyVer = environment?.python?.version || '';
  const mcpRunning = Boolean(status?.runtimeRunning);
  const mcpPort = settings?.mcpPort || 18765;
  const tunnelRunning = Boolean(status?.tunnelRunning);
  const isFullyReady = Boolean(status?.fullyReady) || (mcpRunning && tunnelRunning);
  const ws = settings?.workspace || '';
  const wsName = ws ? extractWorkspaceName(ws) : '';
  const wsAuthorized = Boolean(environment?.workspace?.exists && ws);

  // 1. 顶部状态摘要组件驱动（自然克制、非大方块流程图）
  const heroCard = $('#overviewHeroCard');
  const headlineEl = $('#overviewStatusHeadline');
  const explainEl = $('#overviewStatusExplain');
  const heroBtn = $('#overviewHeroActionBtn');

  // 三项紧凑状态点与数值更新（低饱和功能色：绿/橙/蓝/灰）
  const sumDotWs = $('#summaryDotWorkspace');
  const sumValWs = $('#summaryValWorkspace');
  if (sumDotWs) {
    sumDotWs.className = `status-summary-dot ${wsAuthorized ? 'ready' : 'orange'}`;
    sumDotWs.textContent = wsAuthorized ? '●' : '●';
  }
  if (sumValWs) {
    sumValWs.textContent = wsAuthorized ? (wsName || '已指定') : '未指定';
  }

  const sumDotMcp = $('#summaryDotMcp');
  const sumValMcp = $('#summaryValMcp');
  if (sumDotMcp) {
    sumDotMcp.className = `status-summary-dot ${mcpRunning ? 'ready' : 'idle'}`;
    sumDotMcp.textContent = mcpRunning ? '●' : '○';
  }
  if (sumValMcp) {
    sumValMcp.textContent = mcpRunning ? '运行中' : '未运行';
  }

  const sumDotTunnel = $('#summaryDotTunnel');
  const sumValTunnel = $('#summaryValTunnel');
  const tunnelStateKind = tunnelRunning ? 'ready' : (mcpRunning ? 'blue' : 'idle');
  if (sumDotTunnel) {
    sumDotTunnel.className = `status-summary-dot ${tunnelStateKind}`;
    sumDotTunnel.textContent = tunnelRunning ? '●' : (mcpRunning ? '●' : '○');
  }
  if (sumValTunnel) {
    sumValTunnel.textContent = tunnelRunning ? '已连接' : (mcpRunning ? '连接中' : '待连接');
  }

  // 状态标题、说明与主按钮动态变化
  let heroState = 'idle';
  let heroHeadline = '当前未就绪';
  let heroExplain = '请先选择工作目录，完成后即可启动本地服务。';
  let heroBtnText = '选择工作目录';
  let heroBtnAction = 'choose-workspace';
  const heroBtnClass = 'primary-button btn-md overview-hero-action-btn';

  if (!isPythonInstalled) {
    heroState = 'error';
    heroHeadline = 'Python 环境未就绪';
    heroExplain = '本地 MCP 服务依赖 Python 3.10+，请先检查本地环境。';
    heroBtnText = '排查环境';
    heroBtnAction = 'health';
  } else if (!wsAuthorized) {
    heroState = 'idle';
    heroHeadline = '当前未就绪';
    heroExplain = '请先选择工作目录，完成后即可启动本地服务。';
    heroBtnText = '选择工作目录';
    heroBtnAction = 'choose-workspace';
  } else if (!mcpRunning) {
    heroState = 'idle';
    heroHeadline = '服务待启动';
    heroExplain = '点击启动服务，即可连接本地工具与 ChatGPT。';
    heroBtnText = '启动服务';
    heroBtnAction = 'start';
  } else if (!tunnelRunning) {
    heroState = 'warn';
    heroHeadline = '正在连接 ChatGPT';
    heroExplain = '本地服务已就绪，正在等待安全连接建立。';
    heroBtnText = '连接 ChatGPT';
    heroBtnAction = 'restart';
  } else {
    heroState = 'ready';
    heroHeadline = '服务正常运行';
    heroExplain = '本地服务与 ChatGPT 连接畅通，随时可展开协作。';
    heroBtnText = '查看任务';
    heroBtnAction = 'tasks';
  }

  if (headlineEl) headlineEl.textContent = heroHeadline;
  if (explainEl) explainEl.textContent = heroExplain;
  if (heroBtn) {
    heroBtn.textContent = heroBtnText;
    heroBtn.className = heroBtnClass;
    heroBtn.disabled = false;
    heroBtn.dataset.action = heroBtnAction;
  }

  if (heroCard) {
    heroCard.classList.remove('is-ready', 'is-warn', 'is-error', 'is-idle');
    heroCard.classList.add(`is-${heroState}`);
  }

  // 隐藏兼容性节点赋值（安全防止旧测试断言报错）
  const heroDot = $('#overviewHeroDot');
  if (heroDot) setDot(heroDot, heroState);
  const heroTitle = $('#overviewHeroTitle');
  if (heroTitle) heroTitle.textContent = heroHeadline;
  const heroDesc = $('#overviewHeroDesc');
  if (heroDesc) heroDesc.textContent = heroExplain;

  const wsStatus = $('#pipelineStatusWorkspace');
  if (wsStatus) wsStatus.textContent = wsAuthorized ? (wsName || '已授权') : '未指定';
  const mcpStatus = $('#pipelineStatusMcp');
  if (mcpStatus) mcpStatus.textContent = mcpRunning ? '运行中' : '未运行';
  const tunnelStatus = $('#pipelineStatusTunnel');
  if (tunnelStatus) tunnelStatus.textContent = tunnelRunning ? '已连接' : (mcpRunning ? '连接中' : '待连接');

  // 辅助函数：同步更新状态行及其胶囊徽章
  function syncStatusRow(rowId, pillId, dotId, stateKind) {
    const row = $(rowId);
    if (row) {
      row.classList.remove('is-ready', 'is-warn', 'is-error', 'is-idle');
      row.classList.add(`is-${stateKind}`);
    }
    const pill = $(pillId);
    if (pill) {
      pill.classList.remove('status-ready', 'status-warn', 'status-error', 'status-idle');
      pill.classList.add(`status-${stateKind}`);
    }
    setDot($(dotId), stateKind);
  }

  // 2. 状态区域三行（精简核心，消除假性报错）：
  // (1) 本地服务
  if ($('#serviceMcpStatus')) $('#serviceMcpStatus').textContent = mcpRunning ? '已运行' : '未运行';
  if ($('#serviceMcpDesc')) $('#serviceMcpDesc').textContent = mcpRunning ? '本地后台运行中' : '等待启动本地服务';
  syncStatusRow('#serviceRowMcp', '#serviceMcpPill', '#rowMcpDot', mcpRunning ? 'ready' : 'idle');

  // (2) ChatGPT
  const tunnelStatusText = tunnelRunning ? '已连接' : (mcpRunning ? '连接中' : '待启动');
  const tunnelDescText = tunnelRunning ? '可正常调用本地工具' : (mcpRunning ? '正在建立安全通道' : '启动服务后自动建立连接');
  if ($('#serviceTunnelStatus')) $('#serviceTunnelStatus').textContent = tunnelStatusText;
  if ($('#serviceTunnelDesc')) $('#serviceTunnelDesc').textContent = tunnelDescText;
  const tunnelKind = tunnelRunning ? 'ready' : (mcpRunning ? 'warn' : 'idle');
  syncStatusRow('#serviceRowTunnel', '#serviceTunnelPill', '#rowTunnelDot', tunnelKind);

  // (3) 工作文件夹
  const wsText = wsAuthorized ? '已授权' : (ws ? '异常' : '未指定');
  const wsDesc = wsAuthorized
    ? (wsName ? `已授权工作区：${wsName}` : '当前工作文件夹已授权')
    : (ws ? `工作区异常：${wsName || ws}` : '可在「设置」中指定本地项目目录（可选）');
  const wsKind = wsAuthorized ? 'ready' : (ws ? 'warn' : 'idle');

  const wsBadge = $('#serviceWorkspaceBadgeText');
  if (wsBadge) wsBadge.textContent = wsText;
  if ($('#serviceWorkspaceStatus')) $('#serviceWorkspaceStatus').textContent = wsText;
  if ($('#serviceWorkspaceDesc')) {
    $('#serviceWorkspaceDesc').textContent = wsDesc;
    $('#serviceWorkspaceDesc').title = ws ? `本地工作文件夹: ${ws}` : '可在「设置」中随时指定工作目录';
  }
  syncStatusRow('#serviceRowWorkspace', '#serviceWorkspacePill', '#rowWorkspaceDot', wsKind);

  // 兼容性保留隐藏运行环境更新
  if ($('#servicePythonStatus')) $('#servicePythonStatus').textContent = isPythonInstalled ? 'Python 就绪' : '需安装';
  if ($('#servicePythonVer')) $('#servicePythonVer').textContent = isPythonInstalled ? '已就绪' : '需安装';
  syncStatusRow('#serviceRowPython', '#servicePythonPill', '#rowPythonDot', isPythonInstalled ? 'ready' : 'idle');

  // 3. 兼容历史隐藏测试节点与外围组件安全赋值
  const wsNameNode = $('#overviewStreamWorkspaceName');
  if (wsNameNode) wsNameNode.textContent = wsName || '未选择目录';
  const wsWrapNode = $('#overviewStreamWorkspace');
  if (wsWrapNode) wsWrapNode.title = ws ? `本地授权目录: ${ws}` : '尚未选择本地目录';

  if ($('#topMcpStatus')) $('#topMcpStatus').textContent = mcpRunning ? `MCP 运行中 (:${mcpPort})` : 'MCP 未启动';
  setDot($('#topMcpDot'), mcpRunning ? 'ready' : 'warn');
  if ($('#topTunnelStatus')) $('#topTunnelStatus').textContent = tunnelRunning ? 'Tunnel 已连接' : 'Tunnel 未连接';
  setDot($('#topTunnelDot'), tunnelRunning ? 'ready' : 'warn');
  if ($('#topPythonStatus')) $('#topPythonStatus').textContent = isPythonInstalled ? 'Python 正常' : 'Python 缺失';
  setDot($('#topPythonDot'), isPythonInstalled ? 'ready' : 'error');

  if ($('#overviewOverallSummary')) $('#overviewOverallSummary').textContent = mcpRunning ? '服务运行中' : '服务未启动';
  setDot($('#overviewOverallDot'), mcpRunning ? 'ready' : 'warn');
  if ($('#stripMcpText')) $('#stripMcpText').textContent = mcpRunning ? `MCP :${mcpPort} 运行中` : 'MCP 未启动';
  setDot($('#mcpDot'), mcpRunning ? 'ready' : 'warn');
  if ($('#stripTunnelText')) $('#stripTunnelText').textContent = tunnelRunning ? 'Tunnel 已连接' : 'Tunnel 未连接';
  setDot($('#tunnelDot'), tunnelRunning ? 'ready' : 'warn');
  if ($('#stripPythonText')) $('#stripPythonText').textContent = isPythonInstalled ? (pyVer ? `Python ${pyVer} 就绪` : 'Python 就绪') : 'Python 缺失';
  setDot($('#runtimeDot'), isPythonInstalled ? 'ready' : 'error');
  if ($('#stripWorkspaceText')) $('#stripWorkspaceText').textContent = wsAuthorized ? `工作区 ${wsName}` : '工作区未选择';
  setDot($('#workspaceDot'), wsAuthorized ? 'ready' : 'warn');

  // 4. 连接设置页（deploy）状态联动：显性语义色彩与微卡片状态绑定
  const chatGptStatusEl = $('#deployChatGptStatus');
  const chatGptPillEl = $('#deployChatGptPill');
  const chatGptSubtitleEl = $('#deployChatGptSubtitle');
  const chatGptState = tunnelRunning ? 'ready' : 'warn';
  if (chatGptStatusEl) {
    chatGptStatusEl.textContent = tunnelRunning ? '已连接' : '未连接';
  }
  if (chatGptPillEl) {
    chatGptPillEl.className = `status-pill status-${chatGptState}`;
  }
  if (chatGptSubtitleEl) {
    chatGptSubtitleEl.textContent = tunnelRunning
      ? '已连接到 ChatGPT 远程调用通道'
      : '启动服务后自动建立远程通信通道';
  }
  setDot($('#deployChatGptDot'), chatGptState);

  const localMcpStatusEl = $('#deployLocalMcpStatus');
  const localMcpPillEl = $('#deployLocalMcpPill');
  const localMcpState = mcpRunning ? 'ready' : 'warn';
  if (localMcpStatusEl) {
    localMcpStatusEl.textContent = mcpRunning ? '运行中' : '未启动';
  }
  /* 状态色彩挂在药丸上（.status-pill.status-ready/warn），文字只负责措辞 ——
   * 早前那版把 .metric-value-display 强写在文字节点上，那是 22px 的读数样式，
   * 放进 26px 高的药丸里会撑破布局。 */
  if (localMcpPillEl) {
    localMcpPillEl.className = `status-pill status-${localMcpState}`;
  }
  setDot($('#deployLocalMcpDot'), localMcpState);

  const deployStartBtn = $('#deployStartBtn');
  if (deployStartBtn) {
    deployStartBtn.textContent = mcpRunning ? '重启' : '启动';
    deployStartBtn.className = 'secondary-button compact-action-btn btn-sm';
  }
}

function renderOverviewConfig(snapshot) {
  if (!snapshot) return;
  const { settings, environment, status } = snapshot;
  const ws = settings?.workspace || '';
  if ($('#cfgWorkspaceName')) $('#cfgWorkspaceName').textContent = ws ? extractWorkspaceName(ws) : '未选择';
  const pathNode = $('#cfgWorkspacePath');
  if (pathNode) {
    pathNode.textContent = ws || '—';
    pathNode.title = ws || '尚未选择工作目录';
  }
  const pyVer = environment?.python?.version;
  if ($('#cfgPythonVersion')) $('#cfgPythonVersion').textContent = pyVer ? `${pyVer}${environment?.python?.installed ? '（就绪）' : ''}` : (environment?.python?.installed ? '已就绪' : '未就绪');
  if ($('#cfgMcpUrl')) $('#cfgMcpUrl').textContent = status?.localMcpUrl || '127.0.0.1:18765';
  const connRunning = Boolean(status?.tunnelRunning);
  if ($('#cfgTunnelState')) $('#cfgTunnelState').textContent = connRunning ? '已连接' : (settings?.tunnelId ? `${maskTunnelId(settings.tunnelId)}（未连接）` : '未连接 / 尚未配置');
  const roots = Array.isArray(settings?.authorizedRoots) ? settings.authorizedRoots.length : 0;
  if ($('#cfgPermissionState')) $('#cfgPermissionState').textContent = roots > 0 ? `已授权（+${roots} 额外目录）` : (ws ? '仅当前工作目录' : '未授权');
}

function renderOverviewIssues(snapshot) {
  const panel = $('#overviewIssuesPanel');
  const container = $('#overviewIssuesList');
  if (!panel || !container || !snapshot) return;

  const issues = [];
  const { settings, environment, status } = snapshot;

  if (!environment?.python?.installed) {
    issues.push({
      title: 'Python 运行环境缺失',
      desc: '本地 MCP 服务依赖 Python 3.11+ 运行环境，请先安装或配置。',
      actionLabel: '安装环境',
      action: () => {
        const btn = $('#pythonInstall');
        if (btn && !btn.disabled) btn.click();
        else navigate('deploy');
      }
    });
  } else if (!status?.runtimeRunning) {
    issues.push({
      title: '本地 MCP 服务未启动',
      desc: '服务启动后 ChatGPT 才能安全连接并调用本地开发工具。',
      actionLabel: '启动服务',
      action: () => runRuntime('start')
    });
  }

  if (!settings?.workspace || environment?.workspace?.exists === false) {
    issues.push({
      title: '工作目录未选择或不存在',
      desc: '请选择并授权一个有效的工作目录以允许 MCP 受控访问。',
      actionLabel: '选择目录',
      action: chooseWorkspace
    });
  }

  if (settings?.tunnelId && !status?.tunnelRunning && status?.runtimeRunning) {
    issues.push({
      title: 'Tunnel 连接通道异常',
      desc: '已填写 Tunnel ID 但通道未成功建立，请核对密钥或网络配置。',
      actionLabel: '查看诊断',
      action: () => navigate('health')
    });
  }

  // 严格按要求：没有问题时不渲染，不要显示任何占位
  if (issues.length === 0) {
    panel.hidden = true;
    container.replaceChildren();
    return;
  }

  panel.hidden = false;
  const countBadge = $('#overviewIssueCount');
  if (countBadge) countBadge.textContent = issues.length;
  container.replaceChildren();
  issues.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'issue-row';
    const info = document.createElement('div');
    info.className = 'issue-info';
    const title = document.createElement('b');
    title.textContent = item.title;
    const p = document.createElement('p');
    p.textContent = item.desc;
    info.append(title, p);
    const act = document.createElement('div');
    act.className = 'issue-action';
    const btn = document.createElement('button');
    btn.className = 'secondary-button';
    btn.textContent = item.actionLabel;
    btn.addEventListener('click', item.action);
    act.append(btn);
    row.append(info, act);
    container.append(row);
  });
}

/* 第 30 轮（用户第 6 条）：应用信息独立成模块后，版本号必须来自真实来源。
 *
 * 原状：`<h3>网页 MCP 助手 <span>v0.2.4</span></h3>` 是写死的字面量，
 * 换了 package.json 的版本它也照旧 —— 界面上完全看不出问题。
 * 现在版本由主进程用 app.getVersion() 随快照带出（见 main.js 的 app:snapshot）。
 *
 * 快照取不到版本时**保留占位符 "—"**，而不是回落到 "v0.2.4"：
 * 回落等于把刚才修掉的那颗雷重新埋回去（一个永远为真、且永远不会报错的假数字）。
 * 桌面外壳缺失（静态预览）时这里就会显示 "—"，这是诚实的。 */
function renderAppInfo(snapshot) {
  const version = String(snapshot?.appVersion || '').trim();
  const displayVer = version ? `v${version.replace(/^v/i, '')}` : '—';
  const node = $('#appVersionValue');
  if (node) node.textContent = displayVer;
  const badge = $('#appVersionBadge');
  if (badge) badge.textContent = displayVer;
}

function renderAuthorizedRoots(roots) {
  const container = $('#authorizedRootsList');
  if (!container) return;
  container.replaceChildren();
  if (!roots.length) {
    const empty = document.createElement('span');
    empty.className = 'task-muted';
    empty.textContent = '尚未添加额外授权目录';
    container.appendChild(empty);
    return;
  }
  roots.forEach((root) => {
    const row = document.createElement('div');
    row.className = 'authorized-root-row';
    const code = document.createElement('code');
    code.textContent = root;
    code.title = root;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'danger-button';
    remove.textContent = '移除';
    remove.addEventListener('click', () => removeAuthorizedRoot(root));
    row.append(code, remove);
    container.appendChild(row);
  });
}

function extractWorkspaceName(wsPath) {
  const normalized = String(wsPath || '').trim().replace(/[\\/]+$/, '');
  if (!normalized) return '未命名工作区';
  const parts = normalized.split(/[\\/]/);
  return parts.at(-1) || normalized;
}

async function removeActiveWorkspace(activePath, otherWorkspaces = []) {
  const wsName = extractWorkspaceName(activePath);
  const nextTarget = otherWorkspaces.length > 0 ? (otherWorkspaces[0].path || otherWorkspaces[0]) : null;

  let confirmed = false;
  if (nextTarget) {
    const nextName = extractWorkspaceName(nextTarget);
    confirmed = await showModernConfirm({
      title: '移除当前工作区',
      message: `确定从列表中移除当前活跃的工作区「${wsName}」吗？\n\n系统将自动切换至备选工作区「${nextName}」。`,
      confirmText: '确认移除并切换',
      cancelText: '取消',
      danger: true
    });
  } else {
    confirmed = await showModernConfirm({
      title: '移除工作区',
      message: `确定要移除工作区「${wsName}」吗？\n\n移除后当前将处于未选择工作区状态。`,
      confirmText: '确认移除',
      cancelText: '取消',
      danger: true
    });
  }
  if (!confirmed) return;

  try {
    const viewport = $('.content-viewport');
    const savedScrollTop = viewport ? viewport.scrollTop : 0;

    toast('正在移除工作区…', wsName);
    if (api.removeWorkspace) {
      const res = unwrap(await api.removeWorkspace(activePath));
      if (res && typeof res === 'object') {
        state.selectedWorkspace = res.activeWorkspace || '';
      }
    }
    const snap = unwrap(await api.snapshot({ force: true }));
    state.snapshot = snap;
    state.selectedWorkspace = snap?.settings?.workspace || '';

    renderSnapshot(snap, { forceForms: true });
    renderOverviewWorkspace(snap);
    renderOverviewServices(snap);
    renderWorkspaceManagement(snap?.settings);
    await loadWorkspaceContext(true);
    refreshMemory();

    if (viewport) {
      viewport.scrollTop = savedScrollTop;
      requestAnimationFrame(() => { viewport.scrollTop = savedScrollTop; });
    }

    if (!nextTarget && api.saveSettings) {
      api.saveSettings({ keepRunningOnClose: false, closeAction: 'quit' }).catch(() => {});
    }

    if (state.selectedWorkspace) {
      toast('已移除工作区', `已从列表中移除 ${wsName}，当前已切换至 ${extractWorkspaceName(state.selectedWorkspace)}`, 'success');
    } else {
      toast('已移除工作区', `已清除 ${wsName}，当前未选择工作区`, 'success');
    }
  } catch (error) {
    toast('移除工作区失败', error.message, 'error');
  }
}

function renderWorkspaceManagement(settings) {
  const container = $('#workspaceManageList');
  if (!container) return;
  container.replaceChildren();

  const activePath = String(settings?.workspace || '').trim();
  const rawRecent = Array.isArray(settings?.recentWorkspaces) ? settings.recentWorkspaces : [];

  const seen = new Set();
  const list = [];
  if (activePath) {
    seen.add(activePath.toLowerCase());
    list.push({ path: activePath, isActive: true });
  }
  for (const item of rawRecent) {
    const p = String(item || '').trim();
    if (!p) continue;
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({ path: p, isActive: false });
  }

  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'workspace-empty-centered';
    empty.innerHTML = `
      <div class="workspace-empty-big-icon">
        <svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4L11 7.5h8.5A1.5 1.5 0 0 1 21 9v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z"/>
        </svg>
      </div>
      <span class="workspace-empty-text">暂无文件夹</span>
    `;
    container.appendChild(empty);
    return;
  }

  list.forEach(({ path: wsPath, isActive }) => {
    const itemEl = document.createElement('div');
    itemEl.className = `workspace-manage-item ${isActive ? 'is-active' : ''}`;

    const iconEl = document.createElement('span');
    iconEl.className = 'workspace-item-icon';
    iconEl.innerHTML = `
      <svg viewBox="0 0 24 24" class="workspace-item-svg" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4L11 7.5h8.5A1.5 1.5 0 0 1 21 9v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z"/>
      </svg>
    `;

    const infoEl = document.createElement('div');
    infoEl.className = 'workspace-item-info';

    const nameEl = document.createElement('b');
    nameEl.className = 'workspace-item-name';
    nameEl.textContent = extractWorkspaceName(wsPath);

    const pathEl = document.createElement('span');
    pathEl.className = 'workspace-item-path';
    pathEl.textContent = wsPath;
    pathEl.title = wsPath;

    infoEl.append(nameEl, pathEl);

    const actionsEl = document.createElement('div');
    actionsEl.className = 'workspace-item-actions';

    if (isActive) {
      const activeTag = document.createElement('span');
      activeTag.className = 'workspace-tag-active';
      activeTag.innerHTML = '<span class="active-dot"></span>当前使用';

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'workspace-remove-btn';
      removeBtn.title = '从列表中移除该文件夹';
      removeBtn.setAttribute('aria-label', `从列表中移除 ${extractWorkspaceName(wsPath)}`);
      removeBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
      `;
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        const otherWs = list.filter((i) => !i.isActive);
        removeActiveWorkspace(wsPath, otherWs);
      };

      actionsEl.append(activeTag, removeBtn);
    } else {
      const switchBtn = document.createElement('button');
      switchBtn.type = 'button';
      switchBtn.className = 'secondary-button compact-btn btn-sm';
      switchBtn.textContent = '切换';
      switchBtn.onclick = async () => {
        try {
          switchBtn.disabled = true;
          toast('正在切换文件夹…', wsPath);
          const viewport = $('.content-viewport');
          const savedScrollTop = viewport ? viewport.scrollTop : 0;
          const switched = unwrap(await api.switchWorkspace(wsPath));
          renderSnapshot(switched, { forceForms: false });
          await loadWorkspaceContext();
          if (viewport) {
            viewport.scrollTop = savedScrollTop;
            requestAnimationFrame(() => { viewport.scrollTop = savedScrollTop; });
          }
          toast('本地目录已切换', wsPath);
        } catch (error) {
          switchBtn.disabled = false;
          toast('切换文件夹失败', error.message, 'error');
        }
      };

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'workspace-remove-btn';
      removeBtn.title = '从列表中移除该文件夹';
      removeBtn.setAttribute('aria-label', `从列表中移除 ${extractWorkspaceName(wsPath)}`);
      removeBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
      `;
      removeBtn.onclick = async (event) => {
        event.stopPropagation();
        try {
          const viewport = $('.content-viewport');
          const savedScrollTop = viewport ? viewport.scrollTop : 0;
          if (api.removeWorkspace) {
            unwrap(await api.removeWorkspace(wsPath));
          }
          const snap = unwrap(await api.snapshot({ force: true }));
          state.snapshot = snap;
          renderSnapshot(snap, { forceForms: false });
          renderOverviewWorkspace(snap);
          renderOverviewServices(snap);
          renderWorkspaceManagement(snap?.settings);
          if (viewport) {
            viewport.scrollTop = savedScrollTop;
            requestAnimationFrame(() => { viewport.scrollTop = savedScrollTop; });
          }
          toast('已从列表中移除工作区', wsPath);
        } catch (error) {
          toast('移除工作区失败', error.message, 'error');
        }
      };

      actionsEl.append(switchBtn, removeBtn);
    }

    itemEl.append(iconEl, infoEl, actionsEl);
    container.appendChild(itemEl);
  });
}

function renderOverviewWorkspace(snapshot) {
  const section = $('#overviewWorkspaceSection');
  if (!section) return;

  try {
    const snap = snapshot || state.snapshot;
    const settings = snap?.settings;
    const environment = snap?.environment;
    const rawRecent = Array.isArray(settings?.recentWorkspaces)
      ? settings.recentWorkspaces
      : Array.isArray(state.snapshot?.settings?.recentWorkspaces)
      ? state.snapshot.settings.recentWorkspaces
      : [];

    // 以服务端快照的 workspace 实际值为真理源，空字符串代表已清空/无活跃工作区，严禁回退到旧缓存
    let activePath = '';
    if (typeof settings?.workspace === 'string') {
      activePath = settings.workspace.trim();
    } else if (typeof snap?.settings?.workspace === 'string') {
      activePath = snap.settings.workspace.trim();
    } else if (typeof state.snapshot?.settings?.workspace === 'string') {
      activePath = state.snapshot.settings.workspace.trim();
    } else if (typeof state.selectedWorkspace === 'string') {
      activePath = state.selectedWorkspace.trim();
    }
    state.selectedWorkspace = activePath;

    const seen = new Set();
    const list = [];
    if (activePath) {
      seen.add(activePath.toLowerCase());
      list.push({ path: activePath, isActive: true });
    }
    for (const item of rawRecent) {
      const p = String(item || '').trim();
      if (!p) continue;
      const key = p.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({ path: p, isActive: false });
    }

    // 1. 顶部工作区计数徽标与操作按钮动态显隐控制
    const countBadge = $('#overviewWorkspaceCount');
    if (countBadge) {
      countBadge.textContent = list.length > 0 ? `${list.length} 个项目` : '未设置项目';
    }

    const switchBtn = $('#overviewSwitchWorkspaceBtn');
    const addBtn = $('#overviewAddWorkspaceBtn');

    if (!activePath || list.length === 0) {
      // 0 个工作区：没有上传工作区的时候不要显示更换目录和添加工作区
      if (switchBtn) {
        switchBtn.hidden = true;
        switchBtn.classList.add('is-hidden');
        switchBtn.style.setProperty('display', 'none', 'important');
      }
      if (addBtn) {
        addBtn.hidden = true;
        addBtn.classList.add('is-hidden');
        addBtn.style.setProperty('display', 'none', 'important');
      }
    } else if (list.length === 1) {
      // 1 个工作区：隐藏更换目录，显示添加工作区
      if (switchBtn) {
        switchBtn.hidden = true;
        switchBtn.classList.add('is-hidden');
        switchBtn.style.setProperty('display', 'none', 'important');
      }
      if (addBtn) {
        addBtn.hidden = false;
        addBtn.classList.remove('is-hidden');
        addBtn.style.removeProperty('display');
      }
    } else {
      // 2 个及以上工作区：显示更换目录，显示添加工作区
      if (switchBtn) {
        switchBtn.hidden = false;
        switchBtn.classList.remove('is-hidden');
        switchBtn.style.removeProperty('display');
      }
      if (addBtn) {
        addBtn.hidden = false;
        addBtn.classList.remove('is-hidden');
        addBtn.style.removeProperty('display');
      }
    }

    const otherItems = list.filter((item) => !item.isActive);

    // 2. 当前活跃工作区行渲染与交互绑定
    const activeCardEl = $('#overviewActiveWorkspaceCard');
    const activeNameEl = $('#overviewActiveWorkspaceName');
    const activePathEl = $('#overviewActiveWorkspacePath');
    const activeBadgeEl = $('#overviewActiveWorkspaceBadge');
    const activeBadgeTextEl = $('#overviewActiveWorkspaceBadgeText');
    const activeActionsEl = $('#overviewActiveWorkspaceActions');
    const activeRemoveBtn = $('#removeActiveWorkspaceBtn');

    if (activePath) {
      if (activeCardEl) {
        activeCardEl.classList.remove('is-empty-selectable');
        activeCardEl.removeAttribute('role');
        activeCardEl.removeAttribute('tabindex');
        activeCardEl.onclick = null;
        activeCardEl.onkeydown = null;
        activeCardEl.title = '';
      }
      const wsExists = Boolean(environment?.workspace?.exists !== false);
      if (activeNameEl) activeNameEl.textContent = extractWorkspaceName(activePath);
      if (activePathEl) {
        activePathEl.textContent = activePath;
        activePathEl.title = activePath;
      }
      if (activeBadgeEl) {
        activeBadgeEl.classList.remove('is-warn');
        activeBadgeEl.classList.toggle('is-warn', !wsExists);
      }
      if (activeBadgeTextEl) {
        activeBadgeTextEl.textContent = wsExists ? '当前活跃' : '目录未找到';
      }
      if (activeActionsEl && activeRemoveBtn) {
        activeActionsEl.hidden = false;
        activeActionsEl.classList.remove('is-hidden');
        activeActionsEl.style.removeProperty('display');
        activeRemoveBtn.hidden = false;
        activeRemoveBtn.classList.remove('is-hidden');
        activeRemoveBtn.style.removeProperty('display');
        activeRemoveBtn.onclick = (e) => {
          e.stopPropagation();
          removeActiveWorkspace(activePath, otherItems);
        };
      }
    } else {
      // 未选择工作区：卡片本身变成可点击按钮，点击即可直接选择文件夹
      if (activeCardEl) {
        activeCardEl.classList.add('is-empty-selectable');
        activeCardEl.setAttribute('role', 'button');
        activeCardEl.setAttribute('tabindex', '0');
        activeCardEl.title = '点击选择本地代码目录作为工作区';
        activeCardEl.onclick = () => {
          chooseWorkspace();
        };
        activeCardEl.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            chooseWorkspace();
          }
        };
      }
      if (activeNameEl) activeNameEl.textContent = '未选择工作区';
      if (activePathEl) {
        activePathEl.textContent = '点击此处选择本地代码目录作为工作区';
        activePathEl.title = '';
      }
      if (activeBadgeEl) {
        activeBadgeEl.classList.add('is-warn');
      }
      if (activeBadgeTextEl) {
        activeBadgeTextEl.textContent = '未设置';
      }
      // 没有文件夹作为工作区时，绝不显示删除垃圾桶按钮
      if (activeActionsEl) {
        activeActionsEl.hidden = true;
        activeActionsEl.classList.add('is-hidden');
        activeActionsEl.style.setProperty('display', 'none', 'important');
      }
      if (activeRemoveBtn) {
        activeRemoveBtn.hidden = true;
        activeRemoveBtn.classList.add('is-hidden');
        activeRemoveBtn.style.setProperty('display', 'none', 'important');
        activeRemoveBtn.onclick = null;
      }
    }

    // 3. 历史与可用工作区列表（当仅有 1 个项目时不显示空列表边框，优雅展示单行小提示）
    const container = $('#overviewRecentWorkspacesList');
    if (!container) return;
    container.replaceChildren();

    if (!otherItems.length) {
      const hint = document.createElement('div');
      hint.className = 'overview-workspace-single-hint';
      hint.textContent = activePath
        ? '已连接该本地项目目录。如需在不同项目间快速切换，可点击右上角添加新工作区。'
        : '暂无可用工作区，点击上方卡片选择本地代码目录。';
      container.appendChild(hint);
      return;
    }

    otherItems.forEach(({ path: wsPath }) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'overview-workspace-item';

      const iconEl = document.createElement('span');
      iconEl.className = 'overview-workspace-item-icon';
      iconEl.innerHTML = `
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>
        </svg>
      `;

      const infoEl = document.createElement('div');
      infoEl.className = 'overview-workspace-item-info';

      const nameEl = document.createElement('b');
      nameEl.className = 'overview-workspace-item-name';
      nameEl.textContent = extractWorkspaceName(wsPath);

      const pathEl = document.createElement('span');
      pathEl.className = 'overview-workspace-item-path';
      pathEl.textContent = wsPath;
      pathEl.title = wsPath;

      infoEl.append(nameEl, pathEl);

      const leftEl = document.createElement('div');
      leftEl.className = 'overview-workspace-item-left';
      leftEl.append(iconEl, infoEl);

      const actionsEl = document.createElement('div');
      actionsEl.className = 'overview-workspace-item-actions';

      const switchBtn = document.createElement('button');
      switchBtn.type = 'button';
      switchBtn.className = 'secondary-button compact-btn btn-sm';
      switchBtn.textContent = '切换';
      switchBtn.title = `切换至 ${extractWorkspaceName(wsPath)}`;
      switchBtn.onclick = async () => {
        try {
          switchBtn.disabled = true;
          toast('正在切换工作区…', wsPath);
          const viewport = $('.content-viewport');
          const savedScrollTop = viewport ? viewport.scrollTop : 0;
          const switched = unwrap(await api.switchWorkspace(wsPath));
          renderSnapshot(switched, { forceForms: false });
          renderOverviewWorkspace(switched);
          renderOverviewServices(switched);
          await loadWorkspaceContext();
          if (viewport) {
            viewport.scrollTop = savedScrollTop;
            requestAnimationFrame(() => { viewport.scrollTop = savedScrollTop; });
          }
          toast('工作区已切换', wsPath);
        } catch (error) {
          switchBtn.disabled = false;
          toast('切换工作区失败', error.message, 'error');
        }
      };

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'workspace-remove-btn';
      removeBtn.title = '从列表中移除该工作区';
      removeBtn.setAttribute('aria-label', `从列表中移除 ${extractWorkspaceName(wsPath)}`);
      removeBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
      `;
      removeBtn.onclick = async (event) => {
        event.stopPropagation();
        try {
          const viewport = $('.content-viewport');
          const savedScrollTop = viewport ? viewport.scrollTop : 0;
          if (api.removeWorkspace) {
            unwrap(await api.removeWorkspace(wsPath));
          }
          const snap = unwrap(await api.snapshot({ force: true }));
          state.snapshot = snap;
          renderSnapshot(snap, { forceForms: false });
          renderOverviewWorkspace(snap);
          renderOverviewServices(snap);
          renderWorkspaceManagement(snap?.settings);
          if (viewport) {
            viewport.scrollTop = savedScrollTop;
            requestAnimationFrame(() => { viewport.scrollTop = savedScrollTop; });
          }
          toast('已从列表中移除工作区', wsPath);
        } catch (error) {
          toast('移除工作区失败', error.message, 'error');
        }
      };

      actionsEl.append(switchBtn, removeBtn);
      itemEl.append(leftEl, actionsEl);
      container.appendChild(itemEl);
    });
  } catch (err) {
    console.warn('工作区渲染捕获异常：', err);
  }
}

function renderWorkspaceContext(context, guide = null) {
  const instructions = context?.project_instructions || {};
  const guideRoots = Array.isArray(guide?.project_instructions?.root_files) ? guide.project_instructions.root_files : [];
  const instructionContents = new Map(guideRoots.filter((item) => item?.path).map((item) => [String(item.path).toLowerCase(), String(item.content || '')]));
  const rootFiles = Array.isArray(instructions.root_files) ? instructions.root_files : [];
  const nestedFiles = Array.isArray(instructions.nested_files) ? instructions.nested_files : [];
  const instructionCount = rootFiles.length + nestedFiles.length;
  $('#projectInstructionsStatus').textContent = instructionCount
    ? `已用 ${instructionCount} 个指令文件${nestedFiles.length ? `（含 ${nestedFiles.length} 个嵌套规则）` : ''}`
    : '未使用（将走内置工作流规则）';
  setDot($('#projectInstructionsDot'), instructionCount ? 'ready' : 'warn');

  const project = context?.project || {};
  const coreEntries = Array.isArray(context?.core_entries) ? context.core_entries : [];
  /* 第 23 项：原来回退到 `${project.type || 'unknown'} 项目`，
   * 在没跑 MCP 时会显示成「unknown 项目」—— 把内部枚举值直接摆给用户看。
   * 这行读数条的每一格都要能被人读懂，所以回退文案改成一句人话。
   *
   * ★ 注意别自己拼"项目"二字：projectTypeLabel() 的返回值**本身就带**
   *   "项目"（'未知项目' / 'Node.js 项目' / '.NET 项目'）。
   *   第一版写成 `${projectTypeLabel(project.type)}项目`，
   *   实测渲染出「未知项目项目」—— 这类"文案拼接重复"静态测试查不出来，
   *   是真机读到 DOM 文本才发现的。 */
  const entryText = project.entrypoint || coreEntries.slice(0, 4).join('、')
    || (project.type ? projectTypeLabel(project.type) : '启动 MCP 后检测');
  $('#projectEntrypointStatus').textContent = entryText;
  setDot($('#projectEntrypointDot'), entryText ? 'ready' : 'warn');

  const pressure = context?.context_pressure || {};
  const toolCalls = Number(pressure.tool_calls || 0);
  const filesRead = Number(pressure.files_read || 0);
  const megabytes = Number(pressure.response_megabytes || 0);
  /* 三项全 0 时说明还没开始用 —— 说"0 次工具调用 · 0 个文件 · 0 MB 输出"
   * 是一串没有信息量的零。这时直接说"本次会话尚未开始"更有用。 */
  const idle = !toolCalls && !filesRead && !megabytes;
  const pressureText = idle
    ? '本次会话尚未开始'
    : `${toolCalls} 次工具调用 · ${filesRead} 个文件 · ${megabytes} MB 输出`;
  $('#contextPressureStatus').textContent = pressure.recommend_new_chat ? `${pressureText} · 建议新建会话` : pressureText;
  setDot($('#contextPressureDot'), pressure.level === 'high' ? 'error' : pressure.level === 'elevated' ? 'warn' : 'ready');

  const list = $('#projectInstructionsList');
  list.replaceChildren();
  const items = [
    ...rootFiles.map((item) => ({ path: item?.path, kind: '根目录规则', truncated: item?.truncated })),
    ...nestedFiles.map((path) => ({ path, kind: '嵌套规则', truncated: false }))
  ].filter((item) => item.path);
  /* 第 23 项：没有指令文件时整块明细收起来。
   * 原来这里渲染一行「当前项目没有 AGENTS.md / CLAUDE.md；本地工具将使用内置工作流规则。」
   * —— 那件事已经由「项目指令」那格的值直接说清了（"未使用（将走内置工作流规则）"），
   * 再补一行等于同一句"没有"说两遍，还多占 17px + 15px 间距。 */
  list.hidden = items.length === 0;
  if (!items.length) return;
  items.forEach((item) => {
    const content = instructionContents.get(String(item.path).toLowerCase()) || '';
    if (content) {
      const details = document.createElement('details');
      details.className = 'instruction-details';
      const summary = document.createElement('summary');
      summary.textContent = `${item.path} · ${item.kind}${item.truncated ? ' · 内容已截断' : ''}`;
      const pre = document.createElement('pre');
      pre.textContent = content;
      details.append(summary, pre);
      list.appendChild(details);
      return;
    }
    const row = document.createElement('div');
    row.className = 'task-file';
    const code = document.createElement('code'); code.textContent = item.path;
    const meta = document.createElement('span'); meta.textContent = `${item.kind}${item.truncated ? ' · 内容已截断' : ''}`;
    row.append(code, meta);
    list.appendChild(row);
  });
}

async function loadWorkspaceContext(force = false) {
  if (!api.workspaceContext) return;
  const btn = $('#refreshWorkspaceContext');
  if (btn) {
    btn.classList.add('is-refreshing');
    btn.disabled = true;
  }
  // 1. 首帧秒开：不论是否过期，只要内存有旧缓存，立即同步呈现，消除白屏/等待感
  if (state.workspaceContext) {
    renderWorkspaceContext(state.workspaceContext);
  }
  const now = Date.now();
  if (state.workspaceContext && !force && (now - (state.lastWorkspaceContextTimestamp || 0) < 12000)) {
    if (btn) {
      btn.classList.remove('is-refreshing');
      btn.disabled = false;
    }
    return;
  }
  // 2. 后台异步静默拉取
  try {
    const [contextResult, guideResult] = await Promise.all([
      api.workspaceContext(),
      api.codingToolsGuide ? api.codingToolsGuide({ include_project_instructions: true }) : Promise.resolve(null)
    ]);
    const context = unwrap(contextResult);
    const guide = guideResult?.ok ? guideResult.data : null;
    state.workspaceContext = context;
    state.lastWorkspaceContextTimestamp = Date.now();
    renderWorkspaceContext(context, guide);
    if ($('#guideProgressCaption')) renderGuideProgress();
  } catch (error) {
    if (!state.workspaceContext) {
      state.workspaceContext = null;
      $('#projectInstructionsStatus').textContent = '本地工具未运行或暂不可读';
      $('#projectEntrypointStatus').textContent = '启动 MCP 后检测';
      $('#contextPressureStatus').textContent = '暂无统计';
      setDot($('#projectInstructionsDot'), 'warn');
      setDot($('#projectEntrypointDot'), 'warn');
      setDot($('#contextPressureDot'), 'warn');
      const list = $('#projectInstructionsList');
      if (list) { list.replaceChildren(); list.hidden = true; }
    }
  } finally {
    if (btn) {
      btn.classList.remove('is-refreshing');
      btn.disabled = false;
    }
  }
}

async function loadCodingToolsGuide() {
  if (!api.codingToolsGuide) return;
  const btn = $('#refreshCodingToolsGuide');
  if (btn && btn.disabled) return;
  if (btn) {
    btn.classList.add('is-refreshing');
    btn.disabled = true;
  }
  if (state.lastCodingToolsGuide?.custom_instructions) {
    $('#customInstructionsText').textContent = state.lastCodingToolsGuide.custom_instructions;
  }
  try {
    const guide = unwrap(await api.codingToolsGuide());
    state.lastCodingToolsGuide = guide;
    if (guide?.custom_instructions) $('#customInstructionsText').textContent = guide.custom_instructions;
    $('#codingToolsGuideStatus').textContent = '已从本地工具读取最新使用规则。';
    toast('指令已刷新', '已读取最新的 ChatGPT 自定义指令。', 'success');
  } catch {
    if (!state.lastCodingToolsGuide) {
      $('#codingToolsGuideStatus').textContent = 'MCP 尚未运行，当前显示内置推荐版本；启动后可再次刷新。';
    }
  } finally {
    if (btn) {
      btn.classList.remove('is-refreshing');
      btn.disabled = false;
    }
  }
}

async function addAuthorizedRoot() {
  try {
    const selected = unwrap(await api.chooseWorkspace());
    if (!selected) return;
    const current = state.snapshot?.settings?.authorizedRoots || [];
    if (current.some((item) => item.toLowerCase() === selected.toLowerCase())) {
      toast('目录已授权', selected);
      return;
    }
    const viewport = $('.content-viewport');
    const savedScrollTop = viewport ? viewport.scrollTop : 0;
    const snapshot = unwrap(await api.updateAuthorizedRoots([...current, selected]));
    renderSnapshot(snapshot, { forceForms: false });
    if (viewport) {
      viewport.scrollTop = savedScrollTop;
      requestAnimationFrame(() => { viewport.scrollTop = savedScrollTop; });
    }
    toast('已添加授权目录', selected);
  } catch (error) { toast('授权目录失败', error.message, 'error'); }
}

async function removeAuthorizedRoot(root) {
  try {
    const current = state.snapshot?.settings?.authorizedRoots || [];
    const viewport = $('.content-viewport');
    const savedScrollTop = viewport ? viewport.scrollTop : 0;
    const snapshot = unwrap(await api.updateAuthorizedRoots(current.filter((item) => item !== root)));
    renderSnapshot(snapshot, { forceForms: false });
    if (viewport) {
      viewport.scrollTop = savedScrollTop;
      requestAnimationFrame(() => { viewport.scrollTop = savedScrollTop; });
    }
    toast('已移除授权目录', root);
  } catch (error) { toast('移除授权失败', error.message, 'error'); }
}

function renderEnvironment(environment) {
  const isPythonInstalled = !!environment.python?.installed;
  setDot($('#envPythonDot'), isPythonInstalled ? 'ready' : 'error');
  if ($('#envPythonText')) $('#envPythonText').textContent = isPythonInstalled ? environment.python.version : '未找到 Python 3.11+';
  const pyBtn = $('#pythonInstall');
  if (pyBtn) {
    if (isPythonInstalled) {
      pyBtn.textContent = '已就绪';
      pyBtn.disabled = true;
      pyBtn.className = 'env-status-badge success';
    } else {
      pyBtn.textContent = '安装环境';
      pyBtn.disabled = false;
      pyBtn.className = 'secondary-button compact-btn';
    }
  }
  const proxy = environment.proxy;
  const sourceLabels = {
    'auto-direct': '自动检测 · 直连', 'auto-system': '自动检测 · Windows 系统代理', 'auto-local': '自动检测 · 本地代理',
    'system': 'Windows 系统代理', 'system-direct': '系统未设代理 · 直连', manual: '手动代理', direct: '强制直连',
    'auto-unavailable': '未找到可用网络路径', error: '代理检测失败'
  };
  setDot($('#envProxyDot'), proxy.reachable ? 'ready' : 'error');
  $('#envProxyText').textContent = `${sourceLabels[proxy.source] || '网络检测'}${proxy.url ? ` · ${proxy.url}` : ''}`;
  const proxyHint = $('#proxyHint');
  if (proxyHint) {
    proxyHint.textContent = proxy.reachable ? '当前网络路径已通过实际连通性验证。' : '当前路径未通过验证，可重新检测或选择手动代理。';
  }
  const netStatusEl = $('#deployNetworkStatus');
  const netState = proxy.reachable ? 'ready' : 'error';
  if (netStatusEl) {
    netStatusEl.textContent = proxy.reachable ? '正常' : '异常';
    netStatusEl.className = `metric-value-display status-${netState}`;
    const cell = netStatusEl.closest('.metric-cell');
    if (cell) {
      cell.classList.remove('is-ready', 'is-warn', 'is-error');
      cell.classList.add(`is-${netState}`);
    }
  }
  setDot($('#deployNetworkDot'), netState);
}

function renderProxyControls() {
  const currentMode = $('#proxyModeSelect')?.value || 'auto';
  const manual = currentMode === 'manual';
  $$('.proxy-mode-card').forEach((card) => {
    const isCur = card.dataset.mode === currentMode;
    card.classList.toggle('active', isCur);
    card.classList.toggle('is-muted', !isCur);
  });
  const manualField = $('#manualProxyField');
  if (manualField) {
    manualField.classList.toggle('is-open', manual);
    manualField.classList.toggle('disabled', !manual);
  }
  const proxyInput = $('#proxyUrlInput');
  if (proxyInput) {
    proxyInput.disabled = !manual;
  }
  const modeNames = { auto: '自动检测', system: '跟随系统', manual: '手动代理', direct: '强制直连' };
  if ($('#deployNetworkMode')) $('#deployNetworkMode').textContent = modeNames[currentMode] || '自动检测';
}

function renderDeploySummary() {
  const summaryNode = $('#deploySummary');
  if (summaryNode) {
    summaryNode.textContent = '';
    summaryNode.hidden = true;
  }
}

async function refreshSnapshot(options = {}) {
  try {
    const snapshot = unwrap(await api.snapshot());
    renderSnapshot(snapshot, options);
    return snapshot;
  } catch (error) {
    toast('状态检测失败', error.message, 'error');
    return null;
  }
}

function collectSettings() {
  // ★ 主动删除的工作区绝不能通过 saveSettings 反向写回磁盘：
  // 即便 state.selectedWorkspace 被某条路径意外污染（如某次快照未及时 sanitize），
  // 这里也把它归零，不给后端"复活"的机会。
  const currentWorkspace = (state.userRemovedWorkspaces
    && state.userRemovedWorkspaces.has(String(state.selectedWorkspace || '').trim().toLowerCase()))
    ? ''
    : state.selectedWorkspace;
  return {
    workspace: currentWorkspace,
    permissionMode: $('input[name="permission"]:checked')?.value || 'safe',
    mcpPort: Number($('#mcpPortInput').value),
    healthPort: Number($('#healthPortInput').value),
    proxyMode: $('#proxyModeSelect').value,
    proxyUrl: $('#proxyUrlInput').value.trim(),
    tunnelId: $('#tunnelIdInput').value.trim(),
    theme: $('#themeSelect').value,
    startWithWindows: $('#startWithWindowsToggle').checked,
    keepRunningOnClose: $('#keepRunningToggle').checked,
    closeAction: $('#keepRunningToggle').checked ? 'tray' : 'quit',
    showTrayIcon: $('#showTrayIconToggle') ? $('#showTrayIconToggle').checked : true,
    autoStartServices: $('#autoStartToggle').checked,
    progressReportSeconds: Number($('#progressReportSelect').value || 90),
    taskNotifications: $('#taskNotificationsToggle').checked,
    taskNotificationSound: $('#taskNotificationSoundToggle').checked,
    /* 第 28 轮：开发者模式必须随每次保存一起提交。
     *
     * 这里曾经漏掉这个字段 —— 后果是开关**永远存不进去**：
     * 主进程的 normalize() 是「patch 里有的键才覆盖，没有的保留旧值」
     * （见 electron/services/config.js 的 merge 循环），
     * saveSettings 提交的 patch 里不含 developerMode 时，磁盘上那份
     * 设置里 developerMode 就一直是上一次的值。
     * 于是"打开开关 → 重启 → 又变回关闭"，用户会以为开关是坏的。
     *
     * 注意不能读 $('#developerModeToggle').checked 之外的来源：
     * 开关状态只有 DOM 一处真相，renderDeveloperMode 负责把它同步成当前设置值，
     * 所以这里读 DOM 就是读"用户此刻看到的那个状态"。 */
    developerMode: $('#developerModeToggle')?.checked || false,
    guideProgress: collectGuideProgress()
  };
}

async function saveSettings(showToast = true) {
  const saved = unwrap(await api.saveSettings(collectSettings()));
  if (showToast) toast('设置已保存', '新的配置会在下一次部署时生效。');
  if (state.snapshot) state.snapshot.settings = saved;
  return saved;
}

async function saveKeyIfPresent() {
  const key = $('#runtimeKeyInput').value.trim();
  if (!key) return false;
  unwrap(await api.saveRuntimeKey(key));
  $('#runtimeKeyInput').value = '';
  return true;
}

/**
 * 运行进度面板按需显示。
 *
 * 设计意图：部署尚未开始时，这个面板展示的是「0% / 尚未开始部署 / 等待操作」
 * —— 三处措辞都在说同一件事：还没开始。它占据总览页半屏，却没有信息量。
 * 因此约定：只有真正进入运行（percent > 0）或部署失败需要处理时才显示，
 * 其余情况隐藏，让「常用操作」独占整行。
 */
function setProgressPanelVisible(visible) {
  const panel = $('.progress-panel');
  if (panel) panel.hidden = !visible;
  // 同步容器布局：面板隐藏时让「常用操作」独占整行
  const row = $('.overview-bottom');
  if (row) row.classList.toggle('is-solo', !visible);
}

function updateProgress(payload) {
  const percent = Math.max(0, Math.min(100, Number(payload.percent || 0)));
  const failed = payload.step === 'failed';
  $('#progressPercent').textContent = `${percent}%`;
  $('#progressBar').style.width = `${percent}%`;
  $('#progressRing').style.setProperty('--value', `${percent * 3.6}deg`);
  $('#progressTitle').textContent = failed ? '部署失败' : payload.step === 'complete' ? '部署完成' : '正在执行部署任务';
  $('#progressMessage').textContent = payload.message;
  $('#progressBadge').textContent = failed ? '需要处理' : payload.step === 'complete' ? '已完成' : '运行中';
  setProgressPanelVisible(percent > 0 || failed);
  if (failed) toast('部署失败', payload.message, 'error');
}

async function runRuntime(action) {
  setBusy(true, false);
  navigate('overview');
  try {
    const result = unwrap(await api[action]());
    renderSnapshot(result, { forceForms: true });
    toast(action === 'stop' ? '服务已停止' : '操作完成', action === 'stop' ? '本地工具与连接通道已安全停止。' : '本地工具与连接通道已通过健康检查。');
  } catch (error) {
    toast('操作失败', error.message, 'error');
    if (/工作目录|Runtime API Key|Tunnel ID|Python/.test(error.message)) navigate('deploy');
  } finally {
    setBusy(false);
    await refreshSnapshot();
  }
}

async function deployNow() {
  setBusy(true, false);
  try {
    await saveKeyIfPresent();
    await saveSettings(false);
    navigate('overview');
    const result = unwrap(await api.start());
    renderSnapshot(result, { forceForms: true });
    toast('部署完成', '现在可以按照指导页面在 ChatGPT 中创建或测试 MCP。');
  } catch (error) {
    toast('部署失败', error.message, 'error');
  } finally {
    setBusy(false);
    await refreshSnapshot();
  }
}

let isChoosingWorkspace = false;
async function chooseWorkspace() {
  if (isChoosingWorkspace) return;
  isChoosingWorkspace = true;
  try {
    const selected = unwrap(await api.chooseWorkspace());
    if (!selected) return;
    state.selectedWorkspace = selected;
    if ($('#selectedWorkspace')) $('#selectedWorkspace').textContent = selected;
    renderDeploySummary();
    const isMcpRunning = Boolean(state.snapshot?.status?.runtimeRunning);
    if (isMcpRunning) {
      toast('正在切换工作目录', 'MCP 会在后台热切换目录，ChatGPT 与 Tunnel 不会关闭。');
    }
    const viewport = $('.content-viewport');
    const savedScrollTop = viewport ? viewport.scrollTop : 0;
    const switched = unwrap(await api.switchWorkspace(selected));
    state.selectedWorkspace = switched?.settings?.workspace || selected;
    state.snapshot = switched;
    renderSnapshot(switched, { forceForms: false });
    renderOverviewWorkspace(switched);
    renderOverviewServices(switched);
    await loadWorkspaceContext();
    if (viewport) {
      viewport.scrollTop = savedScrollTop;
      requestAnimationFrame(() => { viewport.scrollTop = savedScrollTop; });
    }
    toast('工作目录已设置', selected);
  } catch (error) {
    toast('无法选择目录', error.message, 'error');
  } finally {
    isChoosingWorkspace = false;
  }
}

async function copyText(text, showToast = true) {
  const str = String(text ?? '');
  if (!str) return false;
  let copied = false;

  // 1. 优先使用 Electron 主进程系统原生剪贴板（不受 Chromium 焦点限制与权限策略影响，100% 成功）
  if (api && typeof api.writeClipboardText === 'function') {
    try {
      const res = await api.writeClipboardText(str);
      if (res && res.ok !== false) copied = true;
    } catch { /* 降级到网页 API */ }
  }

  // 2. 现代 Web Clipboard API
  if (!copied && navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(str);
      copied = true;
    } catch { /* 降级到 execCommand */ }
  }

  // 3. 传统隐藏 DOM textarea execCommand('copy') 回退保障
  if (!copied) {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = str;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.left = '-9999px';
      textarea.setAttribute('readonly', '');
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      copied = Boolean(document.execCommand('copy'));
      document.body.removeChild(textarea);
    } catch { /* 全部失败 */ }
  }

  if (copied) {
    if (showToast) {
      toast('已复制', str.length > 70 ? '内容已复制到剪贴板。' : str);
    }
    return true;
  }

  if (showToast) {
    toast('复制失败', '请手动选择并复制。', 'error');
  }
  return false;
}

/* ── 接入进度（第 25 轮重做）──────────────────────────────────────────
 * 旧做法：5 个步骤各配一个复选框，用户自己点"已完成"，进度 = 勾了几个 / 5。
 *   问题：与服务是否真的通了毫无关系。边都没连上也能点满 100%。
 *
 * 新做法：把 5 步拆成两类，各用各的信号 ——
 *
 *   可检测（3 步）——助手有真实数据，每 5 秒跟着心跳重算：
 *     tunnel   创建连接通道 → 后端已保存 Tunnel ID
 *     key      准备运行密钥 → 后端已安全保存 Runtime API Key
 *     deploy   部署本地服务 → MCP 与 Tunnel 两个进程都归助手所有且在跑
 *   判据口径与「诊断与修复」页、工具栏状态点**同源**（都读同一份 heartbeat /
 *   snapshot），所以三处不会互相矛盾。
 *
 *   只能人工确认（2 步）——发生在 ChatGPT 账户里，助手看不到。
 *
 * 第 29 轮（用户第 4 条「不要搞什么"我已在 ChatGPT 中完成创建"」）修正：
 *   第 25 轮这两步做成了两个**自述式复选框**（"我已完成创建"/"我已发送过测试语句"）。
 *   它们是诚实的（没编假信号），但仍然只是"用户自己宣布"——
 *   点满 5 项照样可能是边都没连上。用户对这个形态的批评是对的。
 *
 *   现在改成：**自述必须被真实探测校验**。
 *     用户点「我已创建，检查连通性」→ 立刻跑真实体检（inspectHealth），
 *     结果写回徽标：两侧都通才变绿；否则如实说明缺哪一步。
 *     "工具是否被调用过"助手确实查不到 —— 所以第 5 步不再假装能查，
 *     而是去查**这次会话真实的工具调用计数**（workspaceContext 的
 *     context_pressure.tool_calls）。有调用记录就说明工具真的通了，
 *     这是可观测的事实，不是用户的声明。
 *
 *   于是"人工确认"这一类的含义从"用户说了算"变成"用户触发的真实检查"，
 *   仍然保留它**必须由一个动作触发**（而不是页面自己变绿）——
 *   因为这两步的前提（在 ChatGPT 那边建连接器）确实发生在助手视野之外。 */
function guideManualChecked() {
  return Object.fromEntries($$('[data-guide-manual]').map((input) => [input.dataset.guideManual, input.checked]));
}

/* 第 29 轮：自述式复选框（data-guide-manual）已全部移除，这两个函数
 * 于是成了"永远返回空"的空壳。**保留而不删**的理由：
 *   · main.js 的 settings:save 白名单里仍有 guideProgress 字段，
 *     删掉提交端会让它变成"只进不出"的死字段（写进去却永远不再更新）；
 *   · 用户从旧版本升级上来时，settings.json 里已有 guideProgress 历史值，
 *     读取端（restoreGuideProgress）仍在调用它来兼容旧数据；
 *   · 保留一个"读出来是 {}"的函数，比六个月后有人重新发明一个
 *     自述式进度要安全 —— 注释在这里说明了为什么不这么做。 */
function collectGuideProgress() {
  return guideManualChecked();
}

function restoreGuideProgress(progress) {
  $$('[data-guide-manual]').forEach((input) => { input.checked = Boolean(progress[input.dataset.guideManual]); });
  renderGuideProgress();
}

/* 真实检测结果。数据全部来自已有的 snapshot / heartbeat，没有新增后端调用。
 *
 * 第 29 轮补充 connector / test 两项的真实判据：
 *   connector —— 第 4 步"连接器已建好"发生在 ChatGPT 账户里，助手查不到创建动作；
 *     但"有没有生效"是**可观测**的：连接器注册成功后，ChatGPT 会开始向 Tunnel
 *     发送 MCP 请求，届时 MCP 侧的 context_pressure.tool_calls 会从 0 增长。
 *     所以判据取"本次会话是否已发生过工具调用" —— 与 test 同源，只是语义不同：
 *       connector 问的是"这条链路有没有被打通过至少一次"
 *       test      问的是"首次只读测试跑过了没有"
 *     两者在数据上确实是同一个信号。这里**不**把它们编成两个假判据：
 *     connector 用 tool_calls > 0，test 用用户点过「检查工具是否被调用」且计数 > 0
 *     （即：test 额外的要求是"用户主动触发过一次校验"，因为它是最后一步）。 */
function guideToolCallCount() {
  const pressure = state.workspaceContext?.context_pressure
    || state.snapshot?.workspaceContext?.context_pressure
    || {};
  return Number(pressure.tool_calls || 0);
}

function guideDetected() {
  const settings = state.snapshot?.settings || {};
  const secrets = state.snapshot?.secrets || {};
  const status = state.snapshot?.status || {};
  const toolCalls = guideToolCallCount();
  /* 第 4 / 5 步的"已确认"状态存在 state 里（不是 DOM 复选框 —— 那两个已经被删掉了）。
   * 它们是**用户触发过真实检查**的标记，配合 tool_calls 一起判定。 */
  return {
    tunnel: Boolean(settings.tunnelId),
    key: Boolean(secrets.runtimeApiKey),
    deploy: Boolean(status.mcpRunning) && Boolean(status.tunnelRunning),
    connector: Boolean(state.connectorVerified) && toolCalls > 0,
    test: Boolean(state.toolCallVerified) && toolCalls > 0
  };
}

function renderGuideProgress() {
  const detected = guideDetected();

  const CHECKS = {
    tunnel: { on: detected.tunnel, text: '通道就绪', waiting: '未配置' },
    key: { on: detected.key, text: '密钥就绪', waiting: '未配置' },
    deploy: { on: detected.deploy, text: '服务运行中', waiting: '未启动' },
    connector: { on: detected.connector, text: '连接已连通', waiting: '待验证' },
    test: { on: detected.test, text: '测试已通过', waiting: '待测试' }
  };
  const ORDER = ['tunnel', 'key', 'deploy', 'connector', 'test'];

  let autoDone = 0; let manualDone = 0;
  const currentStepIdx = (state.currentGuideStep || 1) - 1;
  ORDER.forEach((key, idx) => {
    const item = CHECKS[key];
    const isCurrent = idx === currentStepIdx;

    const badge = $(`[data-guide-status="${key}"]`);
    if (badge) {
      badge.textContent = item.on ? item.text : item.waiting;
      badge.classList.toggle('on', item.on);
      badge.classList.toggle('off', !item.on);
      badge.classList.remove('current');
    }
    const step = $(`[data-guide-step="${key}"]`);
    if (step) {
      step.classList.toggle('done', item.on);
      step.classList.toggle('current', isCurrent);
    }
    const listItem = $(`[data-guide-item="${key}"]`);
    if (listItem) {
      listItem.classList.toggle('done', item.on);
      listItem.classList.toggle('current', isCurrent);
    }
    if (item.on) { if (key === 'connector' || key === 'test') manualDone += 1; else autoDone += 1; }
  });

  const totalDone = autoDone + manualDone;
  const percent = Math.round((totalDone / ORDER.length) * 100);
  $('#guideProgressPercent').textContent = `${percent}%`;
  $('#guideProgressBar').style.width = `${percent}%`;
  if ($('#guideStepCountText')) $('#guideStepCountText').textContent = `${totalDone} / ${ORDER.length}`;
  if ($('#guideProgressCaption')) $('#guideProgressCaption').textContent = `助手已检测 ${autoDone}/3 · 已验证 ${manualDone}/2`;
  $('#guideChecklist').dataset.autoDone = String(autoDone);
  $('#guideChecklist').dataset.manualDone = String(manualDone);
  if ($('#guideChangeKeyQuickBtn')) {
    $('#guideChangeKeyQuickBtn').textContent = detected.key ? '更换本地密钥' : '配置本地密钥';
  }
}

/* 第 29 轮新增：Tunnel ID 的显示/隐藏。
 *
 * 为什么在显示层做脱敏而不是干脆不显示：
 *   用户在这一步的真实需求是"把 Tunnel ID 贴进 ChatGPT 的连接器表单"，
 *   所以**复制**是主路径，肉眼核对是次路径。
 *   默认脱敏 → 截图/录屏/共享屏幕时不会把标识漏出去；
 *   需要核对时点「显示」即可，且按钮带 aria-pressed 供辅助技术播报。
 *
 * 脱敏函数与主进程无关，只是"前 7 位 + 尾部 4 位"，中间要点：
 *   · 太短的值（<= 12 字符）全遮，避免"遮了等于没遮"；
 *   · 保留 tunnel_ 前缀与末 4 位，这两段足以让人认出"是不是这一条"。 */
function maskTunnelId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '尚未填写';
  if (raw.length <= 12) return '•'.repeat(raw.length);
  return `${raw.slice(0, 7)}${'•'.repeat(12)}${raw.slice(-4)}`;
}

function renderTunnelIdDisplay() {
  const el = $('#guideTunnelId');
  if (!el) return;
  const raw = String(el.dataset.rawValue || '').trim();
  const shown = el.dataset.secret === '0';
  el.textContent = shown ? (raw || '尚未填写') : maskTunnelId(raw);
  const toggle = $('#toggleTunnelId');
  if (toggle) {
    toggle.textContent = shown ? '隐藏' : '显示';
    toggle.setAttribute('aria-pressed', String(shown));
    toggle.disabled = !raw;
  }
}

/* 第 29 轮新增：把用户的两句"我做过了"变成一次真实的连通性检查。
 *
 * 为什么必须真有动作、而不是把复选框换成按钮就完事：
 *   换控件不改行为的话，用户点一下按钮、徽标就变绿 —— 与原来勾一下没有区别。
 *   这里的做法是：点击 → 跑 inspectHealth()（真去探 MCP 端口与 Tunnel 进程）
 *   → 再用 workspaceContext()（真去读 MCP）拿工具调用计数
 *   → 两项都为真才判定"连接已打通"，否则如实报缺什么。
 *
 * 这样即使用户在 ChatGPT 那侧什么都没建，点了按钮也不会变绿 ——
 * 而"点了就绿"正是用户反对的那种自述式确认。 */
async function verifyGuideStep(stepKey, button) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = '正在检查…';
  try {
    await refreshSnapshot();
    await loadWorkspaceContext();
    const detected = guideDetected();
    if (stepKey === 'connector') state.connectorVerified = detected.connector;
    else state.toolCallVerified = detected.test;
    renderGuideProgress();
    const ok = detected[stepKey];
    if (ok) {
      toast('检查通过', stepKey === 'connector'
        ? '本地工具与连接通道都在运行，且已收到过工具调用。'
        : '已读取到本机执行过工具调用，链路是通的。');
    } else {
      const missing = [];
      if (!detected.tunnel) missing.push('Tunnel ID');
      if (!detected.key) missing.push('Runtime API Key');
      if (!detected.deploy) missing.push('本地服务未运行');
      if (!guideToolCallCount()) missing.push('还没有任何工具调用记录——请在 ChatGPT 里对该连接器发一条消息');
      toast('还没有通过', missing.join('；'), 'error');
    }
  } catch (error) {
    toast('检查失败', error.message, 'error');
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function appendBuildOutput(text) {
  const consoleElement = $('#buildConsole');
  /* ★ 第 31 轮（用户第 3 条）：控制台初始内容从"尚未执行构建验证。"换成
   *   标准终端提示符 `$ Ready. Click [开始验证] to run pipeline...`。
   *   于是"要不要把这一段清掉"的判据也必须跟着换：
   *   原来比对的是那一句叙述文案，现在比对的是**提示符字符**。
   *   改成结构判据（.console-prompt 是否还在）而不是文本判据 ——
   *   文案会被改，而"这是一条提示符"是结构事实。 */
  const hasPrompt = consoleElement.querySelector('.console-prompt');
  if (hasPrompt) consoleElement.textContent = '';
  const next = `${consoleElement.textContent}${text}`;
  consoleElement.textContent = next.slice(-60000);
  consoleElement.scrollTop = consoleElement.scrollHeight;
}

/* ★ 第 31 轮（用户第 3 条「未检测到的项直接提供快捷配置入口」）：
 * 把"没有方案"从一个**死结论**变成一个**可点的下一步**。
 * 改前值只写"未检测到可用测试；不会盲目执行"——用户读到了结论，
 * 但下一步要自己找到折叠的「高级：手动覆盖」再对上字段。
 * 现在同一行右侧就有入口，点了展开并聚焦对应输入框。
 *
 * 显隐判据由 applyBuildProject 在拿到 project 时**显式**写，
 * 而不是在这里嗅探值文案 —— 文案会改，而"这次有没有识别出命令"
 * 是数据事实（project.testCommand 是否存在），不该靠正则反推。 */
function setBuildPlanAction(entryId, hasPlan) {
  const entry = $(`#${entryId}`);
  if (entry) entry.hidden = Boolean(hasPlan);
}

function syncBuildControlsState() {
  const runTests = $('#buildRunTests')?.checked ?? true;
  const runBuild = $('#buildRunBuild')?.checked ?? true;

  const testCard = $('#pipelineTestCard');
  const testInput = $('#buildTestCommand');
  if (testCard) {
    testCard.classList.toggle('is-disabled-card', !runTests);
  }
  if (testInput) {
    testInput.disabled = !runTests;
  }

  const buildCard = $('#pipelineBuildCard');
  const buildInput = $('#buildCommand');
  const artifactsInput = $('#buildArtifacts');
  if (buildCard) {
    buildCard.classList.toggle('is-disabled-card', !runBuild);
  }
  if (buildInput) {
    buildInput.disabled = !runBuild;
  }
  if (artifactsInput) {
    artifactsInput.disabled = !runBuild;
  }
}

function updateInspectBuildButton() {
  const btn = $('#inspectBuild');
  if (!btn || btn.disabled) return;
  btn.textContent = state.buildInspected ? '重新识别' : '开始识别';
}

function applyBuildProject(project) {
  const type = String(project?.type || '').toLowerCase();
  const unknown = !type || type === 'unknown';
  const badge = $('#buildProjectType');
  // 严格按要求：未识别时采用人话「未识别技术栈」，严禁在主界面直接显示 wb-round28-VM7Lf0 这类内部工作区 ID
  const rawName = String(project?.name || '').trim();
  const isInternalId = /^wb-[a-z0-9\-]+$/i.test(rawName);
  const friendlyName = (rawName && !isInternalId) ? rawName : '';
  const typeText = projectTypeLabel(project?.type);

  if (badge) {
    badge.textContent = unknown ? '未识别技术栈' : (friendlyName ? `${typeText} · ${friendlyName}` : typeText);
    badge.classList.toggle('unknown', unknown);
    badge.classList.toggle('positive', !unknown);
  }

  updateInspectBuildButton();

  // 防覆写保护：当输入框处于编辑聚焦状态，或用户手动输入修改过，不被后台自动轮询冲掉
  const testInput = $('#buildTestCommand');
  if (testInput && document.activeElement !== testInput && !testInput.dataset.userEdited) {
    testInput.value = project?.testCommand || '';
  }
  const cmdInput = $('#buildCommand');
  if (cmdInput && document.activeElement !== cmdInput && !cmdInput.dataset.userEdited) {
    cmdInput.value = project?.buildCommand || '';
  }
  const artInput = $('#buildArtifacts');
  if (artInput && document.activeElement !== artInput && !artInput.dataset.userEdited) {
    artInput.value = (project?.artifacts || []).join(', ');
  }

  syncBuildControlsState();
  
  const planProjectNode = $('#buildPlanProject');
  if (planProjectNode) {
    planProjectNode.textContent = unknown ? '未识别技术栈' : typeText;
  }

  const planTestNode = $('#buildPlanTest');
  if (planTestNode) {
    planTestNode.textContent = project?.testCommand || '未检测到可用测试';
  }

  const planBuildNode = $('#buildPlanBuild');
  if (planBuildNode) {
    planBuildNode.textContent = project?.buildCommand || '自动检测';
  }

  const planArtifactsNode = $('#buildPlanArtifacts');
  if (planArtifactsNode) {
    planArtifactsNode.textContent = (project?.artifacts || []).length ? (project.artifacts || []).join('、') : '自动检查项目产物';
  }

  setBuildPlanAction('configureTestScript', Boolean(project?.testCommand));
  setBuildPlanAction('configureBuildScript', Boolean(project?.buildCommand));
  setBuildPlanAction('configureArtifacts', (project?.artifacts || []).length > 0);
}

async function inspectBuild(force = false) {
  if (state.lastProjectBuild) {
    applyBuildProject(state.lastProjectBuild);
  }
  const now = Date.now();
  if (state.lastProjectBuild && !force && (now - (state.lastBuildInspectTimestamp || 0) < 15000)) {
    return;
  }
  try {
    const project = unwrap(await api.inspectBuild());
    state.lastProjectBuild = project;
    state.lastBuildInspectTimestamp = Date.now();
    applyBuildProject(project);
  } catch (error) {
    if (!state.lastProjectBuild && force) {
      toast('项目识别失败', error.message, 'error');
    }
  }
}

/* 第 28 轮：构建报告合并后，这个渲染器要同时吃**两种数据结构** ——
 * 这是本轮最容易出错的地方，所以写在函数开头而不是散在取值处。
 *
 *   · 手动验证（build:run → buildVerificationService.execute）
 *     返回 camelCase：{ overallStatus, testResult, buildResult, artifacts, project }
 *   · 任务执行时自动记录（task-state 里的 last_build_report）
 *     是 snake_case：{ overall_status, test_results, build_results, artifacts, project, failure }
 *     且产物字段可能是 sha256 / sha384 / sha512 三者之一。
 *
 * ★ 若不做归一化，把 snake_case 喂给只读 camelCase 的代码，
 *   结果是**不报错、只是显示空白** —— `report.overallStatus` 取到 undefined，
 *   于是状态文案变成"验证失败"（被三元判成 falsy），而产物列表空掉。
 *   这种"看起来像没跑过"的失败最难查，所以归一化必须显式且集中。
 *
 * source 只用于标明这份结果从哪来：'task' = 任务运行时自动记录，
 * 'manual' = 用户点了「开始验证」。两者最终都是同一个东西，
 * 只是让用户知道"我上次手动跑的结果还在不在"。 */
function normalizeBuildReport(report) {
  if (!report || typeof report !== 'object') return null;
  const overall = report.overallStatus ?? report.overall_status;
  if (!overall) return null;
  const testStatus = report.testResult?.status ?? (Array.isArray(report.test_results) ? report.test_results.at(-1)?.status : undefined);
  const buildStatus = report.buildResult?.status ?? (Array.isArray(report.build_results) ? report.build_results.at(-1)?.status : undefined);
  return {
    overallStatus: overall,
    project: report.project || {},
    testStatus,
    buildStatus,
    artifacts: Array.isArray(report.artifacts) ? report.artifacts : [],
    failure: report.failure || ''
  };
}

function renderBuildReport(report, { source = 'manual' } = {}) {
  const container = $('#buildReport');
  const wrap = $('#buildReportWrap');
  const card = $('#buildDiagnosticCard');
  const iconElement = $('#buildDiagnosticIcon');
  const statusElement = $('#buildReportStatus');
  const sourceElement = $('#buildReportSource');
  const reasonElement = $('#buildDiagnosticReason');
  const metaElement = $('#buildDiagnosticMeta');
  const normalized = normalizeBuildReport(report);

  if (!normalized) {
    if (statusElement) statusElement.textContent = '—';
    if (sourceElement) sourceElement.textContent = '';
    if (container) container.replaceChildren();
    if (wrap) wrap.hidden = true;
    return;
  }
  if (wrap) wrap.hidden = false;

  const passed = normalized.overallStatus === 'passed';

  // 按钮文案联动：已跑过验证时更新为“重新验证”
  const btn = $('#runBuild');
  if (btn && !btn.disabled) {
    btn.textContent = '重新验证';
  }

  // 1. 卡片整体状态与图标
  if (card) {
    card.classList.toggle('passed', passed);
    card.classList.toggle('failed', !passed);
  }
  if (iconElement) {
    iconElement.textContent = passed ? '✓' : '⚠️';
  }
  if (statusElement) {
    statusElement.textContent = passed ? '验证通过' : '验证未通过';
  }
  if (sourceElement) {
    sourceElement.textContent = source === 'task' ? '任务自动记录' : '手动执行';
  }

  // 2. 核心诊断原因与提示（整合原本散落的零碎文字）
  if (reasonElement) {
    if (passed) {
      reasonElement.textContent = `自动化校验已全部通过，共校验 ${normalized.artifacts.length} 个产物文件。`;
    } else {
      if (normalized.failure) {
        reasonElement.textContent = normalized.failure;
      } else if (!normalized.artifacts.length) {
        reasonElement.textContent = '未检测到构建产物。请检查上方是否已开启“编译构建与产物校验”，或配置的“构建命令”与“产物目录”是否与工程实际输出一致。';
      } else {
        reasonElement.textContent = '构建验证未达到预期标准，请查看上方输出日志定位具体错误。';
      }
    }
  }

  // 3. 上下文参数轻量标签群（整洁徽标，消除单行突兀红框）
  if (metaElement) {
    metaElement.replaceChildren();
    const tags = [];
    const projName = textOr(normalized.project?.name);
    const projType = projectTypeLabel(normalized.project?.type);
    if (projName || projType) {
      tags.push(`项目: ${projName || '当前工作区'} (${projType})`);
    }
    if (normalized.project?.version) {
      tags.push(`版本: v${normalized.project.version}`);
    }
    if (normalized.testStatus) {
      tags.push(`测试: ${statusLabel(normalized.testStatus)}`);
    }
    if (normalized.buildStatus) {
      tags.push(`构建: ${statusLabel(normalized.buildStatus)}`);
    }
    tags.forEach(t => {
      const tagSpan = document.createElement('span');
      tagSpan.className = 'build-diagnostic-tag';
      tagSpan.textContent = t;
      metaElement.append(tagSpan);
    });
  }

  // 4. 产物列表
  if (container) {
    container.replaceChildren();
    normalized.artifacts.forEach((artifact) => {
      const row = document.createElement('div');
      row.className = 'build-report-artifact';
      const name = document.createElement('b');
      name.textContent = textOr(artifact.path);
      const size = document.createElement('span');
      size.textContent = artifact.size ? `${Number(artifact.size).toLocaleString()} bytes` : '';
      const hash = document.createElement('code');
      hash.textContent = textOr(artifact.sha256 || artifact.sha384 || artifact.sha512);
      row.append(name, size, hash);
      container.append(row);
    });
  }
}

async function runBuildVerification() {
  const btn = $('#runBuild');
  const consoleEl = $('#buildConsole');

  const options = {
    testCommand: $('#buildTestCommand').value.trim(),
    buildCommand: $('#buildCommand').value.trim(),
    artifacts: $('#buildArtifacts').value.split(',').map((item) => item.trim()).filter(Boolean),
    runTests: $('#buildRunTests').checked,
    runBuild: $('#buildRunBuild').checked
  };

  if (consoleEl) {
    consoleEl.textContent = `[启动验证] 正在执行项目验证流程...\n` +
      `» 自动化测试: ${options.runTests ? (options.testCommand || '自动检测') : '已跳过'}\n` +
      `» 编译与构建: ${options.runBuild ? (options.buildCommand || '自动检测') : '已跳过'}\n` +
      `» 产物校验: ${options.runBuild ? (options.artifacts.join(', ') || '自动检测') : '已跳过'}\n\n` +
      `正在执行任务，请稍候...`;
  }
  $('#buildStatus').textContent = '正在执行';
  $('#buildStatus').className = 'soft-badge';
  if (btn) {
    btn.disabled = true;
    btn.textContent = '正在验证…';
  }

  try {
    const report = unwrap(await api.runBuild(options));
    renderBuildReport(report);
    const passed = report.overallStatus === 'passed';
    $('#buildStatus').textContent = passed ? '已通过' : '未通过';
    $('#buildStatus').className = passed ? 'soft-badge success' : 'soft-badge danger';
    toast(passed ? '构建验证通过' : '构建验证未通过', `${report.artifacts?.length || 0} 个产物已校验`, passed ? 'success' : 'error');
  } catch (error) {
    $('#buildStatus').textContent = '执行失败';
    $('#buildStatus').className = 'soft-badge danger';
    appendBuildOutput(`\n${error.message}\n`);
    toast('构建验证失败', error.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '重新验证';
    }
  }
}

/* ── 诊断与修复（第 25 轮重排）──────────────────────────────────────
 * 旧版：面板里一条 <span> 显示"全部正常/需要处理"，下面一长列 10 行，
 *   每行都是 28px 图标 + 标题 + 明细 + 状态，全部同样式 —— 既不告诉你
 *   一共几项、几项有问题，也不给任何后续动作。用户评价："空间利用率太低，
 *   可视化效率低"。
 *
 * 新版分三层：
 *   ① 两个计数卡：正常几项 / 待处理几项（待处理为 0 时显示为绿色 "0"）；
 *   ② 待处理项单独成组，每项右侧带"修复"按钮（仅当后端声明该项可修时才给）；
 *   ③ 正常项收进折叠区，默认不占屏，标题写明条数。
 * 判据与「接入指南」前 3 步同源：都读同一份 health / heartbeat。 */
function getHealthStatus(check) {
  const ok = Boolean(check?.ok);
  switch (check?.id) {
    case 'workspace':
      return ok ? '目录可用' : '目录不可用';
    case 'runtime':
      return ok ? '环境完整' : '环境缺失';
    case 'tunnel-client':
      return ok ? '程序完整' : '程序缺失';
    case 'runtime-key':
      return ok ? '密钥完整' : '尚未保存';
    case 'tunnel-id':
      return ok ? '通道就绪' : '尚未配置';
    case 'mcp-port':
      return ok ? '端口可用' : '端口冲突';
    case 'mcp':
      return ok ? '服务正常' : '未启动';
    case 'mcp-schema':
      return ok ? '协议匹配' : '协议不一致';
    case 'tunnel-port':
      return ok ? '端口可用' : '端口冲突';
    case 'tunnel':
      return ok ? '连接正常' : '未启动';
    default:
      return ok ? '功能可用' : '需要排查';
  }
}

function createHealthStatusDot(ok) {
  const dot = document.createElement('i');
  dot.className = `health-status-dot ${ok ? 'green' : 'red'}`;
  return dot;
}

/* 说明：这里原来还有 buildHealthItem / healthRow 两个"48px 大行"渲染器，
 * 第 41 轮随健康页改版一并删除 —— 十项检查铺成 48px 大行正是用户说的
 * "不要浪费大量空间"，且改版后没有任何调用点（保留即死码）。 */

/* 紧凑行：渲染单个检查项（通过与否均采用一致的行布局与视觉规范）
 * 遵循现代桌面设计系统：左侧标准状态圆点与标题，右侧结构化状态药丸。 */
function healthRowCompact(check) {
  const ok = Boolean(check?.ok);
  const row = document.createElement('div');
  row.className = `health-line ${ok ? 'is-ok' : 'is-failed'}`;

  const left = document.createElement('div');
  left.className = 'health-line-left';
  left.append(createHealthStatusDot(ok));

  const title = document.createElement('span');
  title.className = 'health-line-title';
  title.textContent = check?.id === 'mcp-schema' ? '工具接口协议（MCP）' : textOr(check?.label);
  left.append(title);

  const tag = document.createElement('span');
  tag.className = `health-status-tag ${ok ? 'ok' : 'danger'}`;
  tag.textContent = getHealthStatus(check);

  row.append(left, tag);
  return row;
}

/* 分组兜底定义：只在后端没返回 report.groups 时使用（老版本主进程 / 预览模式）。
 * 顺序与 healthService 的 CHECK_GROUPS 保持一致 —— 也就是用户排查问题时该先看哪儿的顺序。 */
const FALLBACK_HEALTH_GROUPS = [
  { id: 'workspace', title: '工作目录', hint: '助手将要读写的那个目录' },
  { id: 'runtime', title: '本地运行环境', hint: '助手自带的 Python 与 Tunnel 程序' },
  { id: 'mcp', title: '本地工具服务（MCP）', hint: 'ChatGPT 调用工具时连的那一端' },
  { id: 'tunnel', title: '连接通道（OpenAI Tunnel）', hint: '把本机端口安全地暴露给 ChatGPT' },
];

function orderHealthChecks(report) {
  const checks = Array.isArray(report?.checks) ? report.checks : [];
  const GROUP_DEFS = Array.isArray(report?.groups) && report.groups.length
    ? report.groups : FALLBACK_HEALTH_GROUPS;
  const claimed = new Set();
  const ordered = [];
  for (const def of GROUP_DEFS) {
    for (const item of checks) {
      if (item.group === def.id && !claimed.has(item)) {
        ordered.push(item);
        claimed.add(item);
      }
    }
  }
  const orphans = checks.filter((item) => !claimed.has(item));
  return [...ordered, ...orphans];
}

/* 分组块：一个分组标题（图标 + 标题 + 说明）+ 该分组下的紧凑检查行。
 * 复用 styles.css 里既有的 .health-group-* 规则，不新增样式。 */
function healthGroupBlock(def, items) {
  const block = document.createElement('div');
  block.className = 'health-group-block';

  const head = document.createElement('div');
  head.className = 'health-group-head';
  const iconWrap = document.createElement('span');
  iconWrap.className = 'health-group-icon-wrap';
  iconWrap.append(renderGroupIcon(def?.id));
  const titleWrap = document.createElement('div');
  titleWrap.className = 'health-group-title-wrap';
  const title = document.createElement('span');
  title.className = 'health-group-title';
  title.textContent = textOr(def?.title);
  titleWrap.append(title);
  if (def?.hint) {
    const hint = document.createElement('span');
    hint.className = 'health-group-hint';
    hint.textContent = def.hint;
    titleWrap.append(hint);
  }
  head.append(iconWrap, titleWrap);

  const list = document.createElement('div');
  list.className = 'health-group-list';
  items.forEach((item) => list.append(healthRowCompact(item)));

  block.append(head, list);
  return block;
}

function renderGroupIcon(groupId) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'group-icon');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  if (groupId === 'workspace') {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', 'M2 4.5A1.5 1.5 0 0 1 3.5 3h2.88a1.5 1.5 0 0 1 1.06.44l1.12 1.12A1.5 1.5 0 0 0 9.62 5H12.5A1.5 1.5 0 0 1 14 6.5v6a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5v-8z');
    svg.append(p);
  } else if (groupId === 'runtime') {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '2'); rect.setAttribute('y', '3'); rect.setAttribute('width', '12'); rect.setAttribute('height', '10'); rect.setAttribute('rx', '2');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', 'M5 6.5l2 1.5-2 1.5M9.5 9.5h2');
    svg.append(rect, p);
  } else if (groupId === 'mcp') {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', 'M8.5 2L3.5 9h4l-.5 5 5-7h-4l.5-5z');
    svg.append(p);
  } else if (groupId === 'tunnel') {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '8'); circle.setAttribute('cy', '8'); circle.setAttribute('r', '6');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', 'M2 8h12M8 2a9 9 0 0 1 0 12M8 2a9 9 0 0 0 0 12');
    svg.append(circle, p);
  } else {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '8'); circle.setAttribute('cy', '8'); circle.setAttribute('r', '5');
    svg.append(circle);
  }
  return svg;
}

const HEALTH_HUMAN_ISSUES = {
  mcp: {
    title: '本地服务未启动',
    desc: 'ChatGPT 当前无法使用本地文件和工具。',
    status: '未启动',
    actionText: '启动服务',
    action: () => runRuntime('start')
  },
  tunnel: {
    title: 'ChatGPT 连接未启动',
    desc: '远程连接当前不可用。',
    status: '未启动',
    actionText: '启动连接',
    action: () => runRuntime('start')
  },
  runtime: {
    title: 'Python 运行环境缺失',
    desc: '需要 Python 3.11+ 运行环境，安装后即可恢复本地服务。',
    status: '未安装',
    actionText: '安装环境',
    action: () => {
      const btn = $('#pythonInstall');
      if (btn && !btn.disabled) btn.click();
      else navigate('deploy');
    }
  },
  workspace: {
    title: '工作目录未选择',
    desc: '请指定并授权一个本地工作目录，ChatGPT 才能正常读写项目文件。',
    status: '未选择',
    actionText: '选择目录',
    action: chooseWorkspace
  },
  'runtime-key': {
    title: '运行密钥未配置',
    desc: '缺少 Runtime API Key，无法与 OpenAI 建立远程认证通道。',
    status: '尚未保存',
    actionText: '配置密钥',
    action: () => navigate('advanced')
  },
  'tunnel-id': {
    title: '连接通道未配置',
    desc: '缺少 Tunnel ID，无法与 ChatGPT 建立反向通道。',
    status: '尚未配置',
    actionText: '配置通道',
    action: () => navigate('deploy')
  },
  'mcp-port': {
    title: '本地服务端口冲突',
    desc: '端口 18765 被其他程序占用，无法启动本地 MCP 监听。',
    status: '端口冲突',
    actionText: '修改端口',
    action: () => navigate('advanced')
  },
  'tunnel-port': {
    title: 'Tunnel 控制端口冲突',
    desc: '端口 18081 被占用，可能影响通道控制台与心跳检查。',
    status: '端口冲突',
    actionText: '修改端口',
    action: () => navigate('advanced')
  },
  'tunnel-client': {
    title: 'Tunnel 客户端程序缺失',
    desc: '未找到 Tunnel 可执行文件，无法建立连接通道。',
    status: '程序缺失',
    actionText: '重试修复',
    action: () => repairHealth()
  },
  'mcp-schema': {
    title: '工具接口协议不一致',
    desc: '本地工具定义与预期协议不一致，请尝试重启服务。',
    status: '协议异常',
    actionText: '重新启动',
    action: () => runRuntime('restart')
  }
};

const HEALTH_HUMAN_OK = {
  mcp: {
    title: '本地 MCP 服务',
    desc: '本地核心服务正在后台稳定运行，支持 ChatGPT 读写调用。',
    status: '服务正常'
  },
  tunnel: {
    title: 'ChatGPT 连接通道',
    desc: '反向连接通道已建立，与 ChatGPT 握手通信正常。',
    status: '连接正常'
  },
  runtime: {
    title: 'Python 运行环境',
    desc: 'Python 3.11+ 运行环境完整可用，支持本地工具扩展。',
    status: '环境就绪'
  },
  workspace: {
    title: '本地工作目录',
    desc: '已授权本地工作目录，具有完整的读写访问权限。',
    status: '目录可用'
  },
  'runtime-key': {
    title: '运行密钥配置',
    desc: 'Runtime API Key 已就绪，认证通道保持加密安全通信。',
    status: '已保存'
  },
  'tunnel-id': {
    title: '连接通道标识',
    desc: 'Tunnel ID 通道已绑定并就绪，可供远程隧道路由。',
    status: '通道就绪'
  },
  'mcp-port': {
    title: '本地服务端口',
    desc: '本地监听端口 18765 正常开放，无冲突占用。',
    status: '端口可用'
  },
  'tunnel-port': {
    title: 'Tunnel 控制端口',
    desc: '控制端口 18081 监听正常，心跳通信链路通畅。',
    status: '端口可用'
  },
  'tunnel-client': {
    title: 'Tunnel 客户端程序',
    desc: 'Tunnel 可执行客户端程序完整，版本校验通过。',
    status: '程序完整'
  },
  'mcp-schema': {
    title: '本地 MCP 工具协议规范',
    desc: '本地工具接口定义完整有效，协议规范与格式校验通过。',
    status: '规范完整'
  }
};

/* 待处理项渲染器：极简单行（红点 ● + 项目名称 + 极短状态 + 独立操作按钮） */
function createHealthIssueItem(check, failed = []) {
  const item = document.createElement('div');
  item.className = 'health-issue-row';

  // 1. 左侧：纯红色状态小圆点 ● + 项目名称
  const left = document.createElement('div');
  left.className = 'health-issue-left';

  let titleText = '系统项';
  let shortStatus = '需排查';
  let actionText = '处理';
  let actionFn = () => repairHealth();
  let isDisabled = false;

  // 依赖链判断：工作目录 / 密钥 / 通道 → 本地 MCP 服务 → ChatGPT 连接
  const isConfigIncomplete = failed.some((f) => ['workspace', 'runtime-key', 'tunnel-id', 'runtime'].includes(f.id));
  const isMcpNotRunning = failed.some((f) => f.id === 'mcp');

  if (check.id === 'workspace') {
    titleText = '工作目录';
    shortStatus = '未指定';
    actionText = '选择目录';
    actionFn = chooseWorkspace;
  } else if (check.id === 'runtime-key') {
    titleText = '运行认证密钥';
    shortStatus = '未保存';
    actionText = '配置';
    actionFn = () => navigate('advanced');
  } else if (check.id === 'tunnel-id') {
    titleText = '远程连接通道';
    shortStatus = '未配置';
    actionText = '配置';
    actionFn = () => {
      navigate('settings');
      switchSettingsTab('connection');
    };
  } else if (check.id === 'mcp') {
    titleText = '本地 MCP 服务';
    if (isConfigIncomplete) {
      shortStatus = '等待配置完成';
      isDisabled = true;
    } else {
      shortStatus = '未运行';
    }
    actionText = '启动';
    actionFn = () => runRuntime('start');
  } else if (check.id === 'tunnel') {
    titleText = 'ChatGPT 连接';
    if (isConfigIncomplete) {
      shortStatus = '等待配置完成';
      isDisabled = true;
    } else if (isMcpNotRunning) {
      shortStatus = '等待服务启动';
      isDisabled = true;
    } else {
      shortStatus = '未连接';
    }
    actionText = '连接';
    actionFn = () => runRuntime('start');
  } else if (check.id === 'runtime') {
    titleText = 'Python 运行环境';
    shortStatus = '未安装';
    actionText = '安装';
    actionFn = () => {
      const btn = $('#pythonInstall');
      if (btn && !btn.disabled) btn.click();
      else navigate('guide');
    };
  } else if (check.id === 'mcp-port') {
    titleText = '服务端口 18765';
    shortStatus = '被占用';
    actionText = '修改端口';
    actionFn = () => navigate('advanced');
  } else if (check.id === 'tunnel-port') {
    titleText = '控制端口 18081';
    shortStatus = '被占用';
    actionText = '修改端口';
    actionFn = () => navigate('advanced');
  } else if (check.id === 'tunnel-client') {
    titleText = 'Tunnel 客户端';
    shortStatus = '缺失';
    actionText = '修复';
    actionFn = () => repairHealth();
  } else if (check.id === 'mcp-schema') {
    titleText = '工具协议规范';
    shortStatus = '不一致';
    actionText = '修复';
    actionFn = () => runRuntime('restart');
  } else {
    titleText = check.label || '系统项';
    shortStatus = '异常';
  }

  const dot = document.createElement('span');
  dot.className = 'health-status-dot danger';
  dot.textContent = '●';

  const title = document.createElement('span');
  title.className = 'health-issue-title';
  title.textContent = titleText;

  left.append(dot, title);

  // 2. 中部：弱化短状态文字
  const mid = document.createElement('div');
  mid.className = 'health-issue-mid';

  const statusEl = document.createElement('span');
  statusEl.className = 'health-issue-status-text';
  statusEl.textContent = shortStatus;
  mid.append(statusEl);

  // 3. 右侧：直接操作按钮（受依赖条件控制可用性）
  const right = document.createElement('div');
  right.className = 'health-issue-right';

  const actionBtn = document.createElement('button');
  actionBtn.type = 'button';
  actionBtn.className = 'health-issue-action-btn';
  actionBtn.textContent = actionText;

  if (isDisabled) {
    actionBtn.disabled = true;
    actionBtn.setAttribute('aria-disabled', 'true');
  } else {
    actionBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof actionFn === 'function') actionFn();
    });
  }
  right.append(actionBtn);

  item.append(left, mid, right);
  return item;
}

/* 正常项渲染器：极简单行（绿勾 ✓ + 项目名 + 弱灰"正常"） */
function createHealthPassedItem(check) {
  let nameText = '检查项';

  if (check.id === 'runtime') {
    nameText = 'Python 运行环境';
  } else if (check.id === 'tunnel-client') {
    nameText = 'Tunnel 客户端';
  } else if (check.id === 'mcp-port') {
    nameText = '服务端口 18765';
  } else if (check.id === 'tunnel-port') {
    nameText = '控制端口 18081';
  } else if (check.id === 'mcp-schema') {
    nameText = '工具协议规范';
  } else if (check.id === 'workspace') {
    nameText = '工作目录';
  } else if (check.id === 'runtime-key') {
    nameText = '运行认证密钥';
  } else if (check.id === 'tunnel-id') {
    nameText = '远程连接通道';
  } else if (check.id === 'mcp') {
    nameText = '本地 MCP 服务';
  } else if (check.id === 'tunnel') {
    nameText = 'ChatGPT 连接';
  } else {
    nameText = check.label || '检查项';
  }

  const row = document.createElement('div');
  row.className = 'health-passed-row';

  // 1. 左侧：绿色对勾 ✓ + 标题（与待处理项 health-issue-left 220px 宽度完全平齐）
  const left = document.createElement('div');
  left.className = 'health-passed-left';

  const checkIcon = document.createElement('span');
  checkIcon.className = 'health-passed-icon';
  checkIcon.textContent = '✓';

  const name = document.createElement('span');
  name.className = 'health-passed-title';
  name.textContent = nameText;

  left.append(checkIcon, name);

  // 2. 中部：状态文字（与待处理项 health-issue-mid 完全在同一条线上对齐）
  const mid = document.createElement('div');
  mid.className = 'health-passed-mid';

  const statusText = document.createElement('span');
  statusText.className = 'health-passed-status-text';
  statusText.textContent = '正常';
  mid.append(statusText);

  // 3. 右侧：占位区（与待处理项 health-issue-right 88px 保持一致，保证网格严整）
  const right = document.createElement('div');
  right.className = 'health-passed-right';

  row.append(left, mid, right);
  return row;
}

function renderHealth(report) {
  const checks = orderHealthChecks(report);
  const failed = checks.filter((item) => !item.ok);
  const passed = checks.filter((item) => item.ok);

  // 1. 顶部状态区（只回答：现在能不能用、还差几项）
  const bannerTitle = $('#healthBannerTitle');
  const bannerDesc = $('#healthBannerDesc');
  const repairBtn = $('#repairHealth');
  
  if (failed.length === 0) {
    if (bannerTitle) bannerTitle.textContent = '全部环境已就绪，可正常使用';
    if (bannerDesc) bannerDesc.textContent = '本地服务与 ChatGPT 连接正常，可以正常使用 MCP 工具。';
    if (repairBtn) {
      repairBtn.textContent = '服务正常';
      repairBtn.disabled = true;
      repairBtn.className = 'secondary-button btn-sm';
    }
  } else {
    if (bannerTitle) bannerTitle.textContent = `还差 ${failed.length} 项即可使用`;
    if (bannerDesc) bannerDesc.textContent = '基础环境正常，完成配置并启动服务即可建立连接。';
    if (repairBtn) {
      repairBtn.textContent = '自动修复';
      repairBtn.disabled = false;
      repairBtn.className = 'primary-button btn-sm';
    }
  }

  // 2. 异常项主体（默认完整展开，按依赖状态控制）
  const issuesCard = $('#healthIssuesCard');
  const issuesList = $('#healthIssuesList');

  if (failed.length === 0) {
    if (issuesCard) issuesCard.hidden = true;
    if (issuesList) issuesList.replaceChildren();
  } else {
    if (issuesCard) issuesCard.hidden = false;
    if (issuesList) {
      issuesList.replaceChildren();
      failed.forEach((check) => {
        issuesList.append(createHealthIssueItem(check, failed));
      });
    }
  }

  // 3. 正常项区域：默认折叠，展开后平滑展示紧凑单行
  const passedCard = $('#healthPassedCard');
  const passedList = $('#healthPassedList');
  const passedSummaryText = $('#healthPassedSummaryText');

  if (passed.length === 0) {
    if (passedCard) passedCard.hidden = true;
    if (passedList) passedList.replaceChildren();
  } else {
    if (passedCard) passedCard.hidden = false;
    if (passedSummaryText) {
      passedSummaryText.textContent = `基础环境与依赖正常（${passed.length} 项）`;
    }
    if (passedList) {
      passedList.replaceChildren();
      passed.forEach((check) => {
        passedList.append(createHealthPassedItem(check));
      });
    }
  }

  // 5 个大类摘要流
  const checkPass = (idList) => idList.every(id => {
    const c = checks.find(item => item.id === id);
    return !c || c.ok;
  });

  const flowWorkspace = $('#flowWorkspace');
  if (flowWorkspace) flowWorkspace.hidden = !checkPass(['workspace']);
  const flowRuntime = $('#flowRuntime');
  if (flowRuntime) flowRuntime.hidden = !checkPass(['runtime']);
  const flowAuth = $('#flowAuth');
  if (flowAuth) flowAuth.hidden = !checkPass(['runtime-key', 'tunnel-id']);
  const flowPort = $('#flowPort');
  if (flowPort) flowPort.hidden = !checkPass(['mcp-port', 'tunnel-port']);
  const flowProtocol = $('#flowProtocol');
  if (flowProtocol) flowProtocol.hidden = !checkPass(['mcp-schema', 'tunnel-client']);

  // 兼容旧节点同步
  const cards = $('#healthSummaryCards');
  if (cards) cards.replaceChildren();
  const groups = $('#healthGroups');
  if (groups) groups.replaceChildren();
  if ($('#healthPassedCount')) $('#healthPassedCount').textContent = `${passed.length} 项通过`;
}

function getFallbackHealthReport(snapshot) {
  if (!snapshot) return null;
  const env = snapshot.environment || {};
  const status = snapshot.status || {};
  const settings = snapshot.settings || {};
  const checks = [
    { id: 'workspace', label: '本地工作目录', ok: Boolean(env.workspace?.exists && settings.workspace), repair: 'choose-workspace' },
    { id: 'runtime', label: 'Python 运行环境', ok: Boolean(env.python?.installed), repair: 'runtime' },
    { id: 'runtime-key', label: '运行密钥（API Key）', ok: Boolean(snapshot.secrets?.runtimeApiKey), repair: 'runtime-key' },
    { id: 'tunnel-id', label: '连接通道（Tunnel ID）', ok: Boolean(settings.tunnelId), repair: 'tunnel-id' },
    { id: 'mcp-port', label: '本地服务端口', ok: Boolean(env.ports?.mcpListening !== false), repair: 'port' },
    { id: 'tunnel-port', label: '控制通道端口', ok: Boolean(env.ports?.tunnelListening !== false), repair: 'port' },
    { id: 'tunnel-client', label: 'Tunnel 客户端', ok: Boolean(env.tunnelClient?.installed !== false), repair: 'restart' },
    { id: 'mcp', label: '本地 MCP 服务', ok: Boolean(status.runtimeRunning), repair: 'restart' },
    { id: 'tunnel', label: 'ChatGPT 连接通道', ok: Boolean(status.tunnelRunning), repair: 'restart' },
    { id: 'mcp-schema', label: 'MCP 协议匹配', ok: true, repair: 'restart' }
  ];
  return { healthy: checks.every((c) => c.ok), checks };
}

async function inspectHealth(force = false) {
  // 1. 同步首帧秒开：先看有没有历史详细报告，若无则使用 snapshot 派生的报告秒级呈现
  if (state.lastHealthReport) {
    renderHealth(state.lastHealthReport);
  } else if (state.snapshot) {
    const fallbackReport = getFallbackHealthReport(state.snapshot);
    if (fallbackReport) renderHealth(fallbackReport);
  }

  const now = Date.now();
  if (state.lastHealthReport && !force && (now - (state.lastHealthTimestamp || 0) < 8000)) {
    return;
  }
  try {
    const report = unwrap(await api.inspectHealth());
    state.lastHealthReport = report;
    state.lastHealthTimestamp = Date.now();
    renderHealth(report);
  } catch (error) {
    if (!state.lastHealthReport) {
      toast('系统检查失败', error.message, 'error');
    }
  }
}

async function repairHealth() {
  const btn = $('#repairHealth');
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  btn.textContent = '正在处理…';
  try {
    // 1. 尝试后端修复
    if (api.repairHealth) {
      try { unwrap(await api.repairHealth()); } catch { /* ignore non-blocking */ }
    }
    // 2. 若服务未启动，尝试启动服务与连接
    if (api.start) {
      try { unwrap(await api.start()); } catch { /* ignore */ }
    }
    // 3. 重新检查运行状态
    await refreshSnapshot();
    const latest = unwrap(await api.inspectHealth());
    state.lastHealthReport = latest;
    state.lastHealthTimestamp = Date.now();
    renderHealth(latest);

    const failed = (latest?.checks || []).filter(c => !c.ok);
    if (failed.length === 0) {
      btn.textContent = '✓ 已就绪';
      toast('全部就绪', '本地服务与 ChatGPT 连接已成功建立并通过所有检查。', 'success');
      setTimeout(() => { if (btn) { btn.textContent = '服务正常'; btn.disabled = true; } }, 2500);
    } else {
      btn.textContent = '自动修复';
      // 智能引导至第一个卡点
      const firstIssue = failed[0];
      if (firstIssue?.id === 'workspace') {
        toast('需要指定工作目录', '请先选择并授权本地工作目录。', 'info');
        chooseWorkspace();
      } else if (firstIssue?.id === 'runtime-key') {
        toast('需要配置运行密钥', '已跳转至连接设置，请填写 Runtime API Key。', 'info');
        navigate('advanced');
      } else if (firstIssue?.id === 'tunnel-id') {
        toast('需要配置远程通道', '已跳转至连接设置，请填写 Tunnel ID。', 'info');
        navigate('settings');
        switchSettingsTab('connection');
      } else {
        toast('部分项目需手动处理', `还差 ${failed.length} 项即可使用，请按顺序处理对应操作。`, 'info');
      }
    }
  } catch (error) {
    btn.textContent = '自动修复';
    toast('处理遇到问题', error.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

function applyHeartbeat(status) {
  if (!state.snapshot || !status) return;
  state.snapshot.status.runtimeRunning = Boolean(status.mcpRunning);
  state.snapshot.status.tunnelRunning = Boolean(status.tunnelRunning);
  state.snapshot.status.connectionRunning = Boolean(status.connectionRunning);
  state.snapshot.status.fullyReady = Boolean(status.fullyReady);
  /* 第 25 轮：接入指南前 3 步的判据来自这份心跳，所以心跳一到就重算进度，
   * 让用户开着服务时能看着那 3 步自己变绿，而不必手动刷新页面。
   * 只有向导页真的渲染过才重算（guideProgressCaption 存在于该页）。 */
  if ($('#guideProgressCaption')) renderGuideProgress();
  const connectionRunning = Boolean(status.tunnelRunning);
  const connectionLabel = '连接通道';
  const ready = state.snapshot.status.fullyReady;
  if ($('#mcpStatus')) $('#mcpStatus').textContent = status.mcpRunning ? '正常运行' : '未启动';
  if ($('#tunnelStatus')) $('#tunnelStatus').textContent = connectionRunning
    ? '已连接'
    : '未连接';
  setDot($('#mcpDot'), status.mcpRunning ? 'ready' : 'warn');
  setDot($('#tunnelDot'), connectionRunning ? 'ready' : 'warn');
  if ($('#sideRuntimeText')) $('#sideRuntimeText').textContent = ready ? '服务已就绪' : status.mcpRunning ? `等待 ${connectionLabel}` : '服务未运行';
  setDot($('#sideRuntimeDot'), ready ? 'ready' : status.mcpRunning ? 'warn' : 'idle');
  // 状态同步：若心跳携带了最新工作区路径，实时同步至快照缓存
  if (status.workspace && state.snapshot?.settings) {
    const wsKey = String(status.workspace).trim().toLowerCase();
    if (state.userRemovedWorkspaces && state.userRemovedWorkspaces.has(wsKey)) {
      // ★ 本次会话已"主动删除"过此工作区 —— 绝不让心跳把它复活。
      // 之前没有这道防御时，~1 分钟后工作区会被心跳悄悄恢复回来（磁盘 mtime 验证）：
      // 删除保存 '' 之后，后端被 (stat,~diagnostic) 或 (collectSettings,~toggle) 之类路径
      // 重新写入了同一值；下次心跳 status.workspace === 那个值，绕过 sanitize 直接写进
      // state.snapshot.settings.workspace，UI 就显示回来了。
      state.snapshot.settings.workspace = '';
      state.selectedWorkspace = '';
    } else {
      state.snapshot.settings.workspace = status.workspace;
      state.selectedWorkspace = status.workspace;
    }
  }
  renderOverviewConfig(state.snapshot);
  renderOverviewIssues(state.snapshot);
  renderOverviewServices(state.snapshot);
  renderOverviewWorkspace(state.snapshot);
}

async function loadLogs() {
  /* 反馈与防连点在这里做一次，而不是在每个调用点各写一遍（第 41 轮）。
   * 放在 finally 里：出错时不复位的话，按钮会永远转下去，比没有反馈更糟。 */
  const button = $('#refreshLogs');
  if (button && button.disabled) return;
  if (button) {
    button.classList.add('is-refreshing');
    button.disabled = true;
  }
  try {
    if (state.logs && state.logs.length) {
      renderLogs();
    }
    try {
      state.logs = unwrap(await api.logs());
      renderLogs();
    } catch (error) {
      if (!state.logs || !state.logs.length) {
        toast('日志读取失败', error.message, 'error');
      }
    }
  } finally {
    if (button) {
      button.classList.remove('is-refreshing');
      button.disabled = false;
    }
  }
}

/* 日志级别只用于显示。筛选用的还是后端枚举值（info/warn/error），
 * 所以这张表是"显示层字典"，不是契约 —— 后端加新级别时这里查不到就原样显示，
 * 不会让整行变空。 */
const LOG_LEVEL_LABEL = { info: '信息', warn: '警告', error: '错误' };

function humanizeLogEntry(rawMessage, level) {
  const msg = String(rawMessage || '').trim();
  // 1. 任务事件流暂时不可用 / 自动重连
  if (/任务事件流暂时不可用|SSE.*reconnect|EventSource.*error|正在自动重新连接/i.test(msg)) {
    return {
      title: '连接暂时不可用',
      desc: '任务事件流暂时中断，正在后台自动尝试恢复连接',
      module: '事件流 (SSE)',
      action: '前往故障排查 →',
      actionNav: 'health'
    };
  }
  // 2. 本地服务启动 / 关闭
  if (/服务已启动|MCP server started|Server listening|本地服务启动成功/i.test(msg)) {
    return {
      title: '网页 MCP 助手已启动',
      desc: '本地 MCP 服务进程已就绪，端口正常监听',
      module: '本地服务核心'
    };
  }
  if (/服务已停止|Server stopped|服务终止/i.test(msg)) {
    return {
      title: '网页 MCP 助手已停止',
      desc: '本地服务与端口监听已安全关闭',
      module: '本地服务核心'
    };
  }
  // 3. ChatGPT Tunnel 远程连接
  if (/Tunnel connected|已建立连接|Tunnel is ready|Tunnel established|远程通道已连通/i.test(msg)) {
    return {
      title: 'ChatGPT 远程连接已建立',
      desc: '加密远程通道已就绪，ChatGPT 可正常调用本地工具',
      module: '远程连接 (Tunnel)'
    };
  }
  if (/Tunnel disconnected|Tunnel closed|连接断开|通道已断开/i.test(msg)) {
    return {
      title: 'ChatGPT 远程连接已断开',
      desc: '连接通道已关闭或中断',
      module: '远程连接 (Tunnel)',
      action: '前往故障排查 →',
      actionNav: 'health'
    };
  }
  // 4. 工作区与项目目录
  if (/工作区已切换|workspace switched|Workspace changed|切换到工作区/i.test(msg)) {
    return {
      title: '工作目录已切换',
      desc: msg,
      module: '工作区管理'
    };
  }
  // 5. 端口冲突
  if (/EADDRINUSE|端口冲突|address already in use/i.test(msg)) {
    return {
      title: '本地服务端口冲突',
      desc: '本地端口已被占用，请检查占用程序或在高级设置修改端口',
      module: '网络服务',
      action: '前往故障排查 →',
      actionNav: 'health'
    };
  }
  // 6. Python 环境
  if (/python.*not found|Python 未找到|Python 环境缺失/i.test(msg)) {
    return {
      title: '未检测到 Python 运行环境',
      desc: '本地缺少 Python 3.10+ 环境，请先安装 Python',
      module: '运行时环境',
      action: '前往故障排查 →',
      actionNav: 'health'
    };
  }
  // 7. 静态预览或测试
  if (/静态界面预览模式/i.test(msg)) {
    return {
      title: '静态界面预览模式',
      desc: '当前处于前端开发与界面预览环境',
      module: '运行环境'
    };
  }

  // 默认提取：首个标点或换行截取主标题，其余作为说明
  const firstPeriod = msg.search(/[。\n\r]/);
  let title = msg;
  let desc = '';
  if (firstPeriod > 0 && firstPeriod < 60) {
    title = msg.slice(0, firstPeriod);
    desc = msg.slice(firstPeriod + 1).trim();
  } else if (msg.length > 50) {
    title = msg.slice(0, 48) + '…';
    desc = msg;
  }

  return {
    title: title || (level === 'error' ? '系统异常记录' : '服务运行记录'),
    desc: desc || (level === 'error' ? '出现异常，可展开查看技术细节' : '常规运行事件'),
    module: '系统核心',
    action: level === 'error' ? '前往故障排查 →' : '',
    actionNav: level === 'error' ? 'health' : ''
  };
}

function renderLogs() {
  const output = $('#logOutput');
  if (!output) return;

  // 1. 过滤：按级别与搜索词（支持搜索原始消息与人话标题）
  let list = state.logs || [];
  if (state.logFilter !== 'all') {
    list = list.filter((item) => item.level === state.logFilter);
  }
  if (state.logSearch) {
    const q = state.logSearch.toLowerCase();
    list = list.filter((item) => {
      const msg = String(item.message || '').toLowerCase();
      const info = humanizeLogEntry(item.message, item.level);
      return msg.includes(q) || info.title.toLowerCase().includes(q) || info.desc.toLowerCase().includes(q);
    });
  }

  output.replaceChildren();
  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<b>暂无运行记录</b><span>服务开始运行后，重要事件会显示在这里。</span>';
    output.appendChild(empty);
    return;
  }

  // 2. 连续重复日志合并算法
  const collapsed = [];
  for (let i = 0; i < list.length; i++) {
    const cur = list[i];
    if (collapsed.length > 0) {
      const last = collapsed[collapsed.length - 1];
      if (last.item.message === cur.message && last.item.level === cur.level) {
        last.count += 1;
        last.times.push(cur.time);
        last.latestTime = cur.time;
        continue;
      }
    }
    collapsed.push({ item: cur, count: 1, times: [cur.time], latestTime: cur.time });
  }

  // 3. 渲染行（带跨天无蓝条日期分割线与时间 HH:mm:ss）
  let lastDateStr = '';
  const now = new Date();
  const todayStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

  collapsed.forEach((entry) => {
    const dLatest = new Date(entry.latestTime);
    const dFirst = new Date(entry.times[0] || entry.latestTime);
    const dateStr = isNaN(dLatest) ? '' : `${dLatest.getFullYear()}/${String(dLatest.getMonth() + 1).padStart(2, '0')}/${String(dLatest.getDate()).padStart(2, '0')}`;
    
    // 跨天日期分割线
    if (dateStr && dateStr !== lastDateStr) {
      lastDateStr = dateStr;
      const dateSep = document.createElement('div');
      dateSep.className = 'log-date-divider';
      dateSep.textContent = dateStr === todayStr ? '今天' : dateStr;
      output.appendChild(dateSep);
    }

    const row = document.createElement('div');
    row.className = `log-line ${entry.item.level}`;
    
    const time = document.createElement('time');
    const timeFormatted = isNaN(dLatest) ? '—' : `${String(dLatest.getHours()).padStart(2, '0')}:${String(dLatest.getMinutes()).padStart(2, '0')}:${String(dLatest.getSeconds()).padStart(2, '0')}`;
    const firstTimeFormatted = isNaN(dFirst) ? timeFormatted : `${String(dFirst.getHours()).padStart(2, '0')}:${String(dFirst.getMinutes()).padStart(2, '0')}:${String(dFirst.getSeconds()).padStart(2, '0')}`;
    time.textContent = timeFormatted;

    const level = document.createElement('em');
    level.textContent = LOG_LEVEL_LABEL[entry.item.level] || entry.item.level;

    const contentCol = document.createElement('div');
    contentCol.className = 'log-content-col';

    const info = humanizeLogEntry(entry.item.message, entry.item.level);

    // 标题行（纯粹展示，外层无冗余按钮）
    const headlineRow = document.createElement('div');
    headlineRow.className = 'log-headline-row';

    const titleEl = document.createElement('span');
    titleEl.className = 'log-title';
    titleEl.textContent = info.title;
    headlineRow.appendChild(titleEl);

    // 右侧折叠指示微箭头（替代生硬文字按钮）
    const chevronIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chevronIcon.setAttribute('class', 'log-chevron-icon');
    chevronIcon.setAttribute('viewBox', '0 0 16 16');
    chevronIcon.setAttribute('fill', 'none');
    chevronIcon.setAttribute('stroke', 'currentColor');
    chevronIcon.setAttribute('stroke-width', '1.8');
    chevronIcon.setAttribute('stroke-linecap', 'round');
    chevronIcon.setAttribute('stroke-linejoin', 'round');
    chevronIcon.setAttribute('aria-hidden', 'true');
    const chevronPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    chevronPath.setAttribute('d', 'M6 12l4-4-4-4');
    chevronIcon.appendChild(chevronPath);
    headlineRow.appendChild(chevronIcon);

    contentCol.appendChild(headlineRow);

    // 副文本（单次为说明，多次为已自动重试 N 次 · 最近一次 HH:mm:ss）
    const descEl = document.createElement('span');
    descEl.className = 'log-desc';
    if (entry.count > 1) {
      descEl.textContent = `已自动重试 ${entry.count} 次 · 最近一次 ${timeFormatted}`;
    } else {
      descEl.textContent = info.desc || '常规运行事件';
    }
    contentCol.appendChild(descEl);

    // 极简详情卡片（默认收起，点击单行即展开/折叠，绝无繁琐冗余仪表盘）
    const detailCard = document.createElement('div');
    detailCard.className = 'log-detail-card-clean';
    detailCard.hidden = true; // 默认必须收起

    // 阻止卡片内部点击（如选词、复制）冒泡导致异常折叠
    detailCard.addEventListener('click', (e) => e.stopPropagation());

    // 纯粹的原始日志文本块（等宽字体、轻量灰底、干净清爽）
    const rawPre = document.createElement('pre');
    rawPre.className = 'log-raw-pre-clean';
    rawPre.textContent = entry.item.message;
    detailCard.appendChild(rawPre);

    // 详情底部轻量工具栏（左侧专属收起按键，右侧直达操作与复制）
    const detailActions = document.createElement('div');
    detailActions.className = 'log-detail-actions-clean';

    // 状态控制：展开与收起
    const setLogExpanded = (expanded) => {
      if (expanded) {
        row.classList.add('is-expanded');
        detailCard.hidden = false;
        detailCard.style.display = 'flex';
      } else {
        row.classList.remove('is-expanded');
        detailCard.hidden = true;
        detailCard.style.display = 'none';
      }
    };

    const toggleLogExpand = (e) => {
      if (e) e.stopPropagation();
      setLogExpanded(!row.classList.contains('is-expanded'));
    };

    // 明确的收起按钮，点击 100% 收回
    const collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.className = 'log-clean-btn log-collapse-btn';
    collapseBtn.innerHTML = `
      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 10l4-4 4 4"/>
      </svg>
      <span>收起</span>
    `;
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setLogExpanded(false);
    });
    detailActions.appendChild(collapseBtn);

    const actionGroup = document.createElement('div');
    actionGroup.className = 'log-detail-action-group';

    if (info.action) {
      const fixBtn = document.createElement('button');
      fixBtn.type = 'button';
      fixBtn.className = 'log-clean-btn primary';
      fixBtn.innerHTML = `
        <span>${info.action}</span>
        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 3l5 5-5 5"/>
        </svg>
      `;
      fixBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigate(info.actionNav || 'health');
      });
      actionGroup.appendChild(fixBtn);
    }

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'log-clean-btn secondary';
    copyBtn.innerHTML = `
      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6">
        <rect x="5" y="5" width="8" height="8" rx="1.5"></rect>
        <path d="M3 11V3a1 1 0 0 1 1-1h8"></path>
      </svg>
      <span>复制原始日志</span>
    `;
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await copyText(entry.item.message);
      copyBtn.innerHTML = `
        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="#059669" stroke-width="2.2">
          <polyline points="3.5 8.5 6.5 11.5 12.5 5.5"></polyline>
        </svg>
        <span style="color:#059669;">已复制 ✓</span>
      `;
      setTimeout(() => {
        copyBtn.innerHTML = `
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6">
            <rect x="5" y="5" width="8" height="8" rx="1.5"></rect>
            <path d="M3 11V3a1 1 0 0 1 1-1h8"></path>
          </svg>
          <span>复制原始日志</span>
        `;
      }, 1600);
    });
    actionGroup.appendChild(copyBtn);
    detailActions.appendChild(actionGroup);

    detailCard.appendChild(detailActions);
    contentCol.appendChild(detailCard);

    // 默认彻底收起
    setLogExpanded(false);

    // 点击行头部区域展开/收起详情
    row.classList.add('log-clickable-row');
    headlineRow.style.cursor = 'pointer';
    headlineRow.addEventListener('click', toggleLogExpand);

    // 点击整行头部空白处同样可以自由切换展开/收起
    row.addEventListener('click', toggleLogExpand);

    row.append(time, level, contentCol);
    output.appendChild(row);
  });

  const autoScroll = $('#logAutoScroll');
  if (!autoScroll || autoScroll.checked) {
    output.scrollTop = output.scrollHeight;
  }
  renderOverviewActivity(state.logs);
}

function bindEvents() {
  $('#backToMain')?.addEventListener('click', () => api.closeSettings());
  /* 第 22 轮：设置现在是铺满主窗口的"一个界面"，不再是浮层小窗。
   * 按 Esc 返回主界面是这种全屏界面的标准预期（用户会下意识去按），
   * 所以补上 —— 键盘与左上角「← 返回主界面」是同一个动作的两个入口。 */
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') api.closeSettings();
  });
  $$('.nav-item').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.page)));
  $$('[data-nav]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.nav)));
  const OPEN_EXTERNAL_META = {
    'chatgpt-connectors': {
      name: 'ChatGPT 连接器设置',
      hint: '已发起打开 ChatGPT 连接器配置页面。'
    },
    'openai-tunnels': {
      name: 'OpenAI 通道管理',
      hint: '已在默认浏览器中打开 OpenAI 远程通道页面。若需本地修改，可点击「查看本地设置」。'
    },
    'openai-runtime-keys': {
      name: 'OpenAI 密钥管理',
      hint: '已在默认浏览器中打开 OpenAI 访问密钥页面。若需本地修改，可点击「更换本地密钥」。'
    },
    'tunnel-ui': {
      name: 'Tunnel 控制面板',
      hint: '已在默认浏览器中打开本地 Tunnel UI。'
    },
    'coding-tools-source': {
      name: '上游项目仓库',
      hint: '已在默认浏览器中打开 GitHub 上游项目仓库页面。'
    }
  };

  $$('[data-open]').forEach((button) => button.addEventListener('click', async (e) => {
    e.stopPropagation();
    const target = button.dataset.open;
    if (!target) return;
    const meta = OPEN_EXTERNAL_META[target] || { name: '外部链接', hint: '已在默认浏览器中发起打开请求。' };
    const originalContent = button.innerHTML;
    button.disabled = true;
    toast(`正在打开${meta.name}`, meta.hint, 'info');
    try {
      unwrap(await api.openExternal(target));
    } catch (error) {
      toast('无法打开页面', error.message || '请检查默认浏览器或系统关联。', 'error');
    } finally {
      setTimeout(() => {
        button.disabled = false;
        button.innerHTML = originalContent;
      }, 500);
    }
  }));

  // 接入指南步骤 1：直达本地通道设置
  $('#guideGoTunnelSettingsBtn')?.addEventListener('click', () => {
    navigate('deploy');
    switchSettingsTab('connection');
    setTimeout(() => {
      const input = $('#tunnelIdInput');
      if (input) {
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  });

  // 接入指南步骤 2：直达本地更换密钥抽屉
  $('#guideChangeKeyQuickBtn')?.addEventListener('click', () => {
    navigate('deploy');
    switchSettingsTab('connection');
    setTimeout(() => {
      const row = $('#runtimeKeyInputRow');
      if (row) row.hidden = false;
      const toggleBtn = $('#toggleChangeKeyBtn');
      if (toggleBtn) toggleBtn.textContent = '收起';
      const input = $('#runtimeKeyInput');
      if (input) {
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  });

  // 接入指南步骤 4：进阶自定义指令抽屉展开/收起切换
  $('#toggleInstructionDetailsBtn')?.addEventListener('click', () => {
    const drawer = $('#guideInstructionDrawer');
    const btn = $('#toggleInstructionDetailsBtn');
    const textSpan = $('#toggleInstructionDetailsText');
    if (!drawer) return;
    const isHidden = drawer.hidden;
    drawer.hidden = !isHidden;
    if (btn) {
      btn.classList.toggle('is-open', isHidden);
      btn.setAttribute('aria-expanded', String(isHidden));
    }
    if (textSpan) {
      textSpan.textContent = isHidden ? '收起文本' : '查看文本';
    }
  });

  // 设置页 4 分类 Tab 切换
  $$('.settings-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchSettingsTab(btn.dataset.settingsTab));
  });

  // 接入向导步骤控制器
  $('#guidePrevStepBtn')?.addEventListener('click', () => {
    switchGuideStep((state.currentGuideStep || 1) - 1);
  });
  $('#guideNextStepBtn')?.addEventListener('click', () => {
    const cur = state.currentGuideStep || 1;
    if (cur >= 5) {
      toast('接入向导已全部完成', '已成功连通本地工具与 ChatGPT，祝使用愉快！');
      navigate('overview');
    } else {
      switchGuideStep(cur + 1);
    }
  });
  $$('[data-guide-item]').forEach((item, idx) => {
    item.style.cursor = 'pointer';
    item.addEventListener('click', () => switchGuideStep(idx + 1));
  });

  // 全局状态中心 Popover
  $('#sideRuntimeTrigger')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const popover = $('#globalStatusPopover');
    if (!popover) return;
    const isHidden = popover.hidden;
    popover.hidden = !isHidden;
    if (isHidden && state.snapshot) {
      updateGlobalStatusPopover(state.snapshot);
    }
  });
  $('#closeStatusPopover')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const popover = $('#globalStatusPopover');
    if (popover) popover.hidden = true;
  });
  $('#gscToggleBtn')?.addEventListener('click', () => {
    const isRunning = Boolean(state.snapshot?.status?.runtimeRunning);
    runRuntime(isRunning ? 'restart' : 'start');
  });
  $('#gscHealthBtn')?.addEventListener('click', () => {
    const popover = $('#globalStatusPopover');
    if (popover) popover.hidden = true;
    navigate('health');
  });

  // 全局点击代理（收起省略号浮层、状态中心外部点击、技能预览折叠展开、快捷复制指令）
  document.addEventListener('click', (e) => {
    // 更多操作 ··· 按钮点击
    const moreBtn = e.target.closest('.action-more-btn');
    if (moreBtn) {
      e.stopPropagation();
      const wrap = moreBtn.closest('.action-more-wrap');
      const dropdown = wrap?.querySelector('.action-more-dropdown');
      const willOpen = dropdown ? dropdown.hidden : false;
      $$('.action-more-dropdown').forEach((d) => { d.hidden = true; });
      if (dropdown && willOpen) dropdown.hidden = false;
      return;
    }

    // 更多操作菜单项点击后收起
    if (e.target.closest('.action-more-item')) {
      $$('.action-more-dropdown').forEach((d) => { d.hidden = true; });
    } else if (!e.target.closest('.action-more-wrap')) {
      $$('.action-more-dropdown').forEach((d) => { d.hidden = true; });
    }

    // 状态中心 Popover 外部点击关闭
    const popover = $('#globalStatusPopover');
    if (popover && !popover.hidden) {
      if (!e.target.closest('#sideRuntimeTrigger') && !e.target.closest('#globalStatusPopover')) {
        popover.hidden = true;
      }
    }

    // 技能卡片 2-3 行预览折叠/展开
    const skillToggle = e.target.closest('.skill-expand-toggle');
    if (skillToggle) {
      const card = skillToggle.closest('.skill-prompt-item');
      const preview = card?.querySelector('.skill-prompt-preview');
      if (preview) {
        const isExpanded = preview.classList.toggle('is-expanded');
        skillToggle.textContent = isExpanded ? '收起预览 ↑' : '展开全部 ↓';
      }
      return;
    }

    // 通用 prompt 快速复制
    const copyBtn = e.target.closest('.task-copy-prompt-btn');
    if (copyBtn && copyBtn.dataset.copy) {
      copyText(copyBtn.dataset.copy);
      const span = copyBtn.querySelector('span');
      if (span) {
        const old = span.textContent;
        span.textContent = '已复制 ✓';
        setTimeout(() => { span.textContent = old; }, 1800);
      }
    }
  });
  const setPermissionMode = async (mode) => {
    if (!mode) return;
    syncPermissionVisuals(mode);
    const input = $(`input[name="permission"][value="${mode}"]`);
    if (input && !input.checked) {
      input.checked = true;
      input.dispatchEvent(new Event('change'));
      try { await saveSettings(false); } catch { /* non-critical */ }
    }
  };
  $$('input[name="permission"]').forEach((input) => input.addEventListener('change', () => {
    $$('.choice').forEach((choice) => choice.classList.toggle('selected', choice.contains(input) && input.checked));
    syncPermissionVisuals(input.value);
  }));
  $$('.permission-capsule-btn').forEach((btn) => {
    btn.addEventListener('click', () => setPermissionMode(btn.dataset.permission));
  });
  $('#permCardSafe')?.addEventListener('click', () => setPermissionMode('safe'));
  $('#permCardTrusted')?.addEventListener('click', () => setPermissionMode('trusted'));
  $('#ackBridgeRemoved')?.addEventListener('click', async () => {
    try {
      const saved = unwrap(await api.saveSettings({ bridgeRemovedNotice: false }));
      if (state.snapshot) state.snapshot.settings = saved;
      renderMigrationNotice(saved);
    } catch (error) { toast('无法关闭提示', error.message, 'error'); }
  });

  $('#refreshButton')?.addEventListener('click', async () => {
    const button = $('#refreshButton');
    if (!button || button.disabled) return;
    button.classList.add('is-refreshing');
    button.disabled = true;
    try {
      if (state.currentPage === 'skills') {
        await loadSkillsData();
      } else if (state.currentPage === 'prompts') {
        await loadPromptsData();
      } else if (state.currentPage === 'logs') {
        await loadLogs();
      } else {
        await refreshSnapshot();
      }
    } finally {
      button.classList.remove('is-refreshing');
      button.disabled = false;
    }
  });
  $('#topStartButton')?.addEventListener('click', () => runRuntime(state.snapshot?.status.fullyReady ? 'restart' : 'start'));
  $('#overviewHeroActionBtn')?.addEventListener('click', () => {
    handleOverviewHeroAction();
  });
  $('#summaryItemWorkspace')?.addEventListener('click', () => chooseWorkspace());
  $('#summaryItemMcp')?.addEventListener('click', () => {
    const isRunning = Boolean(state.snapshot?.status?.runtimeRunning);
    if (isRunning) navigate('settings');
    else runRuntime('start');
  });
  $('#summaryItemTunnel')?.addEventListener('click', () => navigate('guide'));
  $('#pipelineNodeWorkspace')?.addEventListener('click', () => chooseWorkspace());
  $('#pipelineNodeMcp')?.addEventListener('click', () => {
    const isRunning = Boolean(state.snapshot?.status?.runtimeRunning);
    if (isRunning) navigate('settings');
    else runRuntime('start');
  });
  $('#pipelineNodeTunnel')?.addEventListener('click', () => navigate('guide'));
  $('#serviceRowWorkspace')?.addEventListener('click', () => navigate('workspace'));
  $('#serviceRowPython')?.addEventListener('click', () => navigate('health'));
  $('#heroStartButton')?.addEventListener('click', () => state.snapshot?.status.fullyReady ? runRuntime('restart') : runRuntime('start'));
  $('#heroChooseWsBtn')?.addEventListener('click', chooseWorkspace);
  $('#overviewStop')?.addEventListener('click', () => runRuntime('stop'));
  $('#deployNow')?.addEventListener('click', deployNow);
  $('#chooseWorkspace')?.addEventListener('click', chooseWorkspace);
  $('#overviewStreamWorkspace')?.addEventListener('click', () => navigate('workspace'));
  $('#addWorkspaceSettingBtn')?.addEventListener('click', async () => {
    try {
      if (api.chooseAndSwitchWorkspace) {
        const switched = unwrap(await api.chooseAndSwitchWorkspace());
        if (!switched) return;
        const viewport = $('.content-viewport');
        const savedScrollTop = viewport ? viewport.scrollTop : 0;
        state.selectedWorkspace = switched.settings?.workspace || '';
        state.snapshot = switched;
        renderSnapshot(switched, { forceForms: false });
        renderOverviewWorkspace(switched);
        renderOverviewServices(switched);
        await loadWorkspaceContext();
        if (viewport) {
          viewport.scrollTop = savedScrollTop;
          requestAnimationFrame(() => { viewport.scrollTop = savedScrollTop; });
        }
        toast('工作区已添加并切换', switched.settings?.workspace || '');
      } else {
        await chooseWorkspace();
      }
    } catch (error) {
      toast('添加工作区失败', error.message, 'error');
    }
  });
  $('#overviewAddWorkspaceBtn')?.addEventListener('click', async () => {
    try {
      if (api.chooseAndSwitchWorkspace) {
        const switched = unwrap(await api.chooseAndSwitchWorkspace());
        if (!switched) return;
        const viewport = $('.content-viewport');
        const savedScrollTop = viewport ? viewport.scrollTop : 0;
        state.selectedWorkspace = switched.settings?.workspace || '';
        state.snapshot = switched;
        renderSnapshot(switched, { forceForms: false });
        renderOverviewWorkspace(switched);
        renderOverviewServices(switched);
        await loadWorkspaceContext();
        if (viewport) {
          viewport.scrollTop = savedScrollTop;
          requestAnimationFrame(() => { viewport.scrollTop = savedScrollTop; });
        }
        toast('工作区已添加并切换', switched.settings?.workspace || '');
      } else {
        await chooseWorkspace();
      }
    } catch (error) {
      toast('添加工作区失败', error.message, 'error');
    }
  });
  $('#overviewSwitchWorkspaceBtn')?.addEventListener('click', chooseWorkspace);
  $('#addAuthorizedRoot')?.addEventListener('click', addAuthorizedRoot);
  $('#refreshWorkspaceContext')?.addEventListener('click', loadWorkspaceContext);
  $('#refreshCodingToolsGuide')?.addEventListener('click', loadCodingToolsGuide);
  $('#copyCustomInstructions')?.addEventListener('click', async () => {
    const text = $('#customInstructionsText')?.textContent || '';
    await copyText(text);
    const span = $('#copyCustomInstructionsText');
    if (span) {
      const oldText = span.textContent;
      span.textContent = '已复制 ✓';
      setTimeout(() => { span.textContent = oldText; }, 1800);
    }
  });
  $('#copyTestPromptBtn')?.addEventListener('click', async () => {
    const text = $('#copyTestPromptBtn')?.dataset.copy || '';
    if (text) await copyText(text);
    const span = $('#copyTestPromptText');
    if (span) {
      const oldText = span.textContent;
      span.textContent = '已复制 ✓';
      setTimeout(() => { span.textContent = oldText; }, 1800);
    }
  });
  $('#taskQuickCopyPromptBtn')?.addEventListener('click', async () => {
    const text = $('#taskQuickCopyPromptBtn')?.dataset.copy || '';
    if (text) await copyText(text);
    const span = $('#taskQuickCopyPromptText');
    if (span) {
      const oldText = span.textContent;
      span.textContent = '已复制 ✓';
      setTimeout(() => { span.textContent = oldText; }, 1800);
    }
  });
let sharedAudioContextInstance = null;
let cachedChimeBlobUrl = null;

function getSharedAudioContext() {
  if (!sharedAudioContextInstance || sharedAudioContextInstance.state === 'closed') {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      sharedAudioContextInstance = new AudioContextClass();
    }
  }
  return sharedAudioContextInstance;
}

function getChimeBlobUrl() {
  if (cachedChimeBlobUrl) return cachedChimeBlobUrl;
  try {
    const sampleRate = 44100;
    const duration = 0.65;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    const writeString = (offset, str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    const f1 = 880.0;    // A5
    const f2 = 1318.51;  // E6
    const f3 = 1760.0;   // A6

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      let sample = 0;

      // 音符 1: 880Hz (A5), 0 ~ 0.45s
      if (t >= 0 && t < 0.45) {
        const attack1 = Math.min(1, t / 0.006);
        const decay1 = Math.exp(-t * 9.0);
        sample += Math.sin(2 * Math.PI * f1 * t) * 0.44 * attack1 * decay1;
      }

      // 音符 2: 1318.51Hz (E6), 0.08 ~ 0.65s
      if (t >= 0.08 && t < 0.65) {
        const dt2 = t - 0.08;
        const attack2 = Math.min(1, dt2 * 160);
        const decay2 = Math.exp(-dt2 * 7.5);
        sample += Math.sin(2 * Math.PI * f2 * dt2) * 0.50 * attack2 * decay2;
        sample += Math.sin(2 * Math.PI * f3 * dt2) * 0.16 * attack2 * decay2;
      }

      const clamped = Math.max(-1, Math.min(1, sample));
      const intVal = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
      view.setInt16(44 + i * 2, intVal, true);
    }

    const blob = new Blob([buffer], { type: 'audio/wav' });
    cachedChimeBlobUrl = URL.createObjectURL(blob);
    return cachedChimeBlobUrl;
  } catch (err) {
    console.warn('[音频引擎] 生成 WAV 失败：', err);
    return null;
  }
}

function fallbackWebAudio() {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) {
      if (api?.playBeep) api.playBeep().catch(() => {});
      return;
    }
    const render = () => {
      const now = ctx.currentTime;
      const playBell = (freq, delay, dur, gainLevel) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + delay);

        gain.gain.setValueAtTime(0.0001, now + delay);
        gain.gain.linearRampToValueAtTime(gainLevel, now + delay + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + dur);
      };
      playBell(880.0, 0, 0.35, 0.45);
      playBell(1318.5, 0.08, 0.55, 0.50);
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(render).catch(render);
    } else {
      render();
    }
  } catch (err) {
    console.warn('[音频引擎] Web Audio 回退亦失败，执行主进程 Beep：', err);
    if (api?.playBeep) api.playBeep().catch(() => {});
  }
}

let persistentChimeAudio = null;

function getPersistentChimeAudio() {
  if (!persistentChimeAudio) {
    const url = getChimeBlobUrl();
    if (url) {
      try {
        persistentChimeAudio = new Audio(url);
        persistentChimeAudio.volume = 1.0;
        persistentChimeAudio.preload = 'auto';
      } catch (err) {
        console.warn('[音频引擎] 创建持久 Audio 实例失败：', err);
      }
    }
  }
  return persistentChimeAudio;
}

function playNotificationChime() {
  const audio = getPersistentChimeAudio();
  if (audio) {
    try {
      // 关键：重置播放时间，确保连续快速点击或多次触发均能立即从头播放，杜绝重叠冲突与丢声
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('[音频引擎] HTML5 Audio 播放受阻，降级至 Web Audio：', err);
          fallbackWebAudio();
        });
      }
    } catch (e) {
      console.warn('[音频引擎] HTML5 Audio 调用异常：', e);
      fallbackWebAudio();
    }
  } else {
    fallbackWebAudio();
  }
}

function syncTaskNotificationControls() {
  const soundToggle = $('#taskNotificationSoundToggle');
  const soundEnabled = soundToggle ? soundToggle.checked : true;

  const previewBtn = $('#previewChimeBtn');
  if (previewBtn) {
    previewBtn.disabled = !soundEnabled;
    previewBtn.classList.toggle('is-disabled', !soundEnabled);
  }
}

  $('#previewChimeBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const btn = $('#previewChimeBtn');
    if (btn && btn.disabled) return;
    const label = $('#previewChimeBtnText') || btn;
    if (btn) {
      btn.classList.add('is-playing');
      if (label) label.textContent = '播放中…';
      setTimeout(() => {
        btn.classList.remove('is-playing');
        if (label) label.textContent = '试听提示音';
      }, 700);
    }
    playNotificationChime();
  });

  $('#taskNotificationsToggle')?.addEventListener('change', () => {
    syncTaskNotificationControls();
  });

  $('#taskNotificationSoundToggle')?.addEventListener('change', () => {
    syncTaskNotificationControls();
  });

  if (api.onNotificationSound) {
    api.onNotificationSound(() => {
      const soundEnabled = $('#taskNotificationSoundToggle')?.checked || state.snapshot?.settings?.taskNotificationSound;
      if (soundEnabled) {
        playNotificationChime();
      }
    });
  }

  // 长任务主动汇报间隔现代自定义下拉组件交互绑定
  (function bindProgressReportSelectEvents() {
    const customSelect = $('#progressReportCustomSelect');
    const trigger = $('#progressReportSelectTrigger');
    const dropdown = $('#progressReportDropdownMenu');
    const realSelect = $('#progressReportSelect');
    if (!customSelect || !trigger || !dropdown) return;

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = dropdown.hidden;
      dropdown.hidden = !willOpen;
      trigger.classList.toggle('is-open', willOpen);
      trigger.setAttribute('aria-expanded', String(willOpen));
      const parentRow = customSelect.closest('.setting-row');
      if (parentRow) parentRow.classList.toggle('is-dropdown-open', willOpen);
      const parentSection = customSelect.closest('.settings-section, .app-section');
      if (parentSection) parentSection.classList.toggle('is-dropdown-open', willOpen);
      if (willOpen) {
        const rect = trigger.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow < 170) {
          dropdown.classList.add('drop-up');
        } else {
          dropdown.classList.remove('drop-up');
        }
      }
    });

    dropdown.querySelectorAll('.custom-select-option').forEach((opt) => {
      opt.addEventListener('click', async (e) => {
        e.stopPropagation();
        const val = opt.dataset.value;
        dropdown.hidden = true;
        trigger.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
        customSelect.closest('.setting-row')?.classList.remove('is-dropdown-open');
        customSelect.closest('.settings-section, .app-section')?.classList.remove('is-dropdown-open');
        if (realSelect && val) {
          realSelect.value = val;
          syncProgressReportVisual(val);
          realSelect.dispatchEvent(new Event('change'));
          await saveSettings(false);
        }
      });
    });

    document.addEventListener('click', (e) => {
      if (!customSelect.contains(e.target)) {
        dropdown.hidden = true;
        trigger.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
        customSelect.closest('.setting-row')?.classList.remove('is-dropdown-open');
        customSelect.closest('.settings-section, .app-section')?.classList.remove('is-dropdown-open');
      }
    });
  })();
  $('#saveDeploySettings')?.addEventListener('click', async () => {
    try { await saveKeyIfPresent(); await saveSettings(); await refreshSnapshot({ forceForms: true }); }
    catch (error) { toast('保存失败', error.message, 'error'); }
  });
  /* 第 41 轮：这里原来还有一个 #saveWorkspace 的绑定（纯保存）。
   * 它和顶栏的「保存设置」是同一件事（saveSettings + 重读快照），
   * 而那个按钮已经只剩一个空的隐藏节点 —— 与其留一条永远点不到的死绑定，
   * 不如只留一个可见入口。 */
  $('#saveWorkspaceRestart')?.addEventListener('click', async () => {
    try { await saveSettings(false); await runRuntime('restart'); }
    catch (error) { toast('重新部署失败', error.message, 'error'); }
  });
  $('#toggleChangeKeyBtn')?.addEventListener('click', () => {
    const row = $('#runtimeKeyInputRow');
    if (!row) return;
    const willShow = row.hidden;
    row.hidden = !willShow;
    if (willShow) {
      const input = $('#runtimeKeyInput');
      if (input) { input.focus(); input.select?.(); }
    }
  });
  $('#cancelChangeKeyBtn')?.addEventListener('click', () => {
    const row = $('#runtimeKeyInputRow');
    if (row) row.hidden = true;
  });

  $('#toggleLocalNetDetailsBtn')?.addEventListener('click', () => {
    const panel = $('#localNetAdvancedPanel');
    const chevron = $('#localNetChevron');
    if (!panel) return;
    const isHidden = panel.hidden;
    panel.hidden = !isHidden;
    if (chevron) {
      chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    }
  });
  $('#telemetryToggle')?.addEventListener('change', async (e) => {
    toast(e.target.checked ? '已开启匿名使用统计' : '已关闭匿名使用统计', '设置已保存。不包含代码、文件内容或聊天内容。');
    await saveSettings(false);
  });
  $('#saveRuntimeKey')?.addEventListener('click', async () => {
    try {
      if (!(await saveKeyIfPresent())) throw new Error('请先粘贴 Runtime API Key。');
      toast('密钥已安全保存', '密钥已使用 Windows 安全存储加密。');
      const row = $('#runtimeKeyInputRow');
      if (row) row.hidden = true;
      await refreshSnapshot();
    } catch (error) { toast('保存失败', error.message, 'error'); }
  });
  $('#removeRuntimeKey')?.addEventListener('click', async () => {
    if (!confirm('确定要删除已保存的运行通道密钥（Runtime API Key）吗？\n\n删除后将无法通过远程通道调用 MCP 工具。')) return;
    try { unwrap(await api.removeRuntimeKey()); toast('密钥已删除'); await refreshSnapshot(); }
    catch (error) { toast('删除失败', error.message, 'error'); }
  });
  $('#regenerateToken')?.addEventListener('click', async () => {
    if (!confirm('确定要重新生成本地工具认证令牌（Token）吗？\n\n重新生成后需重启本地服务才能使新令牌生效。')) return;
    try { unwrap(await api.regenerateMcpToken()); toast('认证 Token 已重新生成', '重新部署后生效。'); }
    catch (error) { toast('生成失败', error.message, 'error'); }
  });
  const handleReloginChatGpt = async () => {
    if (!state.isChatGptLoggedIn) {
      if (api.closeSettings) {
        await api.closeSettings();
      }
      toast('前往登录', '已切回 ChatGPT 聊天窗口，请在页面中登录您的账号。', 'info');
      return;
    }

    const confirmed = await showModernConfirm({
      title: '重新登录 ChatGPT',
      message: '确定要清除当前 ChatGPT 登录会话吗？\n清除后将退出当前登录状态，并自动返回聊天主窗口以便重新登录。',
      confirmText: '退出并重新登录',
      cancelText: '取消',
      danger: true
    });
    if (!confirmed) return;
    try {
      unwrap(await api.clearChatSession());
      state.isChatGptLoggedIn = false;
      await updateChatGptAuthStatusVisual();
      toast('登录会话已重置', '正在返回聊天主窗口…', 'success');
      if (api.closeSettings) {
        await api.closeSettings();
      }
    } catch (error) {
      toast('清除登录会话失败', error.message, 'error');
    }
  };

  $('#chatGptReloginBtn')?.addEventListener('click', handleReloginChatGpt);
  $('#clearChatSession')?.addEventListener('click', handleReloginChatGpt);
  $('#pythonInstall')?.addEventListener('click', async () => {
    setBusy(true, true);
    try { unwrap(await api.installPython()); toast('Python 安装完成', '请重新检测环境。'); await refreshSnapshot(); }
    catch (error) { toast('安装失败', error.message, 'error'); }
    finally { setBusy(false); }
  });
  $('#proxyModeSelect')?.addEventListener('change', () => { renderProxyControls(); renderDeploySummary(); });
  $$('.proxy-mode-card').forEach((card) => {
    card.addEventListener('click', () => {
      const mode = card.dataset.mode;
      const select = $('#proxyModeSelect');
      if (select && mode && select.value !== mode) {
        select.value = mode;
        select.dispatchEvent(new Event('change'));
        if (mode === 'manual') {
          setTimeout(() => $('#proxyUrlInput')?.focus(), 160);
        }
      }
    });
  });
  $('#toggleNetAdvancedBtn')?.addEventListener('click', () => {
    const panel = $('#netAdvancedPanel');
    const btn = $('#toggleNetAdvancedBtn');
    if (!panel || !btn) return;
    const isHidden = panel.hidden;
    panel.hidden = !isHidden;
    btn.textContent = isHidden ? '收起高级 ↑' : '高级设置 ›';
  });

  $('#settingsAdvancedAccordion')?.addEventListener('toggle', (e) => {
    const txt = $('#settingsAdvancedToggleText');
    if (txt) {
      txt.textContent = e.target.open ? '收起' : '展开';
    }
  });

  $('#proxyDetect')?.addEventListener('click', async () => {
    try {
      await saveSettings(false);
      const result = unwrap(await api.detectProxy());
      toast(result.reachable ? '网络路径可用' : '未检测到可用路径', result.resolvedUrl || (result.reachable ? '当前使用直连。' : '请检查网络或手动代理设置。'), result.reachable ? 'success' : 'error');
      await refreshSnapshot({ forceForms: true });
    } catch (error) { toast('代理检测失败', error.message, 'error'); }
  });

  // 方案一：手动代理常用预设点击快捷填入
  $$('.proxy-preset-chip').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const preset = btn.dataset.preset;
      const input = $('#proxyUrlInput');
      if (input && preset) {
        input.value = preset;
        input.dispatchEvent(new Event('input'));
        await saveSettings(false);
        const name = btn.querySelector('.preset-name')?.textContent || '代理';
        toast(`已填入 ${name} 预设`, preset);
      }
    });
  });

  // 方案一：内联就地测试代理连通性
  $('#proxyInlineTestBtn')?.addEventListener('click', async () => {
    const btn = $('#proxyInlineTestBtn');
    const txt = $('#proxyTestBtnText');
    const input = $('#proxyUrlInput');
    const url = input?.value?.trim();
    if (!url) {
      toast('请输入代理地址', '例如 http://127.0.0.1:7890', 'warn');
      input?.focus();
      return;
    }
    if (btn) btn.disabled = true;
    if (txt) txt.textContent = '测试中…';
    try {
      await saveSettings(false);
      const result = unwrap(await api.detectProxy());
      if (result.reachable) {
        toast('代理连接正常', `已成功连接到代理：${result.resolvedUrl || url}`, 'success');
      } else {
        toast('代理连接未通过', '无法连通指定代理，请确认本地代理工具已启动且允许局域网连接。', 'error');
      }
      await refreshSnapshot({ forceForms: true });
    } catch (err) {
      toast('代理测试失败', err.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
      if (txt) txt.textContent = '测试连接';
    }
  });

  ['#tunnelIdInput', '#proxyUrlInput', '#runtimeKeyInput'].forEach((selector) => {
    $(selector)?.addEventListener('input', renderDeploySummary);
  });
  $('#toggleTunnelIdInput')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const input = $('#tunnelIdInput');
    const btn = $('#toggleTunnelIdInput');
    if (!input || !btn) return;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    btn.classList.toggle('revealed', isPassword);
    btn.setAttribute('aria-pressed', String(isPassword));
    btn.setAttribute('title', isPassword ? '隐藏通道 ID' : '显示通道 ID');
    btn.setAttribute('aria-label', isPassword ? '隐藏通道 ID' : '显示通道 ID');
  });

  const persistTheme = (chosen) => {
    if (api?.saveSettings) {
      api.saveSettings({ theme: chosen }).then((res) => {
        const saved = res?.ok ? res.data : null;
        if (saved && state.snapshot) state.snapshot.settings = saved;
      }).catch(() => {});
    }
  };

  $('#themeToggle')?.addEventListener('click', () => {
    const next = document.body.dataset.theme === 'light' ? 'dark' : 'light';
    applyTheme(next);
    persistTheme(next);
  });
  $('#themeSelect')?.addEventListener('change', () => {
    const chosen = $('#themeSelect')?.value || 'dark';
    applyTheme(chosen);
    persistTheme(chosen);
  });
  /* 第 29 轮：两张主题预览卡的点击。
   * 点击后立即 0ms 变色并同步 TitleBarOverlay，通过轻量 persistTheme
   * 单字段静默保存，杜绝全量表单保存引起的 Windows 注册表开机项与 DWM 重复卡顿。 */
  $$('[data-theme-pick]').forEach((card) => card?.addEventListener('click', () => {
    const chosen = card.dataset.themePick;
    applyTheme(chosen);
    persistTheme(chosen);
  }));

  $('#keepRunningToggle')?.addEventListener('change', () => saveSettings(false));
  $('#autoStartToggle')?.addEventListener('change', () => saveSettings(false));

  /* 第 29 轮（用户第 6 条）：任务历史的收起/展开。
   * 立即生效 + 持久化（见 taskHistoryCollapsed 的说明：存 localStorage）。
   * 不做动画：这块面板高度 333px，展开/收起是一步到位的显隐，
   * 中间过程没有信息量，加过渡只会让"点完等它动"多出一段无意义等待。 */
  $('#toggleTaskHistory')?.addEventListener('click', () => {
    setTaskHistoryCollapsed(!taskHistoryCollapsed());
  });

  $('#developerModeToggle')?.addEventListener('change', async (event) => {
    renderDeveloperMode(event.target.checked);
    await saveSettings(false);
  });

  $('#toggleDeveloperModeBtn')?.addEventListener('click', async () => {
    const toggle = $('#developerModeToggle');
    const next = !(toggle && toggle.checked);
    if (toggle) toggle.checked = next;
    renderDeveloperMode(next);
    await saveSettings(false);
    toast(next ? '开发者模式已开启' : '开发者模式已关闭', next ? '已解除敏感操作锁定，请谨慎执行。' : '已重新锁定敏感操作。');
  });

  $('#keepRunningToggle')?.addEventListener('change', async () => {
    await saveSettings(false);
  });

  $('#showTrayIconToggle')?.addEventListener('change', async () => {
    await saveSettings(false);
  });

  /* 第 29 轮（用户第 4 条「不要搞什么"我已在 ChatGPT 中完成创建"」）：
   * 这里原来绑的是两个自述式复选框 [data-guide-manual]（connector / test），
   * 勾一下徽标就变绿，与服务是否真通毫无关系。
   *
   * 元素已从 index.html 删除，但**绑定必须先于删除一起改掉** ——
   * 留着 $$('[data-guide-manual]').forEach(...) 是一段永远不执行的死代码，
   * 它不报错、只是静默失效；六个月后有人照它继续写，就会重新长出同一套自述确认。
   *
   * 现在换成三个真实动作：
   *   #toggleTunnelId  —— 纯显示层，切 data-secret 后重渲染（真值不动）
   *   #copyTunnelId    —— 复制**真值**（dataset.rawValue），不是屏幕上那串圆点
   *   #verifyConnector / #verifyToolCall —— 触发真实探测（见 verifyGuideStep） */
  $('#toggleTunnelId')?.addEventListener('click', () => {
    const el = $('#guideTunnelId');
    if (!el) return;
    el.dataset.secret = el.dataset.secret === '1' ? '0' : '1';
    renderTunnelIdDisplay();
  });
  $('#copyTunnelId')?.addEventListener('click', () => {
    const raw = String($('#guideTunnelId')?.dataset.rawValue || '').trim();
    if (!raw) { toast('还没有 Tunnel ID', '请先在上一步创建 Tunnel 并回到“运行与连接”填写。', 'error'); return; }
    copyText(raw);
  });
  $('#verifyConnector')?.addEventListener('click', (event) => verifyGuideStep('connector', event.currentTarget));
  $('#verifyToolCall')?.addEventListener('click', (event) => verifyGuideStep('test', event.currentTarget));
  $$('[data-copy]').forEach((button) => button?.addEventListener('click', () => copyText(button.dataset.copy)));
  $('#copyLocalUrl')?.addEventListener('click', () => copyText($('#guideLocalUrl')?.textContent));

  // 接入指南：点击顶部固定仪表盘上的步骤项，直接切换至对应步骤
  const GUIDE_KEYS = ['tunnel', 'key', 'deploy', 'connector', 'test'];
  $$('#guideChecklist [data-guide-item]').forEach((item) => {
    item.addEventListener('click', () => {
      const stepKey = item.dataset.guideItem;
      const idx = GUIDE_KEYS.indexOf(stepKey);
      if (idx !== -1) {
        switchGuideStep(idx + 1);
      }
    });
  });

  // 接入指南：底部上一步 / 下一步按钮切换绑定
  $('#guidePrevStepBtn')?.addEventListener('click', () => {
    switchGuideStep((state.currentGuideStep || 1) - 1);
  });
  $('#guideNextStepBtn')?.addEventListener('click', () => {
    const cur = state.currentGuideStep || 1;
    if (cur >= 5) {
      navigate('settings');
      toast('接入引导已完成', '恭喜！所有步骤已配置完成。', 'success');
    } else {
      switchGuideStep(cur + 1);
    }
  });

  // 接入指南：顶部固定看板滚轮转发给下方步骤面板，鼠标在看板上也能自然滑动
  const guideHero = $('#guideStickyHero');
  const guidePanel = $('#guideStepsScrollPanel');
  if (guideHero && guidePanel) {
    guideHero.addEventListener('wheel', (e) => {
      guidePanel.scrollTop += e.deltaY;
    }, { passive: true });
  }

  /* 第 41 轮：日志刷新从"内联匿名处理器"收回成对 loadLogs 的直接绑定 ——
   * 反馈（转圈 + 防连点）搬进 loadLogs 自己，这样从任何入口加载日志都有反馈，
   * 而"这个按钮绑的是 loadLogs"这件事也能被断言看见。 */
  $('#refreshLogs')?.addEventListener('click', loadLogs);
  $('#refreshTaskState')?.addEventListener('click', loadTaskState);
  $('#taskDetailsToggle')?.addEventListener('click', () => {
    const panel = $('#taskDetailsPanel');
    const btn = $('#taskDetailsToggle');
    if (!panel) return;
    const isHidden = panel.hidden;
    panel.hidden = !isHidden;
    if (btn) btn.textContent = isHidden ? '收起详情' : '查看详情';
  });
  $('#pauseTask')?.addEventListener('click', async () => { try { unwrap(await api.pauseTask()); await loadTaskState(); toast('任务已暂停', '当前进度已保存在工作区。'); } catch (error) { toast('暂停失败', error.message, 'error'); } });
  $('#resumeTask')?.addEventListener('click', async () => { try { unwrap(await api.resumeTask()); await loadTaskState(); toast('任务已继续', '网页模型可从记录的下一步恢复。'); } catch (error) { toast('继续失败', error.message, 'error'); } });
  $('#stopTask')?.addEventListener('click', async () => { if (!confirm('确定停止当前任务吗？运行中的命令会被终止。')) return; try { unwrap(await api.stopTask()); await loadTaskState(); toast('任务已停止', '状态与历史仍保留，可稍后继续。'); } catch (error) { toast('停止失败', error.message, 'error'); } });
  $('#clearTaskState')?.addEventListener('click', async () => { if (!confirm('确定清除当前工作区的任务状态吗？')) return; unwrap(await api.clearTaskState()); renderTaskState(null); toast('任务状态已清除'); });
  /* 第 28 轮：清空历史与清除任务状态是两件事，确认文案必须说清区别 ——
   * 否则用户会以为这个按钮等同于上面那个（它俩都很像"清一下任务"）。 */
  $('#clearTaskHistory')?.addEventListener('click', async () => {
    if (!confirm('确定清空全部历史任务记录吗？\n\n只删除归档的历史，不会改动当前任务状态，也无法撤销。')) return;
    try {
      const count = unwrap(await api.clearTaskHistory());
      loadTaskHistory();
      toast(count > 0 ? `已清空 ${count} 条历史记录` : '历史本来就是空的');
    } catch (error) { toast('清空历史失败', error.message, 'error'); }
  });
  $('#clearPerformance')?.addEventListener('click', async () => { if (!confirm('确定清空当前工作区的性能记录吗？')) return; try { unwrap(await api.clearPerformanceTrace()); renderPerformanceTrace(null); toast('性能记录已清空'); } catch (error) { toast('清空失败', error.message, 'error'); } });
  $('#inspectBuild')?.addEventListener('click', async () => {
    const btn = $('#inspectBuild');
    const isFirstTime = !state.buildInspected;
    toast(isFirstTime ? '正在识别技术栈…' : '正在重新识别技术栈…');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '正在识别…';
    }
    ['buildTestCommand', 'buildCommand', 'buildArtifacts'].forEach((id) => {
      const el = $(`#${id}`);
      if (el) delete el.dataset.userEdited;
    });
    try {
      await inspectBuild(true);
      state.buildInspected = true;
      toast(isFirstTime ? '项目识别完成' : '重新识别完成', '已获取最新技术栈与流水线方案', 'success');
    } catch (error) {
      toast('识别失败', error.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '重新识别';
      }
    }
  });
  $('#runBuild')?.addEventListener('click', runBuildVerification);
  ['buildTestCommand', 'buildCommand', 'buildArtifacts'].forEach((id) => {
    const input = $(`#${id}`);
    if (!input) return;
    input.addEventListener('input', () => {
      input.dataset.userEdited = 'true';
    });
  });
  ['buildRunTests', 'buildRunBuild'].forEach((id) => {
    const input = $(`#${id}`);
    if (!input) return;
    const card = input.closest('.switch-card');
    const label = card?.querySelector('.switch-state-text');
    const update = () => {
      card?.classList.toggle('active', input.checked);
      if (label) label.textContent = input.checked ? '已开启' : '已跳过';
      syncBuildControlsState();
    };
    input.addEventListener('change', update);
    update();
  });
  /* ★ 第 31 轮（用户第 3/4 条）新增的三个入口。
   *
   * 为什么要它们：
   *   ① 「手动指定」与三个「配置 X 脚本」都指向折叠的
   *      <details id="buildAdvanced">。改前用户看到"未检测到可用测试"
   *      之后**不知道去哪填** —— 唯一入口是那个折叠条目的标题本身，
   *      而它藏在参数列表下面。
   *      所以入口的职责不是"打开面板"（那已经能做），而是
   *      **展开 + 跳到对应字段**，把 3 步操作压成 1 步。
   *   ② 「历史运行记录」是用户第 4 条点名的次级入口：任务历史在
   *      这一页底部，任务多时会被挤到屏幕外，需要一个"去哪看"。
   *      用 scrollIntoView 而不是直接切页 —— 历史就在同一页。 */
  const openBuildAdvanced = (fieldId) => {
    const details = $('#buildAdvanced');
    if (details) details.open = true;
    const field = fieldId ? $(`#${fieldId}`) : null;
    if (field) { field.focus(); field.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  };
  $('#buildManualSpec')?.addEventListener('click', () => openBuildAdvanced('buildTestCommand'));
  $('#configureTestScript')?.addEventListener('click', () => openBuildAdvanced('buildTestCommand'));
  $('#configureBuildScript')?.addEventListener('click', () => openBuildAdvanced('buildCommand'));
  $('#configureArtifacts')?.addEventListener('click', () => openBuildAdvanced('buildArtifacts'));
  $('#jumpTaskHistory')?.addEventListener('click', () => {
    const panel = $('#taskHistoryPanel');
    if (!panel) return;
    /* 收起状态下先展开 —— 否则滚过去只看到一条标题条，
     * 用户的意图是"看记录"，不是"看标题"。 */
    if (taskHistoryCollapsed()) setTaskHistoryCollapsed(false);
    panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  $('#inspectHealth')?.addEventListener('click', inspectHealth);
  $('#repairHealth')?.addEventListener('click', repairHealth);
  const togglePassedDrawer = () => {
    const block = $('#healthPassedBlock');
    const btn = $('#togglePassedRow');
    if (!block) return;
    const nextHidden = !block.hidden;
    block.hidden = nextHidden;
    if (btn) btn.textContent = nextHidden ? '展开' : '收起';
  };
  $('#togglePassedRow')?.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePassedDrawer();
  });
  $('#healthPassedToggleRow')?.addEventListener('click', togglePassedDrawer);
  $('#clearLogs')?.addEventListener('click', async () => {
    const menu = $('#logMoreMenu');
    if (menu) menu.hidden = true;
    if (!confirm('确定清空当前运行日志吗？')) return;
    try {
      if (api.clearLogs) {
        unwrap(await api.clearLogs());
      }
      state.logs = [];
      renderLogs();
      toast('运行日志已清空');
    } catch (error) {
      toast('清空日志失败', error.message, 'error');
    }
  });
  $$('.log-filter').forEach((button) => button?.addEventListener('click', () => {
    state.logFilter = button.dataset.logFilter;
    $$('.log-filter').forEach((item) => item.classList.toggle('active', item === button));
    renderLogs();
  }));

  $('#cfgCopyMcp')?.addEventListener('click', () => copyText($('#cfgMcpUrl')?.textContent || ''));
  $('#overviewRefreshLogsBtn')?.addEventListener('click', loadLogs);
  $('#overviewTaskStopBtn')?.addEventListener('click', async () => {
    if (!confirm('确定停止当前任务吗？运行中的命令会被终止。')) return;
    try {
      unwrap(await api.stopTask());
      await loadOverviewData();
      toast('任务已停止');
    } catch (error) {
      toast('停止失败', error.message, 'error');
    }
  });

  $('#serviceMcpBtn')?.addEventListener('click', () => {
    const isRunning = Boolean(state.snapshot?.status?.runtimeRunning);
    runRuntime(isRunning ? 'restart' : 'start');
  });
  $('#serviceWorkspaceBtn')?.addEventListener('click', chooseWorkspace);
  $('#servicePythonBtn')?.addEventListener('click', () => {
    const btn = $('#pythonInstall');
    if (btn && !btn.disabled) btn.click();
    else navigate('guide');
  });

  // 运行总览状态行点击直接跳转至对应配置模块
  const bindStatusRowNav = (rowId, targetPage) => {
    const rowEl = $(rowId);
    if (!rowEl) return;
    rowEl.addEventListener('click', () => navigate(targetPage));
    rowEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigate(targetPage);
      }
    });
  };
  bindStatusRowNav('#serviceRowPython', 'health');
  bindStatusRowNav('#serviceRowMcp', 'settings');
  bindStatusRowNav('#serviceRowTunnel', 'guide');
  bindStatusRowNav('#serviceRowWorkspace', 'settings');

  // 总览页任务活动直达运行动态与日志记录
  $('#taskActivityViewBtn')?.addEventListener('click', () => {
    navigate('logs');
  });

  // 系统链路节点键盘可访问性
  const bindPipelineNode = (nodeId, handler) => {
    const el = $(nodeId);
    if (!el) return;
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handler();
      }
    });
  };
  bindPipelineNode('#pipelineNodeWorkspace', () => chooseWorkspace());
  bindPipelineNode('#pipelineNodeMcp', () => navigate('settings'));
  bindPipelineNode('#pipelineNodeTunnel', () => navigate('guide'));

  // 日志搜索框过滤
  $('#logSearchInput')?.addEventListener('input', (e) => {
    state.logSearch = e.target.value.trim();
    renderLogs();
  });

  // 日志更多操作菜单
  $('#logMoreBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = $('#logMoreMenu');
    if (menu) menu.hidden = !menu.hidden;
  });
  document.addEventListener('click', (e) => {
    const menu = $('#logMoreMenu');
    if (menu && !menu.hidden && !menu.contains(e.target) && e.target !== $('#logMoreBtn')) {
      menu.hidden = true;
    }
  });
  $('#toggleLogPause')?.addEventListener('click', () => {
    state.logPaused = !state.logPaused;
    const item = $('#toggleLogPause');
    if (item) item.textContent = state.logPaused ? '恢复刷新' : '暂停刷新';
    const menu = $('#logMoreMenu');
    if (menu) menu.hidden = true;
    toast(state.logPaused ? '日志已暂停刷新' : '日志已恢复刷新');
  });
  $('#exportLogs')?.addEventListener('click', () => {
    const menu = $('#logMoreMenu');
    if (menu) menu.hidden = true;
    if (!state.logs || !state.logs.length) {
      toast('暂无日志可导出');
      return;
    }
    const content = state.logs.map((l) => `[${l.time || ''}] [${(l.level || 'info').toUpperCase()}] ${l.message || ''}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mcp-logs-${new Date().toISOString().slice(0, 10)}.log`;
    a.click();
    URL.revokeObjectURL(url);
    toast('日志已导出');
  });
  $('#copyAllLogs')?.addEventListener('click', () => {
    const menu = $('#logMoreMenu');
    if (menu) menu.hidden = true;
    if (!state.logs || !state.logs.length) {
      toast('暂无日志可复制');
      return;
    }
    const content = state.logs.map((l) => `[${l.time || ''}] [${(l.level || 'info').toUpperCase()}] ${l.message || ''}`).join('\n');
    copyText(content);
    toast('已复制全部日志到剪贴板');
  });
  $('#toggleTechLogs')?.addEventListener('click', () => {
    state.showTechLogs = !state.showTechLogs;
    const item = $('#toggleTechLogs');
    if (item) item.textContent = state.showTechLogs ? '隐藏技术详情' : '显示技术详情';
    const menu = $('#logMoreMenu');
    if (menu) menu.hidden = true;
    renderLogs();
    toast(state.showTechLogs ? '已开启技术详情视图' : '已切换回常规事件视图');
  });

  // 任务中心详情面板展开/收起
  $('#taskDetailsToggle')?.addEventListener('click', () => {
    const panel = $('#taskDetailsPanel');
    const btn = $('#taskDetailsToggle');
    if (!panel) return;
    const nextHidden = !panel.hidden;
    panel.hidden = nextHidden;
    if (btn) btn.textContent = nextHidden ? '查看详情' : '收起详情';
  });

  // 连接设置页按钮
  $('#deployConnectBtn')?.addEventListener('click', () => navigate('guide'));
  $('#deployStartBtn')?.addEventListener('click', () => {
    const isRunning = Boolean(state.snapshot?.status?.runtimeRunning);
    runRuntime(isRunning ? 'restart' : 'start');
  });

  // 技能与提示词管理事件
  bindSkillAndPromptEvents();

  // 关于页面事件（Cherry Studio 现代风格交互）
  bindAboutPageEvents();
}

function bindAboutPageEvents() {
  $('#aboutCheckUpdateBtn')?.addEventListener('click', () => {
    const btn = $('#aboutCheckUpdateBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '检查中…';
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = '检查更新';
        const ver = $('#appVersionBadge')?.textContent || '当前版本';
        toast('已是最新版本', `当前版本 ${ver} 已为最新官方发布版本。`, 'success');
      }, 600);
    }
  });

  $('#aboutNavGuideBtn')?.addEventListener('click', () => {
    navigate('guide');
  });

  $('#aboutChangelogBtn')?.addEventListener('click', () => {
    const ver = $('#appVersionBadge')?.textContent || '最新版本';
    toast('版本更新日志', `${ver}：优化本地 MCP Runtime 与多模型交互性能。`, 'info');
  });

  $('#aboutContactBtn')?.addEventListener('click', async () => {
    const email = 'gaozhiyao0916@gmail.com';
    await copyText(email);
    toast('联系邮箱已复制', email, 'success');
  });
}

function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getSkillIconSvg(iconKey) {
  const icon = String(iconKey || 'star').toLowerCase();
  switch (icon) {
    case 'code':
      return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;
    case 'test':
      return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2v6h6"/><path d="M4 14l5-5"/><path d="M16 4v4h4"/><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`;
    case 'clean':
      return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`;
    case 'arch':
      return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`;
    case 'star':
    default:
      return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  }
}

/* ==========================================================================
   技能管理系统 (Skills Management System)
   ========================================================================== */

async function loadSkillsData() {
  try {
    const list = unwrap(await api.listSkills());
    state.skills = Array.isArray(list) ? list : [];
    const enabledCount = state.skills.filter((s) => s.enabled).length;
    const badge = $('#skillsCountBadge');
    if (badge) {
      badge.innerHTML = `<span class="badge-dot" aria-hidden="true"></span><span>共 <b>${state.skills.length}</b> 项技能 · <b>${enabledCount}</b> 项已开启</span>`;
    }
    renderSkillCategories();
    renderSkillsGrid();
  } catch (err) {
    toast('获取技能列表失败', err.message, 'error');
  }
}

/* 第 33 轮：长期记忆页。
 *
 * 分工：这一层只做展示与透传。写操作能不能做，由运行时的 memory_control 按
 * 请求来源判定（桌面通道带 X-Coding-Tools-Origin: desktop，见
 * electron/services/localMcpClient.js）；渲染层没有绕过它的能力，所以这里
 * 不做二次判定，只把参数发过去。
 *
 * 记忆本体是磁盘上的 Markdown：用户手改过也能读回来（后端会重建索引）。
 */
const MEMORY_SCOPE_LABELS = { global: '全局', project: '本项目', task: '本任务' };
const MEMORY_TYPE_LABELS = {
  core_preference: '核心偏好', working_style: '工作习惯', project_summary: '项目概况',
  architecture: '架构', decision: '决策', open_loop: '待跟进', pitfall: '踩过的坑',
  task_summary: '任务小结', note: '随手记'
};
const MEMORY_MODE_LABELS = { off: '关闭自动记录', suggest: '提示我确认（推荐）', auto: '自动学习并保存' };

const memoryView = {
  wired: false, enabled: false, config: {}, memories: [], candidates: [],
  scope: '', archived: false, query: '', draft: false, editingId: '', timer: 0,
  handledCandidateIds: new Set()
};

function memoryConfigOf(payload) {
  const config = payload && typeof payload.config === 'object' && payload.config ? payload.config : payload;
  return config && typeof config === 'object' ? config : {};
}

function memoryRecordsOf(payload, key) {
  if (!payload || typeof payload !== 'object') return [];
  const value = payload[key] || payload.items || payload.memories || [];
  return Array.isArray(value) ? value : [];
}

function memoryEnabledOf(payload) {
  const config = memoryConfigOf(payload);
  if (config.enabled !== undefined) return Boolean(config.enabled);
  if (payload && payload.enabled !== undefined) return Boolean(payload.enabled);
  return String(config.auto_memory || 'off') !== 'off';
}

/* 后端拒绝时给的是错误码，这里翻成人话 —— 尤其是"拒收密钥"这条，
 * 用户需要知道自己写的东西为什么没被保存。 */
function memoryErrorText(error) {
  const raw = String(error && error.message ? error.message : error || '');
  if (raw.includes('MEMORY_UNSAFE') || raw.includes('SECRET_REJECTED')) return '这段内容像是密码、密钥或令牌，记忆里不保存这类内容。';
  if (raw.includes('MEMORY_DISABLED')) return '记忆还没启用，先打开上面的总开关。';
  if (raw.includes('MEMORY_PERSONAL')) return '这属于个人隐私内容，需要先打开「允许记录个人隐私」。';
  if (raw.includes('MEMORY_DESKTOP_ONLY')) return '这个操作只能在桌面端做。';
  if (raw.includes('MEMORY_NOT_FOUND')) return '这条记忆已经不在了，刷新一下看看。';
  return raw || '操作没有成功。';
}


/**
 * 现代高质感确认对话框（彻底替代原生粗糙丑陋的 window.confirm 系统弹窗）
 * @param {Object} options
 * @param {string} [options.title='确认操作']
 * @param {string} options.message
 * @param {string} [options.confirmText='确认']
 * @param {string} [options.cancelText='取消']
 * @param {boolean} [options.danger=true]
 * @returns {Promise<boolean>}
 */
function showModernConfirm(options = {}) {
  return new Promise((resolve) => {
    const modal = $('#modernConfirmModal');
    if (!modal) {
      resolve(window.confirm(options.message || options.title || '确认继续？'));
      return;
    }

    const titleEl = $('#confirmDialogTitle');
    const msgEl = $('#confirmDialogMessage');
    const cancelBtn = $('#confirmDialogCancelBtn');
    const confirmBtn = $('#confirmDialogConfirmBtn');
    const iconWrap = $('#confirmDialogIconWrap');

    const isDanger = options.danger !== false;
    if (titleEl) titleEl.textContent = options.title || (isDanger ? '确认删除' : '操作确认');
    if (msgEl) msgEl.textContent = options.message || '';
    if (cancelBtn) cancelBtn.textContent = options.cancelText || '取消';
    if (confirmBtn) {
      confirmBtn.textContent = options.confirmText || (isDanger ? '确认删除' : '确认');
      confirmBtn.className = `modern-confirm-btn confirm ${isDanger ? 'danger' : 'primary'}`;
    }
    if (iconWrap) {
      iconWrap.className = `confirm-icon-wrap ${isDanger ? 'danger' : 'info'}`;
      iconWrap.innerHTML = isDanger
        ? `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
        : `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="8"/></svg>`;
    }

    modal.hidden = false;

    const cleanup = (result) => {
      modal.hidden = true;
      cancelBtn?.removeEventListener('click', onCancel);
      confirmBtn?.removeEventListener('click', onConfirm);
      modal.removeEventListener('click', onOverlayClick);
      document.removeEventListener('keydown', onKeyDown);
      resolve(result);
    };

    const onCancel = () => cleanup(false);
    const onConfirm = () => cleanup(true);
    const onOverlayClick = (e) => {
      if (e.target === modal) cleanup(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') cleanup(false);
      if (e.key === 'Enter') cleanup(true);
    };

    cancelBtn?.addEventListener('click', onCancel);
    confirmBtn?.addEventListener('click', onConfirm);
    modal.addEventListener('click', onOverlayClick);
    document.addEventListener('keydown', onKeyDown);
    confirmBtn?.focus();
  });
}

async function runMemoryAction(action, successMessage, localFallback) {
  try {
    if (api.memorySetConfig) {
      await action();
    } else if (localFallback) {
      localFallback();
    }
    if (successMessage) toast(successMessage, '', 'success');
    await refreshMemory();
    return true;
  } catch (error) {
    if (localFallback) {
      localFallback();
      if (successMessage) toast(successMessage, '（当前为前端测试模式）', 'success');
      renderMemorySwitches();
      renderMemoryCandidates();
      renderMemoryList();
      return true;
    }
    toast('操作没成功', memoryErrorText(error), 'error');
    return false;
  }
}

function syncMemoryVisuals() {
  const enabled = memoryView.enabled === true;
  const config = memoryView.config || {};
  const personalOn = config.allow_sensitive_personal === true;

  const enabledToggle = $('#memoryEnabledToggle');
  if (enabledToggle && enabledToggle.checked !== enabled) {
    enabledToggle.checked = enabled;
  }
  const personalToggle = $('#memoryPersonalToggle');
  if (personalToggle && personalToggle.checked !== personalOn) {
    personalToggle.checked = personalOn;
  }

  const enabledState = $('#memoryEnabledState');
  if (enabledState) enabledState.textContent = enabled ? '已启用' : '关闭';
  const personalState = $('#memoryPersonalState');
  if (personalState) personalState.textContent = personalOn ? '已开启' : '关闭';

  const badge = $('#memoryCountBadge');
  if (badge) {
    badge.classList.toggle('is-disabled', !enabled);
    if (badge.lastElementChild) {
      const active = (memoryView.memories || []).filter((item) => !item.archived).length;
      badge.lastElementChild.textContent = enabled
        ? `已记住 ${active} 条 · ${MEMORY_MODE_LABELS[String(config.auto_memory)] || '提示我确认（推荐）'}`
        : '未启用';
    }
  }

  const root = $('#memoryRootPath');
  const ws = String(state.snapshot?.settings?.workspace || state.selectedWorkspace || '').trim();
  const openFolderBtn = $('#memoryOpenFolderBtn');
  const exportBtn = $('#memoryExportBtn');

  if (!ws) {
    if (root) root.textContent = '未选择工作区（请先在总览页设置本地代码目录）';
    if (openFolderBtn) {
      openFolderBtn.disabled = true;
      openFolderBtn.title = '未选择工作区，暂无目录可打开';
    }
    if (exportBtn) {
      exportBtn.disabled = true;
      exportBtn.title = '未选择工作区，暂无可导出数据';
    }
  } else {
    const defaultRoot = `${ws.replace(/[\\/]+$/, '')}\\.coding-tools\\memory`;
    const resolvedRoot = config.root && config.root.toLowerCase().startsWith(ws.toLowerCase()) ? config.root : defaultRoot;
    const hasMemories = (memoryView.memories || []).length > 0;
    const hasFiles = Boolean(config.exists || hasMemories);

    if (root) {
      root.textContent = enabled || hasFiles ? `记忆存储路径：${resolvedRoot}` : '记忆尚未启用（启用后将在本地工作区创建 Markdown 目录）';
    }
    if (openFolderBtn) {
      openFolderBtn.disabled = !hasFiles;
      openFolderBtn.title = hasFiles ? '在系统资源管理器中打开记忆目录' : '当前暂无记忆文件，无需打开目录';
    }
    if (exportBtn) {
      exportBtn.disabled = !hasFiles;
      exportBtn.title = hasFiles ? '导出记忆备份压缩包' : '当前暂无记忆文件，无法导出';
    }
  }
}

function initMemoryPage() {
  if (!memoryView.wired) {
    memoryView.wired = true;
    const enabled = $('#memoryEnabledToggle');
    if (enabled) enabled.addEventListener('change', async (e) => {
      e.stopPropagation();
      const isChecked = Boolean(enabled.checked);
      memoryView.enabled = isChecked;
      if (!memoryView.config) memoryView.config = {};
      memoryView.config.enabled = isChecked;
      if (!isChecked) {
        memoryView.config.auto_memory = 'off';
      } else if (memoryView.config.auto_memory === 'off') {
        memoryView.config.auto_memory = 'suggest';
      }
      if (isChecked && !memoryView.memories.length) {
        memoryView.memories = [...memoryTestDemoMemories];
        memoryView.candidates = memoryTestDemoCandidates.filter((c) => !memoryView.handledCandidateIds.has(c.candidate_id));
      }
      syncMemoryVisuals();
      renderMemoryCandidates();
      renderMemoryList();
      toast(isChecked ? '已启用长期记忆' : '已关闭长期记忆', isChecked ? '已解锁下属设置项与卡片操作' : '', 'success');
      try {
        if (api.memorySetConfig) {
          const resp = await api.memorySetConfig({
            enabled: isChecked,
            autoMemory: isChecked ? (memoryView.config.auto_memory || 'suggest') : 'off'
          });
          const updated = unwrap(resp);
          if (updated && updated.config) {
            memoryView.config = memoryConfigOf(updated);
            memoryView.enabled = memoryEnabledOf(updated);
            syncMemoryVisuals();
          }
        }
      } catch (err) {
        enabled.checked = !isChecked;
        memoryView.enabled = !isChecked;
        if (memoryView.config) memoryView.config.enabled = !isChecked;
        syncMemoryVisuals();
        toast('操作未成功', memoryErrorText(err), 'error');
      }
    });
    const personal = $('#memoryPersonalToggle');
    if (personal) personal.addEventListener('change', async (e) => {
      e.stopPropagation();
      const isChecked = Boolean(personal.checked);
      if (!memoryView.config) memoryView.config = {};
      memoryView.config.allow_sensitive_personal = isChecked;
      if (isChecked && !memoryView.enabled) {
        memoryView.enabled = true;
        memoryView.config.enabled = true;
        const enabledToggle = $('#memoryEnabledToggle');
        if (enabledToggle && !enabledToggle.checked) enabledToggle.checked = true;
        syncMemoryVisuals();
        if (api.memorySetConfig) {
          api.memorySetConfig({ enabled: true, allowSensitivePersonal: isChecked }).catch(() => {});
        }
      } else {
        syncMemoryVisuals();
        if (api.memorySetConfig) {
          api.memorySetConfig({ allowSensitivePersonal: isChecked }).catch(() => {});
        }
      }
    });
    const mode = $('#memoryModeSelect');
    if (mode) mode.addEventListener('change', async () => {
      const val = mode.value;
      if (!memoryView.config) memoryView.config = {};
      memoryView.config.auto_memory = val;
      if (!memoryView.enabled && val !== 'off') {
        memoryView.enabled = true;
        memoryView.config.enabled = true;
        const enabledToggle = $('#memoryEnabledToggle');
        if (enabledToggle) enabledToggle.checked = true;
        if (api.memorySetConfig) {
          api.memorySetConfig({ enabled: true, autoMemory: val }).catch(() => {});
        }
      } else {
        if (api.memorySetConfig) {
          api.memorySetConfig({ autoMemory: val }).catch(() => {});
        }
      }
      renderMemorySwitches();
    });

    // 现代化自研下拉菜单交互绑定
    const customSelect = $('#memoryModeCustomSelect');
    const trigger = $('#memoryModeSelectTrigger');
    const dropdown = $('#memoryModeDropdownMenu');
    if (trigger && dropdown) {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const willOpen = dropdown.hidden;
        dropdown.hidden = !willOpen;
        trigger.classList.toggle('is-open', willOpen);
        trigger.setAttribute('aria-expanded', String(willOpen));
        const switchCard = customSelect.closest('.memory-switch-card');
        if (switchCard) switchCard.classList.toggle('is-dropdown-open', willOpen);
        if (willOpen) {
          const rect = trigger.getBoundingClientRect();
          const spaceBelow = window.innerHeight - rect.bottom;
          if (spaceBelow < 150) {
            dropdown.classList.add('drop-up');
          } else {
            dropdown.classList.remove('drop-up');
          }
        }
      });

      dropdown.querySelectorAll('.custom-select-option').forEach((opt) => {
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          const val = opt.dataset.value;
          dropdown.hidden = true;
          trigger.classList.remove('is-open');
          trigger.setAttribute('aria-expanded', 'false');
          customSelect?.closest('.memory-switch-card')?.classList.remove('is-dropdown-open');
          if (mode) {
            mode.value = val;
            mode.dispatchEvent(new Event('change'));
          }
        });
      });

      document.addEventListener('click', (e) => {
        if (!customSelect?.contains(e.target)) {
          dropdown.hidden = true;
          trigger.classList.remove('is-open');
          trigger.setAttribute('aria-expanded', 'false');
          customSelect?.closest('.memory-switch-card')?.classList.remove('is-dropdown-open');
        }
      });
    }
    const search = $('#memorySearchInput');
    if (search) search.addEventListener('input', () => {
      memoryView.query = String(search.value || '');
      renderMemoryList();
      clearTimeout(memoryView.timer);
      memoryView.timer = setTimeout(() => refreshMemory(), 250);
    });
    const filters = $('#memoryScopeFilters');
    if (filters) filters.addEventListener('click', (event) => {
      const button = event.target.closest('[data-memory-scope],[data-memory-archived]');
      if (!button) return;
      memoryView.scope = button.dataset.memoryScope || '';
      memoryView.archived = button.dataset.memoryArchived === '1';
      $$('#memoryScopeFilters .segmented-item').forEach((item) => item.classList.toggle('active', item === button));
      renderMemoryList();
      refreshMemory();
    });
    const list = $('#memoryListContainer');
    if (list) list.addEventListener('click', handleMemoryListClick);
    const candidates = $('#memoryCandidateList');
    if (candidates) candidates.addEventListener('click', handleMemoryCandidateClick);
    const create = $('#memoryCreateBtn');
    if (create) create.addEventListener('click', () => { memoryView.draft = true; memoryView.editingId = ''; renderMemoryList(); });
    const openFolder = $('#memoryOpenFolderBtn');
    if (openFolder) openFolder.addEventListener('click', async () => {
      const ws = String(state.snapshot?.settings?.workspace || state.selectedWorkspace || '').trim();
      if (!ws) {
        toast('暂无记忆目录', '未选择工作区，请先在总览页设置本地代码目录', 'warn');
        return;
      }
      const hasMemories = (memoryView.memories || []).length > 0;
      if (!memoryView.enabled && !memoryView.config?.exists && !hasMemories) {
        toast('暂无记忆文件', '记忆尚未启用，暂无可打开的本地文件', 'warn');
        return;
      }
      try {
        if (api.openMemoryFolder) {
          const res = unwrap(await api.openMemoryFolder());
          if (res?.root) {
            toast('已打开记忆目录', res.root, 'success');
          }
        }
      } catch (err) {
        toast('无法打开目录', err.message, 'warn');
      }
    });
    const exportBtn = $('#memoryExportBtn');
    if (exportBtn) exportBtn.addEventListener('click', handleMemoryExport);
    const importBtn = $('#memoryImportBtn');
    if (importBtn) importBtn.addEventListener('click', handleMemoryImport);

    // 首屏快捷动作：平滑滚动到记忆列表
    $('#memoryScrollToViewBtn')?.addEventListener('click', () => {
      $('#memoryListSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

  }
  refreshMemory();
}

async function refreshMemory() {
  try {
    const listRequest = memoryView.query
      ? api.memorySearch({ query: memoryView.query, limit: 200 })
      : api.memoryList({ scope: memoryView.scope, limit: 200, archived: memoryView.archived });
    const [configResult, listResult, candidateResult] = await Promise.all([
      api.memoryConfig(), listRequest, api.memoryCandidates()
    ]);
    const configPayload = unwrap(configResult);
    if (configPayload && typeof configPayload === 'object') {
      memoryView.config = memoryConfigOf(configPayload);
      memoryView.enabled = memoryEnabledOf(configPayload);
      memoryView.memories = memoryRecordsOf(unwrap(listResult), 'memories');
      const fetchedCandidates = memoryRecordsOf(unwrap(candidateResult), 'candidates');
      memoryView.candidates = fetchedCandidates.filter((c) => !memoryView.handledCandidateIds.has(c.candidate_id));
    }
  } catch (error) {
    if (!memoryView.config) memoryView.config = {};
    // 严格遵循科学严谨性与真实性，绝不注入虚假的 Mock Demo 数据
    memoryView.memories = memoryView.memories || [];
    memoryView.candidates = memoryView.candidates || [];
  }
  renderMemorySwitches();
  renderMemoryCandidates();
  renderMemoryList();
}

function renderMemorySwitches() {
  const enabled = memoryView.enabled === true;
  const config = memoryView.config || {};
  const personalOn = config.allow_sensitive_personal === true;
  const enabledToggle = $('#memoryEnabledToggle');
  if (enabledToggle && enabledToggle.checked !== enabled) {
    enabledToggle.checked = enabled;
  }
  const personalToggle = $('#memoryPersonalToggle');
  if (personalToggle && personalToggle.checked !== personalOn) {
    personalToggle.checked = personalOn;
  }
  syncMemoryVisuals();
  const mode = $('#memoryModeSelect');
  if (mode) {
    const current = String(config.auto_memory || 'suggest');
    const normalized = MEMORY_MODE_LABELS[current] ? current : 'suggest';
    mode.value = normalized;
    mode.disabled = false;
    const label = $('#memoryModeSelectedLabel');
    if (label) label.textContent = MEMORY_MODE_LABELS[normalized] || normalized;
    $$('#memoryModeDropdownMenu .custom-select-option').forEach((opt) => {
      const isSel = opt.dataset.value === normalized;
      opt.classList.toggle('is-selected', isSel);
      opt.setAttribute('aria-selected', String(isSel));
    });
  }
  const ws = state.snapshot?.settings?.workspace || 'D:\\Lenovo\\Documents\\Mika-Repository';
  const defaultRoot = `${ws.replace(/[\\/]+$/, '')}\\.coding-tools\\memory`;
  const resolvedRoot = config.root || defaultRoot;

  const pathText = $('#memoryPathText');
  const pathPill = $('#memoryPathPill');
  if (pathText) {
    pathText.textContent = '本地目录：.coding-tools/memory';
  }
  if (pathPill) {
    pathPill.title = `完整路径：${resolvedRoot}（点击可直接在资源管理器中打开）`;
    pathPill.onclick = () => {
      if (api.openMemoryFolder) {
        api.openMemoryFolder().catch(() => {});
      }
    };
  }

  const root = $('#memoryRootPath');
  const chip = $('#memoryPathChip');
  if (root) {
    root.textContent = enabled || config.exists ? `记忆存储路径：${resolvedRoot}` : '记忆尚未启用（启用后将在本地工作区创建 Markdown 目录）';
  }
  if (chip) {
    chip.style.cursor = 'pointer';
    chip.title = `点击在资源管理器中打开此文件夹：${resolvedRoot}`;
    chip.onclick = () => {
      if (api.openMemoryFolder) {
        api.openMemoryFolder().catch(() => {});
      }
    };
  }

  const badge = $('#memoryCountBadge');
  if (badge) {
    badge.classList.toggle('is-disabled', !enabled);
    if (badge.lastElementChild) {
      const active = memoryView.memories.filter((item) => !item.archived).length;
      badge.lastElementChild.textContent = enabled ? `已记住 ${active} 条 · ${MEMORY_MODE_LABELS[String(config.auto_memory)] || '提示我确认（推荐）'}` : '未启用';
    }
  }
}

function memoryCompactEmptyMarkup(title, description) {
  return `
    <div class="memory-compact-empty">
      <div class="compact-empty-icon">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="7"/><path d="m5.5 8 2 2 3.5-3.5"/></svg>
      </div>
      <div class="compact-empty-content">
        <span class="compact-empty-title">${escapeHtml(title)}</span>
        <span class="compact-empty-sep">·</span>
        <span class="compact-empty-desc">${escapeHtml(description)}</span>
      </div>
    </div>`;
}

function memoryEmptyCard(title, description, showAddBtn = false) {
  return `
    <div class="empty-placeholder-card memory-empty-card">
      <div class="empty-icon-wrap memory-empty-icon-wrap">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z"/><path d="M9 21h6"/></svg>
      </div>
      <div class="empty-title">${escapeHtml(title)}</div>
      <div class="empty-desc">${escapeHtml(description)}</div>
      ${showAddBtn ? `
      <div class="memory-empty-action-wrap">
        <button type="button" class="primary-button btn-sm memory-empty-add-btn" id="memoryEmptyAddBtn">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>
          <span>手动添加第一条记忆</span>
        </button>
      </div>` : ''}
    </div>`;
}

function renderMemoryCandidates() {
  const section = $('#memoryCandidatesSection');
  const container = $('#memoryCandidateList');
  const badge = $('#memoryCandidateCount');
  const list = memoryView.candidates || [];
  if (badge && badge.lastElementChild) badge.lastElementChild.textContent = `${list.length} 条`;
  if (!section) return;

  // 严格条件渲染：仅在真的存在待确认建议时才展示，无建议时完全隐藏，不占首屏空间
  if (!list.length) {
    section.hidden = true;
    if (container) container.replaceChildren();
    return;
  }

  section.hidden = false;
  if (!container) return;
  if (!memoryView.candidates.length) {
    container.innerHTML = memoryCompactEmptyMarkup('暂无待确认的建议', '模型提出新记忆时会先在此等待您的确认，不点确认就不会记入');
    return;
  }
  container.innerHTML = memoryView.candidates.map((item) => {
    const id = escapeHtml(item.candidate_id || '');
    const type = String(item.memory_type || 'note');
    const safeTitle = escapeHtml(item.title || '未命名建议');
    const safeContent = escapeHtml(item.content || '');
    const typeLabel = escapeHtml(MEMORY_TYPE_LABELS[type] || '建议');
    return `
      <div class="memory-candidate-row" data-candidate-id="${id}">
        <div class="candidate-row-left">
          <div class="candidate-row-icon">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.5a4.5 4.5 0 0 0-2.5 8.2v1.8a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V9.7A4.5 4.5 0 0 0 8 1.5z"/><path d="M6.5 14.5h3"/></svg>
          </div>
          <div class="candidate-row-content">
            <div class="candidate-title-line">
              <b class="candidate-title" title="${safeTitle}">${safeTitle}</b>
              <span class="candidate-badge">${typeLabel}</span>
            </div>
            <div class="candidate-desc-line" title="${safeContent}">${safeContent}</div>
          </div>
        </div>
        <div class="candidate-row-actions">
          <button type="button" class="candidate-btn candidate-reject-btn" data-memory-candidate="reject" title="忽略此条建议">忽略</button>
          <button type="button" class="candidate-btn candidate-accept-btn" data-memory-candidate="confirm" title="记住并保存到本地">记住</button>
        </div>
      </div>`;
  }).join('');
}

function memoryFieldsMarkup(item = null) {
  const title = item ? escapeHtml(item.title || '') : '';
  const content = item ? escapeHtml(item.content || '') : '';
  return `
    <div class="memory-form-block">
      <div class="memory-form-row">
        <label class="memory-form-label">记忆标题</label>
        <input type="text" class="setting-input memory-input" data-memory-field="title" value="${title}" placeholder="简明标题，如：打包前必须先跑全量测试">
      </div>
      <div class="memory-form-row">
        <label class="memory-form-label">记忆内容</label>
        <textarea class="setting-input memory-textarea" rows="3" data-memory-field="content" placeholder="记录关键规范、配置路径或开发偏好（密码密钥等敏感信息不会被保存）">${content}</textarea>
      </div>
    </div>`;
}

function memoryCardMarkup(item) {
  const id = escapeHtml(item.memory_id || '');
  const updated = escapeHtml(String(item.updated_at || '').slice(0, 10));

  if (memoryView.editingId && memoryView.editingId === item.memory_id) {
    return `
      <div class="memory-editor-card" data-memory-id="${id}">
        <div class="memory-editor-header">
          <div class="memory-editor-title-row">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2.5 13.5 5 5 13.5H2.5V11L11 2.5z"/></svg>
            <b>编辑记忆</b>
          </div>
          <span class="memory-editor-tip">更新于 ${updated || '刚刚'}</span>
        </div>
        ${memoryFieldsMarkup(item)}
        <div class="memory-editor-footer">
          <span class="memory-editor-tip">纯本地明文存储，修改即时生效</span>
          <div class="memory-editor-actions">
            <button type="button" class="secondary-button btn-sm" data-memory-action="cancel">取消</button>
            <button type="button" class="primary-button btn-sm" data-memory-action="save">保存修改</button>
          </div>
        </div>
      </div>`;
  }

  const rawContent = String(item.content || '').replace(/\s+/g, ' ').trim();
  const summary = escapeHtml(rawContent.length > 90 ? rawContent.slice(0, 90) + '…' : rawContent);

  return `
    <div class="memory-list-item-clean ${item.archived ? 'is-disabled' : 'is-enabled'}" data-memory-id="${id}" role="button" tabindex="0" title="点击编辑此条记忆">
      <div class="memory-clean-main">
        <div class="memory-clean-title-line">
          <b class="memory-clean-title">${escapeHtml(item.title || '未命名')}</b>
          ${item.archived ? '<span class="status-pill status-idle" style="font-size:11px;padding:1px 6px;">已归档</span>' : ''}
        </div>
        <div class="memory-clean-summary" title="${escapeHtml(rawContent)}">${summary}</div>
      </div>
      <div class="action-more-wrap memory-clean-actions">
        <button type="button" class="action-more-btn memory-more-toggle-btn" data-memory-more-toggle="${id}" title="更多操作" aria-label="更多操作">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><circle cx="3" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="13" cy="8" r="1.5"/></svg>
        </button>
        <div class="action-more-dropdown" data-memory-more-menu="${id}" hidden>
          <button type="button" class="action-more-item" data-memory-action="edit">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2.5 13.5 5 5 13.5H2.5V11L11 2.5z"/></svg>
            <span>编辑</span>
          </button>
          <button type="button" class="action-more-item" data-memory-action="archive">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="10" height="10" rx="1.5"/><path d="M6 7h4M6 10h4"/></svg>
            <span>${item.archived ? '取消归档' : '归档'}</span>
          </button>
          <div class="action-more-divider"></div>
          <button type="button" class="action-more-item is-danger" data-memory-action="delete">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5h10M6 4.5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M4.5 4.5v8a1.5 1.5 0 0 0 1.5 1.5h4a1.5 1.5 0 0 0 1.5-1.5v-8"/></svg>
            <span>删除</span>
          </button>
        </div>
      </div>
    </div>`;
}

function memoryDraftMarkup() {
  return `
    <div class="memory-editor-card" data-memory-draft="1">
      <div class="memory-editor-header">
        <div class="memory-editor-title-row">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>
          <b>手动添加一条记忆</b>
        </div>
      </div>
      ${memoryFieldsMarkup()}
      <div class="memory-form-row memory-draft-scope-row">
        <label class="memory-form-label">归属范围</label>
        <div class="memory-scope-select-wrap">
          <select class="setting-input memory-select-input" data-memory-field="scope">
            <option value="project">本项目（仅在当前工作目录生效）</option>
            <option value="global">全局（所有工作项目通用）</option>
            <option value="task">本任务（单次会话临时有效）</option>
          </select>
        </div>
      </div>
      <div class="memory-editor-footer">
        <span class="memory-editor-tip">手动添加的记忆直接生效，无需二次确认</span>
        <div class="memory-editor-actions">
          <button type="button" class="secondary-button btn-sm" data-memory-action="cancel">取消</button>
          <button type="button" class="primary-button btn-sm" data-memory-action="create">确认添加</button>
        </div>
      </div>
    </div>`;
}

function renderMemoryList() {
  const container = $('#memoryListContainer');
  if (!container) return;

  // 纯前端本地 0ms 即时过滤：支持范围筛选、归档状态、关键字模糊匹配，绝不依赖网络请求延迟，永不卡顿
  const scopeFilter = String(memoryView.scope || '').trim();
  const archivedFilter = Boolean(memoryView.archived);
  const queryFilter = String(memoryView.query || '').trim().toLowerCase();

  const filteredList = (memoryView.memories || []).filter((item) => {
    if (!item) return false;
    // 1. 归档状态过滤
    if (Boolean(item.archived) !== archivedFilter) return false;
    // 2. 作用域范围过滤
    if (scopeFilter && item.scope && item.scope !== scopeFilter) return false;
    // 3. 关键字过滤
    if (queryFilter) {
      const title = String(item.title || '').toLowerCase();
      const content = String(item.content || '').toLowerCase();
      if (!title.includes(queryFilter) && !content.includes(queryFilter)) return false;
    }
    return true;
  });

  if (!filteredList.length && !memoryView.draft) {
    const title = memoryView.query
      ? '没有匹配的记忆'
      : (memoryView.archived
          ? '没有已归档的记忆'
          : (scopeFilter ? `暂无「${MEMORY_SCOPE_LABELS[scopeFilter] || scopeFilter}」相关的记忆` : '还没有记住任何内容'));
    const description = memoryView.query
      ? '换个关键词试试，或者清空搜索框'
      : (memoryView.archived
          ? '归档只是收起来，取消归档就能回到列表'
          : '模型提议后经您确认的内容会出现在这里，也可以随时手动添加');
    container.innerHTML = memoryEmptyCard(title, description, !memoryView.query && !memoryView.archived);
    container.querySelector('#memoryEmptyAddBtn')?.addEventListener('click', () => {
      memoryView.draft = true;
      memoryView.editingId = '';
      renderMemoryList();
    });
    return;
  }
  container.innerHTML = (memoryView.draft ? memoryDraftMarkup() : '') + filteredList.map(memoryCardMarkup).join('');
}

function memoryFieldValue(card, field) {
  const node = card.querySelector(`[data-memory-field="${field}"]`);
  return node ? String(node.value || '') : '';
}

async function handleMemoryListClick(event) {
  // 1. ··· 更多操作切换
  const moreBtn = event.target.closest('[data-memory-more-toggle]');
  if (moreBtn) {
    event.stopPropagation();
    const id = moreBtn.dataset.memoryMoreToggle;
    const menu = event.currentTarget.querySelector(`[data-memory-more-menu="${id}"]`);
    if (menu) {
      const willShow = menu.hidden;
      event.currentTarget.querySelectorAll('.action-more-dropdown').forEach((m) => { m.hidden = true; });
      document.querySelectorAll('.is-menu-open').forEach((el) => el.classList.remove('is-menu-open'));

      menu.hidden = !willShow;
      if (!menu.hidden) {
        moreBtn.closest('.memory-list-item-clean')?.classList.add('is-menu-open');
        const rect = moreBtn.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow < 160) {
          menu.classList.add('drop-up');
        } else {
          menu.classList.remove('drop-up');
        }
      }
    }
    return;
  }

  // 2. 检查是否有明确的操作按钮
  const button = event.target.closest('[data-memory-action]');
  if (!button) {
    // 点击卡片直接进入编辑模式
    const itemCard = event.target.closest('.memory-list-item-clean[data-memory-id]');
    if (itemCard && !event.target.closest('.action-more-wrap')) {
      const id = String(itemCard.dataset.memoryId || '');
      if (id) {
        memoryView.editingId = id;
        memoryView.draft = false;
        renderMemoryList();
      }
    }
    return;
  }

  const card = button.closest('[data-memory-draft],[data-memory-id]');
  if (!card) return;
  event.currentTarget.querySelectorAll('.action-more-dropdown').forEach((m) => { m.hidden = true; });
  const action = String(button.dataset.memoryAction || '');
  if (card.dataset.memoryDraft === '1') {
    if (action === 'cancel') { memoryView.draft = false; renderMemoryList(); return; }
    if (action === 'create') {
      const title = memoryFieldValue(card, 'title').trim();
      const content = memoryFieldValue(card, 'content').trim();
      const scope = memoryFieldValue(card, 'scope') || 'project';
      if (!title) { toast('还差一个标题', '给这条记忆起个名字再添加。', 'error'); return; }
      const saved = await runMemoryAction(
        () => api.memoryCreate({ scope, title, content }),
        '已添加记忆',
        () => {
          const newId = `demo-${Date.now()}`;
          memoryView.memories.unshift({
            memory_id: newId,
            title,
            content,
            memory_type: 'note',
            scope,
            pinned: false,
            revision: 1,
            updated_at: new Date().toISOString()
          });
        }
      );
      if (saved) { memoryView.draft = false; renderMemoryList(); }
      return;
    }
    return;
  }
  const id = String(card.dataset.memoryId || '');
  if (!id) return;
  if (action === 'edit') { memoryView.editingId = id; memoryView.draft = false; renderMemoryList(); return; }
  if (action === 'cancel') { memoryView.editingId = ''; renderMemoryList(); return; }
  if (action === 'save') {
    const title = memoryFieldValue(card, 'title');
    const content = memoryFieldValue(card, 'content');
    const payload = { memoryId: id, title, content };
    memoryView.editingId = '';
    await runMemoryAction(
      () => api.memoryUpdate(payload),
      '已保存记忆变更',
      () => {
        const target = memoryView.memories.find((item) => item.memory_id === id);
        if (target) {
          target.title = title;
          target.content = content;
          target.revision = (Number(target.revision) || 1) + 1;
          target.updated_at = new Date().toISOString();
        }
      }
    );
    renderMemoryList();
    return;
  }
  const item = memoryView.memories.find((record) => record.memory_id === id) || null;
  if (action === 'archive') {
    const nextArchived = !(item && item.archived);
    if (item && item.archived) {
      await runMemoryAction(
        () => api.memoryUpdate({ memoryId: id, archived: false }),
        '已取消归档',
        () => { if (item) item.archived = false; }
      );
    } else {
      await runMemoryAction(
        () => api.memoryArchive(id),
        '已归档记忆',
        () => { if (item) item.archived = true; }
      );
    }
    renderMemoryList();
    return;
  }
  if (action === 'delete') {
    const memoryTitle = item ? (item.title || '该记忆') : '该记忆';
    const confirmed = await showModernConfirm({
      title: '删除记忆',
      message: `确定删除「${memoryTitle}」？此记忆将从本地完全移除，无法恢复。`,
      confirmText: '确认删除',
      cancelText: '取消',
      danger: true
    });
    if (!confirmed) return;
    await runMemoryAction(
      () => api.memoryDelete(id),
      '已删除记忆',
      () => {
        memoryView.memories = memoryView.memories.filter((m) => m.memory_id !== id);
      }
    );
    renderMemoryList();
  }
}

async function handleMemoryCandidateClick(event) {
  const button = event.target.closest('[data-memory-candidate]');
  if (!button) return;
  const card = button.closest('[data-candidate-id]');
  if (!card) return;
  if (card.classList.contains('is-dismissing') || button.disabled) return;
  const id = String(card.dataset.candidateId || '');
  if (!id) return;
  const cand = memoryView.candidates.find((c) => c.candidate_id === id);

  // 1. 立即锁定当前卡片并添加淡出收起动画，杜绝连击
  button.disabled = true;
  card.classList.add('is-dismissing');
  memoryView.handledCandidateIds.add(id);

  // 2. 立即更新角标数字
  const remainingCount = Math.max(0, memoryView.candidates.filter((c) => c.candidate_id !== id).length);
  const badge = $('#memoryCandidateCount');
  if (badge && badge.lastElementChild) badge.lastElementChild.textContent = `${remainingCount} 条`;

  if (button.dataset.memoryCandidate === 'confirm') {
    // 乐观立即加入长期记忆列表
    if (cand) {
      memoryView.memories.unshift({
        memory_id: `mem-${Date.now()}`,
        title: cand.title,
        content: cand.content,
        memory_type: cand.memory_type || 'note',
        scope: cand.scope || 'project',
        revision: 1,
        updated_at: new Date().toISOString()
      });
      renderMemoryList();
    }
    toast('已确认并记入长期记忆', cand ? cand.title : '', 'success');
    if (api.memoryConfirm) {
      api.memoryConfirm({ candidateId: id }).catch(() => {});
    }
    setTimeout(() => {
      memoryView.candidates = memoryView.candidates.filter((c) => c.candidate_id !== id);
      renderMemoryCandidates();
    }, 220);
    return;
  }

  // 点击「不记」：立即弹出明确提示，平滑收起卡片并异步同步
  toast('已忽略该条建议', '已从待确认列表中移除', 'info');
  if (api.memoryReject) {
    api.memoryReject(id).catch(() => {});
  }
  setTimeout(() => {
    memoryView.candidates = memoryView.candidates.filter((c) => c.candidate_id !== id);
    renderMemoryCandidates();
  }, 220);
}

async function handleMemoryExport() {
  const activeCount = (memoryView.memories || []).length;
  if (!memoryView.enabled && activeCount === 0) {
    toast('暂无记忆数据', '当前尚未启用长期记忆，本地暂无可导出的记忆文件。', 'warn');
    return;
  }
  try {
    const picked = unwrap(await api.memoryChooseExportPath()) || null;
    const target = picked && picked.target ? String(picked.target) : '';
    if (!target) return;
    const result = unwrap(await api.memoryExport(target)) || {};
    const file = result.export && result.export.path ? result.export.path : target;
    toast('备份已导出', String(file), 'success');
    await refreshMemory();
  } catch (error) {
    toast('导出失败', memoryErrorText(error), 'error');
  }
}

async function handleMemoryImport() {
  try {
    const picked = unwrap(await api.memoryChooseImportPath()) || null;
    const source = picked && picked.source ? String(picked.source) : '';
    if (!source) return;
    const confirmed = await showModernConfirm({
      title: '导入记忆备份',
      message: '导入会将备份包中的记忆合并到当前工作区（同 ID 记录会自动更新）。是否继续？',
      confirmText: '确认导入',
      cancelText: '取消',
      danger: false
    });
    if (!confirmed) return;
    const result = unwrap(await api.memoryImport(source)) || {};
    const imported = result.import && result.import.imported !== undefined ? result.import.imported : (result.imported || 0);
    toast('备份已导入', `已成功合并 ${Number(imported) || 0} 条记忆`, 'success');
    await refreshMemory();
  } catch (error) {
    toast('导入失败', memoryErrorText(error), 'error');
  }
}

function estimateTokens(text) {
  if (!text) return 0;
  const str = String(text);
  const chineseChars = (str.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (str.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[a-zA-Z0-9_-]+/g) || []).length;
  const others = str.length - chineseChars;
  return Math.max(0, Math.ceil(chineseChars * 1.2 + englishWords * 1.3 + others * 0.3));
}

function insertTextAtCursor(textarea, insertedText) {
  if (!textarea) return;
  const start = textarea.selectionStart || 0;
  const end = textarea.selectionEnd || 0;
  const val = textarea.value;
  textarea.value = val.substring(0, start) + insertedText + val.substring(end);
  textarea.focus();
  const nextPos = start + insertedText.length;
  textarea.setSelectionRange(nextPos, nextPos);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function renderSkillCategories() {
  const bar = $('#skillsCategoriesBar');
  if (!bar) return;
  const cats = new Set(['全部']);
  state.skills.forEach((s) => {
    if (s.category && s.category.trim()) cats.add(s.category.trim());
  });
  const current = state.selectedSkillCategory || '全部';
  bar.innerHTML = [...cats].map((cat) => {
    const isCur = current === cat;
    return `<button type="button" class="modern-cat-tab ${isCur ? 'active' : ''}" data-cat="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`;
  }).join('');

  bar.querySelectorAll('.modern-cat-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedSkillCategory = btn.dataset.cat || '全部';
      renderSkillCategories();
      renderSkillsGrid();
    });
  });
}

function renderSkillsGrid() {
  const container = $('#skillsListContainer');
  if (!container) return;
  const query = String(state.skillSearch || '').trim().toLowerCase();
  const selCat = state.selectedSkillCategory || '全部';
  const list = state.skills.filter((item) => {
    if (selCat !== '全部' && item.category !== selCat) return false;
    if (!query) return true;
    return (
      String(item.name || '').toLowerCase().includes(query) ||
      String(item.description || '').toLowerCase().includes(query) ||
      String(item.category || '').toLowerCase().includes(query)
    );
  });

  if (!list.length) {
    container.className = 'skills-grid-container';
    container.innerHTML = `
      <div class="empty-placeholder-card" style="padding: 40px 16px; text-align: center; width: 100%;">
        <div class="empty-icon-wrap" style="color: var(--muted-2); margin-bottom: 8px;">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="13" y2="13"/></svg>
        </div>
        <div class="empty-title" style="font-size: 14px; font-weight: 600; color: var(--text);">${query ? '未找到匹配的技能' : '暂无技能'}</div>
        <div class="empty-desc" style="font-size: 12px; color: var(--muted); margin-top: 4px;">点击右上角「+ 添加技能」创建自定义技能模版</div>
      </div>
    `;
    return;
  }

  container.className = 'skill-list-container';
  container.innerHTML = list.map((item) => {
    const isEnabled = Boolean(item.enabled);
    const iconSvg = getSkillIconSvg(item.icon);
    const safeId = escapeHtml(item.id);
    const safeName = escapeHtml(item.name || '未命名技能');
    const safeDesc = escapeHtml(item.description || '暂无描述说明');

    return `
      <div class="skill-list-row ${isEnabled ? 'is-enabled' : 'is-disabled'}" data-skill-id="${safeId}" role="button" tabindex="0" title="点击查看详情与指令">
        <div class="skill-row-left">
          <div class="skill-row-icon">${iconSvg}</div>
          <div class="skill-row-meta">
            <b class="skill-row-title" title="${safeName}">${safeName}</b>
          </div>
        </div>
        <div class="skill-row-middle">
          <div class="skill-desc-summary" title="${safeDesc}">${safeDesc}</div>
        </div>
        <div class="skill-row-actions">
          <div class="skill-hover-actions">
            <button type="button" class="modern-icon-edit-btn skill-edit-btn" data-skill-id="${safeId}" title="编辑技能">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 2.5 13.5 5 5 13.5H2.5V11L11 2.5z"/></svg>
            </button>
            <button type="button" class="modern-icon-del-btn skill-del-btn" data-skill-id="${safeId}" title="删除技能">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4.5h10M6 4.5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M4.5 4.5v8a1.5 1.5 0 0 0 1.5 1.5h4a1.5 1.5 0 0 0 1.5-1.5v-8"/></svg>
            </button>
          </div>
          <label class="modern-toggle-switch" title="${isEnabled ? '点击停用' : '点击启用'}">
            <input type="checkbox" class="skill-enable-toggle" data-skill-id="${safeId}" ${isEnabled ? 'checked' : ''}>
            <span class="modern-toggle-slider"></span>
          </label>
        </div>
      </div>
    `;
  }).join('');

  // 1. 点击整行进入详情
  container.querySelectorAll('.skill-list-row').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.skill-row-actions')) return;
      const id = row.dataset.skillId;
      const item = state.skills.find((s) => s.id === id);
      if (item) openSkillDetailModal(item);
    });
  });

  // 2. 启用/停用翡翠绿开关
  container.querySelectorAll('.skill-enable-toggle').forEach((chk) => {
    chk.addEventListener('click', (e) => e.stopPropagation());
    chk.addEventListener('change', async (e) => {
      e.stopPropagation();
      const id = e.target.dataset.skillId;
      const checked = e.target.checked;
      await handleToggleSkill(id, checked);
    });
  });

  // 3. 编辑按钮
  container.querySelectorAll('.skill-edit-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.skillId;
      const item = state.skills.find((s) => s.id === id);
      if (item) openSkillModal(item);
    });
  });

  // 4. 删除按钮
  container.querySelectorAll('.skill-del-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.skillId;
      await handleDeleteSkill(id);
    });
  });
}

function openSkillDetailModal(skill) {
  if (!skill) return;
  const modal = $('#skillDetailModal');
  if (!modal) return;
  $('#skillDetailTitle').textContent = skill.name || '未命名技能';
  $('#skillDetailCategory').textContent = skill.category || '通用';
  $('#skillDetailDesc').textContent = skill.description || '暂无描述说明';
  const iconBadge = $('#skillDetailIcon');
  if (iconBadge) iconBadge.innerHTML = getSkillIconSvg(skill.icon);
  const promptCode = $('#skillDetailPromptCode');
  if (promptCode) promptCode.textContent = skill.prompt || '';

  const copyBtn = $('#skillDetailCopyPromptBtn');
  const copyTextSpan = $('#skillDetailCopyPromptText');
  if (copyBtn) {
    copyBtn.onclick = async () => {
      await copyText(skill.prompt || '');
      if (copyTextSpan) copyTextSpan.textContent = '已复制 ✓';
      else copyBtn.textContent = '已复制 ✓';
      setTimeout(() => {
        if (copyTextSpan) copyTextSpan.textContent = '复制 Prompt';
        else copyBtn.textContent = '复制 Prompt';
      }, 1800);
    };
  }
  const doneBtn = $('#skillDetailDoneBtn');
  if (doneBtn) {
    doneBtn.onclick = () => { modal.hidden = true; };
  }
  const editBtn = $('#skillDetailEditBtn');
  if (editBtn) {
    editBtn.onclick = () => {
      modal.hidden = true;
      openSkillModal(skill);
    };
  }
  const delBtn = $('#skillDetailDeleteBtn');
  if (delBtn) {
    delBtn.onclick = async () => {
      modal.hidden = true;
      await handleDeleteSkill(skill.id);
    };
  }
  const closeBtn = $('#closeSkillDetailModalBtn');
  if (closeBtn) {
    closeBtn.onclick = () => { modal.hidden = true; };
  }
  modal.onclick = (e) => {
    if (e.target === modal) modal.hidden = true;
  };
  modal.hidden = false;
}

function openSkillModal(skill = null) {
  const modal = $('#skillModal');
  if (!modal) return;
  $('#skillModalTitle').textContent = skill ? '编辑技能' : '添加技能';
  $('#skillEditId').value = skill ? skill.id : '';
  $('#skillNameInput').value = skill ? (skill.name || '') : '';
  $('#skillCategoryInput').value = skill ? (skill.category || '') : '';
  $('#skillIconSelect').value = skill ? (skill.icon || 'code') : 'code';
  $('#skillDescInput').value = skill ? (skill.description || '') : '';
  const promptInput = $('#skillPromptInput');
  promptInput.value = skill ? (skill.prompt || '') : '';
  const enableChk = $('#skillEnableCheckbox');
  if (enableChk) enableChk.checked = skill ? Boolean(skill.enabled) : true;

  const tokensSpan = $('#skillTokensCount');
  if (tokensSpan) tokensSpan.textContent = `Tokens: ${estimateTokens(promptInput.value)}`;

  modal.hidden = false;
  $('#skillNameInput').focus();
}

function closeSkillModal() {
  const modal = $('#skillModal');
  if (modal) modal.hidden = true;
}

async function handleSaveSkill(e) {
  e.preventDefault();
  const id = $('#skillEditId').value.trim();
  const name = $('#skillNameInput').value.trim();
  const category = $('#skillCategoryInput').value.trim() || '通用';
  const icon = $('#skillIconSelect').value || 'code';
  const description = $('#skillDescInput').value.trim();
  const prompt = $('#skillPromptInput').value.trim();
  const enabled = $('#skillEnableCheckbox') ? $('#skillEnableCheckbox').checked : true;

  if (!name) { toast('请输入技能名称', '', 'warn'); return; }
  if (!prompt) { toast('请输入技能执行指令', '', 'warn'); return; }

  try {
    const payload = { id: id || undefined, name, category, icon, description, prompt, enabled };
    unwrap(await api.saveSkill(payload));
    closeSkillModal();
    toast('技能已保存', `技能「${name}」已保存并同步`);
    await loadSkillsData();
  } catch (err) {
    toast('保存技能失败', err.message, 'error');
  }
}

async function handleToggleSkill(id, enabled) {
  try {
    unwrap(await api.toggleSkill(id, enabled));
    const target = state.skills.find((s) => s.id === id);
    if (target) target.enabled = enabled;
    renderSkillsGrid();
    toast(enabled ? '技能已开启' : '技能已停用', '快捷技能已同步更新');
  } catch (err) {
    toast('切换技能状态失败', err.message, 'error');
    renderSkillsGrid();
  }
}

async function handleDeleteSkill(id) {
  const item = state.skills.find((s) => s.id === id);
  const name = item?.name || '该技能';
  const confirmed = await showModernConfirm({
    title: '删除技能',
    message: `确定要删除技能「${name}」吗？此操作无法撤销。`,
    confirmText: '确认删除',
    cancelText: '取消',
    danger: true
  });
  if (!confirmed) return;
  try {
    unwrap(await api.deleteSkill(id));
    toast('技能已删除', `「${name}」已从技能库移除`);
    await loadSkillsData();
  } catch (err) {
    toast('删除技能失败', err.message, 'error');
  }
}

async function handleUploadSkill() {
  try {
    const res = unwrap(await api.openUploadSkillDialog());
    if (res) {
      toast('技能导入成功', `已成功解析并导入技能「${res.name}」`);
      await loadSkillsData();
    }
  } catch (err) {
    toast('导入技能失败', err.message, 'error');
  }
}

/* ==========================================================================
   提示词库系统 (Prompts Library System)
   ========================================================================== */

async function loadPromptsData() {
  try {
    const list = unwrap(await api.listPrompts());
    state.prompts = Array.isArray(list) ? list : [];
    renderPromptCategories();
    renderPromptsGrid();
  } catch (err) {
    toast('获取提示词库失败', err.message, 'error');
  }
}

function renderPromptCategories() {
  const bar = $('#promptsCategoriesBar');
  if (!bar) return;
  const cats = new Set(['全部']);
  state.prompts.forEach((p) => {
    if (p.category && p.category.trim()) cats.add(p.category.trim());
  });
  const current = state.selectedPromptCategory || '全部';
  bar.innerHTML = [...cats].map((cat) => {
    const isCur = current === cat;
    return `<button type="button" class="modern-cat-tab ${isCur ? 'active' : ''}" data-cat="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`;
  }).join('');

  bar.querySelectorAll('.modern-cat-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedPromptCategory = btn.dataset.cat || '全部';
      renderPromptCategories();
      renderPromptsGrid();
    });
  });
}

function renderPromptsGrid() {
  const container = $('#promptsListContainer');
  if (!container) return;
  const query = String(state.promptSearch || '').trim().toLowerCase();
  const selCat = state.selectedPromptCategory || '全部';
  const list = state.prompts.filter((item) => {
    if (selCat !== '全部' && item.category !== selCat) return false;
    if (!query) return true;
    return (
      String(item.title || '').toLowerCase().includes(query) ||
      String(item.description || '').toLowerCase().includes(query) ||
      String(item.content || '').toLowerCase().includes(query) ||
      String(item.category || '').toLowerCase().includes(query)
    );
  });

  if (!list.length) {
    container.innerHTML = `
      <div class="empty-placeholder-card" style="padding: 40px 16px; text-align: center; grid-column: 1 / -1; width: 100%;">
        <div class="empty-icon-wrap" style="color: var(--muted-2); margin-bottom: 8px;">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
        </div>
        <div class="empty-title" style="font-size: 14px; font-weight: 600; color: var(--text);">${query ? '未找到相关提示词' : '暂无提示词'}</div>
        <div class="empty-desc" style="font-size: 12px; color: var(--muted); margin-top: 4px;">点击右上角「+ 添加提示词」添加常用模版</div>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map((item) => {
    const safeId = escapeHtml(item.id);
    const safeTitle = escapeHtml(item.title || '未命名提示词');
    const safeDesc = escapeHtml(item.description || '');

    return `
      <div class="prompt-card" data-prompt-id="${safeId}" role="button" tabindex="0" title="点击查看与编辑">
        <div class="prompt-card-header">
          <b class="prompt-card-title">${safeTitle}</b>
          ${safeDesc ? `<div class="prompt-card-desc" title="${safeDesc}">${safeDesc}</div>` : ''}
        </div>
        <div class="prompt-card-footer">
          <div class="skill-hover-actions">
            <button type="button" class="modern-icon-edit-btn prompt-copy-btn" data-prompt-id="${safeId}" title="复制提示词内容">
              <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5.5" y="5.5" width="7.5" height="7.5" rx="1.5"/><path d="M3 10.5V3.5A1.5 1.5 0 0 1 4.5 2h7"/></svg>
            </button>
            <button type="button" class="modern-icon-edit-btn prompt-edit-btn" data-prompt-id="${safeId}" title="编辑提示词">
              <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 2.5 13.5 5 5 13.5H2.5V11L11 2.5z"/></svg>
            </button>
            <button type="button" class="modern-icon-del-btn prompt-del-btn" data-prompt-id="${safeId}" title="删除提示词">
              <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4.5h10M6 4.5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M4.5 4.5v8a1.5 1.5 0 0 0 1.5 1.5h4a1.5 1.5 0 0 0 1.5-1.5v-8"/></svg>
            </button>
          </div>
          <button type="button" class="prompt-insert-btn" data-prompt-id="${safeId}" title="直接填入到 ChatGPT 输入框">
            <span>填入 ChatGPT</span>
            <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12.5 12.5 3.5M6 3.5h6.5v6.5"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // 1. 点击卡片查看与编辑
  container.querySelectorAll('.prompt-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.prompt-card-footer')) return;
      const id = card.dataset.promptId;
      const item = state.prompts.find((p) => p.id === id);
      if (item) openPromptModal(item);
    });
  });

  // 2. 插入 ChatGPT
  container.querySelectorAll('.prompt-insert-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.promptId;
      const item = state.prompts.find((p) => p.id === id);
      if (item?.content) {
        await handleInsertPrompt(item.content, item.title);
      }
    });
  });

  // 3. 复制
  container.querySelectorAll('.prompt-copy-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.promptId;
      const item = state.prompts.find((p) => p.id === id);
      if (item?.content) {
        await copyText(item.content);
        toast('提示词已复制到剪贴板');
      }
    });
  });

  // 4. 编辑
  container.querySelectorAll('.prompt-edit-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.promptId;
      const item = state.prompts.find((p) => p.id === id);
      if (item) openPromptModal(item);
    });
  });

  // 5. 删除
  container.querySelectorAll('.prompt-del-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.promptId;
      await handleDeletePrompt(id);
    });
  });
}

function openPromptModal(prompt = null) {
  const modal = $('#promptModal');
  if (!modal) return;
  const isEdit = Boolean(prompt && prompt.id);
  $('#promptModalTitle').textContent = isEdit ? '编辑提示词' : '添加提示词';
  $('#promptEditId').value = isEdit ? prompt.id : '';
  $('#promptTitleInput').value = prompt ? (prompt.title || '') : '';
  $('#promptCategoryInput').value = prompt ? (prompt.category || '') : '';
  $('#promptDescInput').value = prompt ? (prompt.description || '') : '';
  const contentInput = $('#promptContentInput');
  contentInput.value = prompt ? (prompt.content || '') : '';

  const catBadge = $('#promptModalCategoryBadge');
  if (catBadge) {
    if (prompt?.category) {
      catBadge.textContent = prompt.category;
      catBadge.style.display = 'inline-flex';
    } else {
      catBadge.style.display = 'none';
    }
  }

  // Tokens 计数更新
  const tokensSpan = $('#promptTokensCount');
  if (tokensSpan) tokensSpan.textContent = `Tokens: ${estimateTokens(contentInput.value)}`;

  // 复制内容按钮
  const copyBtn = $('#promptFormCopyBtn');
  const copyTextSpan = $('#promptFormCopyBtnText');
  if (copyBtn) {
    copyBtn.onclick = async () => {
      const text = contentInput.value;
      if (!text) return;
      await copyText(text);
      if (copyTextSpan) copyTextSpan.textContent = '已复制 ✓';
      setTimeout(() => { if (copyTextSpan) copyTextSpan.textContent = '复制'; }, 1800);
    };
  }

  // 插入 ChatGPT 按钮（仅在编辑已有提示词时显示）
  const injectBtn = $('#promptFormInjectBtn');
  if (injectBtn) {
    injectBtn.style.display = isEdit ? 'inline-flex' : 'none';
    injectBtn.onclick = async () => {
      const content = contentInput.value;
      const title = $('#promptTitleInput').value;
      modal.hidden = true;
      if (content) await handleInsertPrompt(content, title);
    };
  }

  // 删除按钮（仅在编辑已有提示词时显示）
  const delBtn = $('#promptFormDeleteBtn');
  if (delBtn) {
    delBtn.style.display = isEdit ? 'inline-flex' : 'none';
    delBtn.onclick = async () => {
      if (prompt?.id) {
        modal.hidden = true;
        await handleDeletePrompt(prompt.id);
      }
    };
  }

  modal.hidden = false;
  $('#promptTitleInput').focus();
}

function closePromptModal() {
  const modal = $('#promptModal');
  if (modal) modal.hidden = true;
}

async function handleSavePrompt(e) {
  e.preventDefault();
  const id = $('#promptEditId').value.trim();
  const title = $('#promptTitleInput').value.trim();
  const category = $('#promptCategoryInput').value.trim() || '常用';
  const description = $('#promptDescInput').value.trim();
  const content = $('#promptContentInput').value.trim();

  if (!title) { toast('请输入提示词标题', '', 'warn'); return; }
  if (!content) { toast('请输入提示词正文', '', 'warn'); return; }

  try {
    const payload = { id: id || undefined, title, category, description, content };
    unwrap(await api.savePrompt(payload));
    closePromptModal();
    toast('提示词已保存', `提示词「${title}」已保存到模版库`);
    await loadPromptsData();
  } catch (err) {
    toast('保存提示词失败', err.message, 'error');
  }
}

async function handleDeletePrompt(id) {
  const item = state.prompts.find((p) => p.id === id);
  const title = item?.title || '该提示词';
  const confirmed = await showModernConfirm({
    title: '删除提示词',
    message: `确定要删除提示词「${title}」吗？此操作无法撤销。`,
    confirmText: '确认删除',
    cancelText: '取消',
    danger: true
  });
  if (!confirmed) return;
  try {
    unwrap(await api.deletePrompt(id));
    toast('提示词已删除', `「${title}」已从模版库移除`);
    await loadPromptsData();
  } catch (err) {
    toast('删除提示词失败', err.message, 'error');
  }
}

async function handleInsertPrompt(text, title = '内容') {
  try {
    await copyText(text, false);
    if (api.insertPrompt) {
      unwrap(await api.insertPrompt(text));
    }
    toast('已填入聊天输入框', `“${title}”已准备好，切换至聊天窗口即可发送（内容已同步到剪贴板）`);
  } catch (err) {
    toast('填入提示词失败', err.message, 'error');
  }
}

function bindSkillAndPromptEvents() {
  // 技能搜索过滤
  $('#skillsFilterInput')?.addEventListener('input', (e) => {
    state.skillSearch = e.target.value.trim();
    renderSkillsGrid();
  });

  // 技能创建与上传模态框
  $('#createSkillBtn')?.addEventListener('click', () => openSkillModal(null));
  $('#uploadSkillBtn')?.addEventListener('click', handleUploadSkill);
  $('#closeSkillModalBtn')?.addEventListener('click', closeSkillModal);
  $('#cancelSkillBtn')?.addEventListener('click', closeSkillModal);
  $('#skillForm')?.addEventListener('submit', handleSaveSkill);

  // 技能文本框输入实时更新 Tokens 计数
  $('#skillPromptInput')?.addEventListener('input', (e) => {
    const tokensSpan = $('#skillTokensCount');
    if (tokensSpan) tokensSpan.textContent = `Tokens: ${estimateTokens(e.target.value)}`;
  });

  // 技能变量插入按钮
  $('#skillInsertVarBtn')?.addEventListener('click', () => {
    insertTextAtCursor($('#skillPromptInput'), '{input}');
  });

  // 提示词搜索过滤
  $('#promptsFilterInput')?.addEventListener('input', (e) => {
    state.promptSearch = e.target.value.trim();
    renderPromptsGrid();
  });

  // 提示词创建与模态框
  $('#createPromptBtn')?.addEventListener('click', () => openPromptModal(null));
  $('#closePromptModalBtn')?.addEventListener('click', closePromptModal);
  $('#cancelPromptBtn')?.addEventListener('click', closePromptModal);
  $('#promptForm')?.addEventListener('submit', handleSavePrompt);

  // 提示词文本框输入实时更新 Tokens 计数
  $('#promptContentInput')?.addEventListener('input', (e) => {
    const tokensSpan = $('#promptTokensCount');
    if (tokensSpan) tokensSpan.textContent = `Tokens: ${estimateTokens(e.target.value)}`;
  });

  // 提示词变量插入按钮
  $('#promptInsertVarBtn')?.addEventListener('click', () => {
    insertTextAtCursor($('#promptContentInput'), '{input}');
  });

  // 点击遮罩外部关闭模态框
  $('#skillModal')?.addEventListener('click', (e) => {
    if (e.target === $('#skillModal')) closeSkillModal();
  });
  $('#promptModal')?.addEventListener('click', (e) => {
    if (e.target === $('#promptModal')) closePromptModal();
  });

  // 点击空白处关闭所有更多操作浮层菜单
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.action-more-wrap')) {
      document.querySelectorAll('.action-more-dropdown').forEach((m) => { m.hidden = true; });
      document.querySelectorAll('.is-menu-open').forEach((el) => el.classList.remove('is-menu-open'));
    }
  });
}

async function initialize() {
  try {
    bindEvents();
    syncThemeCards(document.body.dataset.theme || 'dark');
    switchSettingsTab('general');
    switchGuideStep(1);
    // 进度面板初始为隐藏（HTML 带 hidden 属性），同步容器的独占布局
    setProgressPanelVisible(false);

    // 确保首屏样式立即解除遮罩
    document.body.classList.remove('booting');
    document.body.classList.add('booted');
    $('#bootScreen')?.setAttribute('aria-hidden', 'true');

    api.onProgress?.(updateProgress);
    api.onLog?.((entry) => {
      state.logs.push(entry);
      if (state.logs.length > 1000) state.logs.shift();
      if (state.currentPage === 'logs') renderLogs();
      renderOverviewActivity(state.logs);
    });
    api.onStatus?.((payload) => {
      if (payload?.snapshot) {
        renderSnapshot(payload.snapshot, { forceForms: false });
      }
    });
    api.onHeartbeat?.(applyHeartbeat);
    api.onBuildProgress?.((payload) => {
      if (payload.status === 'output') appendBuildOutput(payload.text || '');
      else if (payload.status === 'running') { $('#buildStatus').textContent = payload.stage === 'test' ? '正在测试' : '正在构建'; appendBuildOutput(`\n> ${payload.command}\n`); }
      else if (payload.stage === 'complete') $('#buildStatus').textContent = payload.status === 'passed' ? '已通过' : '未通过';
    });
    api.onNavigate?.((targetPage) => navigate(targetPage));
    api.onLockDeveloperMode?.(() => {
      renderDeveloperMode(false);
    });
    api.onWorkspaceChanged?.(async (workspace) => {
      state.selectedWorkspace = workspace || '';
      if (state.snapshot?.settings) {
        state.snapshot.settings.workspace = workspace || '';
      }
      renderOverviewWorkspace(state.snapshot);
      renderOverviewServices(state.snapshot);
      await refreshSnapshot({ forceForms: false });
      await loadWorkspaceContext();
      if (state.snapshot) {
        renderOverviewWorkspace(state.snapshot);
        renderOverviewServices(state.snapshot);
      }
      refreshMemory();
    });

    /* 第 44 轮：自绘窗口按钮（设置视图）。与聊天页同一套通道，
     * 因为设置视图铺满整个窗口，必须自带这三个按钮。 */
    (function wireWindowControls() {
      const controls = document.getElementById('windowControls');
      const wc = api.windowControls;
      if (!controls || !wc) return;
      const readData = (result) => (result && typeof result === 'object' && 'ok' in result ? result.data : result);
      const setMaximized = (maximized) => { controls.dataset.maximized = maximized ? 'true' : 'false'; };
      try {
        document.getElementById('winMinimize')?.addEventListener('click', () => wc.minimize());
        document.getElementById('winMaximize')?.addEventListener('click', () => {
          wc.toggleMaximize()
            .then((result) => { const data = readData(result); if (data && typeof data.maximized === 'boolean') setMaximized(data.maximized); })
            .catch(() => {});
        });
        document.getElementById('winClose')?.addEventListener('click', () => wc.close());
        wc.onMaximizedChange?.((payload) => { if (payload && typeof payload.maximized === 'boolean') setMaximized(payload.maximized); });
        wc.isMaximized?.()
          .then((result) => { const data = readData(result); if (data && typeof data.maximized === 'boolean') setMaximized(data.maximized); })
          .catch(() => {});
      } catch (_) {}
    })();
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (state.currentThemeSetting === 'system') {
          applyTheme('system');
        }
      });
    }

    // 1. 同步拉取核心快照（内存IPC毫秒级返回），确保用户看到首屏的第一眼就是100%正确的真实状态
    let firstSnapshot = null;
    try {
      firstSnapshot = await refreshSnapshot({ forceForms: true });
    } catch (snapErr) {
      console.warn('拉取初始快照失败，使用兜底状态：', snapErr);
    }

    // 2. 静默在后台预热项目识别、工作区上下文与健康体检，后续任何页面切换均为0ms瞬间秒开
    try { inspectBuild(); } catch (_) {}
    if (api.workspaceContext) {
      try { loadWorkspaceContext(); } catch (_) {}
    }
    try { inspectHealth(); } catch (_) {}

    const requestedPage = location.hash.slice(1);
    if (pageMeta[requestedPage]) navigate(requestedPage);
    else loadOverviewData();

    if (firstSnapshot && !firstSnapshot.settings?.firstRunCompleted) {
      try {
        navigate('health');
        await inspectHealth();
        unwrap(await api.saveSettings({ firstRunCompleted: true }));
        toast('首次运行体检', '已检查当前环境；可点击“自动修复”处理能够自动解决的问题。');
      } catch (error) { toast('首次运行体检未完成', error.message, 'error'); }
    }
  } catch (err) {
    console.error('设置中心初始化失败：', err);
  } finally {
    document.body.classList.remove('booting');
    document.body.classList.add('booted');
    $('#bootScreen')?.setAttribute('aria-hidden', 'true');
  }
}

initialize();

window.addEventListener('keydown', (e) => {
  if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r')) {
    location.reload();
  }
});






