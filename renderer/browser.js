const api = window.browserAssistant;
const $ = (selector) => document.querySelector(selector);
let switching = false;
let activeWorkspace = '';
let lastRuntimeState = null;
let lastRuntimeCheckAt = 0;

/* ── 主题接线 ───────────────────────────────────────────────────────────────
 * 第 42 轮。在此之前 browser.js 全文没有一处 theme —— 聊天页从不写
 * data-theme，于是 browser.css 里整套 `[data-theme="dark"]` 规则是死代码，
 * 深色模式下聊天页永久白底（实测顶栏恒为 rgba(255,255,255,.98)）。
 *
 * 首帧由 theme-bootstrap.js 用 URL 参数（main.js 的 loadFile query）定色，
 * 这里只负责**后续跟随**：主进程每次重算原生标题栏都会顺便推来已解析的
 * 'dark'/'light'，两处因此永远同拍。
 *
 * 只写 <html> 与 <body> 的 data-theme，不做别的 —— 换主题不等于重排版面，
 * 颜色全部由 browser.css 的令牌覆盖承担。 */
function applyChatTheme(theme) {
  const resolved = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = resolved;
  document.body.dataset.theme = resolved;
}
try { api?.onThemeChange?.(applyChatTheme); } catch (_) {}

/* 第 44 轮：自绘窗口按钮（最小化 / 最大化-还原 / 关闭）。
 * 语义与原生按钮一致；最大化/还原图标由主进程广播的 window:maximized-changed 驱动，
 * 这样双击拖拽区最大化、Win+↑ 等外部途径也能让图标跟上。 */
(function wireWindowControls() {
  const controls = document.getElementById('windowControls');
  const wc = api?.windowControls;
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

function unwrap(result) {
  if (!result?.ok) throw new Error(result?.error || '操作失败');
  return result.data;
}

function baseName(value) {
  return String(value || '').replace(/[\\/]+$/, '').split(/[\\/]/).pop() || value || '未选择';
}

/* 第 41 轮：这里的宽度测量（`measureContext` / `textWidth` / `displayWidth`）
 * 与路径**中间省略**（`middleEllipsis`）四个声明已整体删除 ——
 * 它们在界面重写后**没有任何调用点**：工作区切换器改成只显示末段目录名
 * （`baseName()`，整段完整），完整路径由 `title` 与展开菜单承担，
 * 于是"算到像素级的中间省略"不再需要。
 *
 * 删除前它们是被测试真跑过的（tests/toolbar-round32.test.js 曾在 VM 里
 * 断言"末段完整 / 预算边界 / 无预算不膨胀"），所以这次一并把那些断言
 * 换成"这套实现不得悄悄回来"，原意图（末段不许切成残词 + 完整路径必须
 * 可查）由该文件 ⑥⑦ 两条继续守着。历史实现见 git。
 *
 * 留一句教训：中间省略当初必须自己写是因为 `text-overflow:ellipsis`
 * 只会省略**末尾**，而路径里有信息量的是最后一段目录名 ——
 * 将来若又要做两端省略，别忘了这条（以及 `budget` 非法时
 * `slice(NaN)` 会拼出比原文更长的串那个坑）。 */
function formatDuration(milliseconds) {
  const seconds = Math.max(0, Math.floor(Number(milliseconds || 0) / 1000));
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return `${minutes}分${rest}秒`;
  return `${Math.floor(minutes / 60)}小时${minutes % 60}分`;
}

function backgroundOperationStatus(operation) {
  const status = String(operation?.status || '');
  if (status === 'interrupted') return '后台任务已中断，可恢复';
  if (status === 'failed') return '后台任务执行失败';
  if (status === 'completed') return '后台任务已完成';
  if (status !== 'running') return '';
  const heartbeatAge = Number(operation?.heartbeat_age_seconds ?? 0);
  if (heartbeatAge >= 15) return `后台任务心跳异常（${heartbeatAge}秒未更新）`;
  return '后台任务运行正常';
}

function humanizeTaskText(value) {
  const raw = String(value || '').trim();
  const key = raw.toLowerCase();
  const labels = {
    'waiting for model': '等待模型继续处理',
    'waiting for user': '等待你处理',
    completed: '已完成',
    'verification failed': '验证失败',
    'requested check failed': '检查失败',
    'running requested checks': '正在执行检查',
    'run complete agent workflow': '正在执行完整任务',
    'apply workspace changes': '正在修改项目',
    'run requested checks': '正在验证修改',
    'finalize verified result': '正在整理结果'
  };
  return labels[key] || raw;
}

function progressForTask(task, status) {
  if (status === 'completed') return 100;
  const steps = Array.isArray(task?.steps) ? task.steps : [];
  if (steps.length) {
    const completed = steps.filter((step) => String(step?.status || '') === 'completed').length;
    const active = steps.filter((step) => ['in_progress', 'active', 'running'].includes(String(step?.status || ''))).length;
    return Math.max(status === 'active' ? 5 : 0, Math.min(95, Math.round(((completed + active * 0.5) / steps.length) * 100)));
  }
  const kind = String(task?.current_command?.kind || '');
  if (kind === 'build') return 85;
  if (kind === 'test') return 72;
  if (kind === 'command') return 52;
  const step = String(task?.current_step || '').toLowerCase();
  if (step.includes('completed')) return 100;
  if (step.includes('build')) return 82;
  if (step.includes('test') || step.includes('verify')) return 70;
  if (step.includes('apply') || step.includes('modify') || step.includes('patch')) return 42;
  if (status === 'waiting') return 62;
  if (status === 'paused') return 50;
  if (status === 'failed' || status === 'stopped') return 100;
  return status === 'active' ? 18 : 0;
}

/* 第 32 轮（用户第 3 条）：进度徽标的读法改成 `(45%)`。
 *
 * 改前是 '100%' / '18%' / '2/5' 这类裸值，靠着任务名显示；现在它跟在
 * 「正在构建」这样的阶段词后面，加括号才读成一句：
 *   `[ 🔵 正在构建 (45%) ]`   ← 用户给的例子正是这个形态。
 * 非百分比的状态（失败/已停止/等待/N of M）不加括号 ——
 * 括号表达的是"这是同一句话里的补充数值"，而这些本身就是结论词。 */
function progressLabelForTask(task, status, runningOperation, command, progress) {
  if (runningOperation || (command && String(command.status || '') === 'running')) return `(${progress}%)`;
  if (status === 'completed') return '(100%)';
  if (status === 'failed') return '失败';
  if (status === 'stopped') return '已停止';
  if (status === 'paused') return `(${progress}%)`;
  if (status === 'waiting') return '等待';
  const steps = Array.isArray(task?.steps) ? task.steps : [];
  if (steps.length) {
    const completed = steps.filter((step) => String(step?.status || '') === 'completed').length;
    return `${completed}/${steps.length}`;
  }
  return status === 'active' ? `(${progress}%)` : '';
}

function renderChatState(state) {
  if (!state) return;
  $('#backButton').disabled = !state.canGoBack;
  $('#forwardButton').disabled = !state.canGoForward;
  const element = $('#pageState');
  element.classList.toggle('loading', Boolean(state.loading));
  element.classList.toggle('ready', !state.loading && !state.error);
  element.classList.toggle('error', Boolean(state.error));
  element.querySelector('span').textContent = state.error
    ? `加载失败：${state.error}`
    : state.isVerification
      ? '正在进行安全验证…'
      : state.loading ? '正在切换页面…' : 'ChatGPT 已就绪';
  /* 第 26 轮：就绪态不再占位。
   * 原先这个元素恒占 210px 显示「ChatGPT 已就绪」，但"已就绪"是默认状态、
   * 不含任何新信息 —— 它是工具栏里最宽的单个元素之一，天天挂着纯属浪费。
   * 只在**过渡与异常**时显示：
   *   loading → 「正在切换页面…」  有信息量（用户在等）
   *   error   → 「加载失败：…」   承重功能，是用户唯一能看到失败原因的地方
   * 注意别把 hidden 与 loading 搞混：hidden 在 setSession 场景（冷启动）下最初为 true，
   * 首次 chat:state 到达前什么也不显示 —— 这是想要的（占位由 .loading-stage 承担）。 */
  element.hidden = !state.loading && !state.error;
}

/* ★ 胶囊文案抽成**纯函数**，不碰 DOM。
 * 理由不只是"好测"：这段逻辑有三条分支和一个"检查中"的边界态，
 * 是本轮新增的唯一一处判断逻辑。它留在 renderXxx 里就只能靠正则断言
 * —— 而正则断言不出"两项都断时该说几项"。抽出来后测试可以**真跑**它，
 * 逐档比较输出，这样"2 项异常"这种数字就不会悄悄算错。 */
function healthPillText(mcpRunning, tunnelRunning, checking) {
  if (checking) return '状态检查中';
  const abnormal = [];
  if (!mcpRunning) abnormal.push('本地工具');
  if (!tunnelRunning) abnormal.push('连接通道');
  /* 三档文案的取值理由：
   *   · 0 项异常 → 「服务正常」（结论，最短）
   *   · 1 项异常 → 直接点名那一项（「连接通道未就绪」）——
   *     只有一项异常时，说出是哪一项比说"1 项异常"有用得多，
   *     因为用户下一步就是去修它。
   *   · 2 项异常 → 「服务未启动 · 2 项异常」（用户给的示例形态）——
   *     两项都断时点名没有意义（"都断了"），数量才是信息。 */
  if (abnormal.length === 0) return '服务正常';
  if (abnormal.length === 1) return `${abnormal[0]}未就绪`;
  return `服务未启动 · ${abnormal.length} 项异常`;
}

function renderHealthPill(mcpRunning, tunnelRunning) {
  const pill = $('#healthPill');
  const text = $('#healthPillText');
  const dot = pill?.querySelector('i');
  if (!pill || !text || !dot) return;
  const checking = !lastRuntimeState;
  const isHealthy = !checking && mcpRunning && tunnelRunning;
  const hasError = !checking && !(mcpRunning && tunnelRunning);
  dot.classList.toggle('ready', isHealthy);
  dot.classList.toggle('warn', hasError);
  text.textContent = healthPillText(mcpRunning, tunnelRunning, checking);
  pill.classList.toggle('has-error', hasError);
  pill.classList.toggle('is-healthy', isHealthy);
  if (hasError) {
    pill.title = `服务异常（本地工具：${mcpRunning ? '运行中' : '未运行'}；连接通道：${tunnelRunning ? '已连接' : '未连接'}）· 点击前往配置`;
  } else if (isHealthy) {
    pill.title = '服务运行正常（本地工具与连接通道均已就绪）';
  } else {
    pill.title = '正在读取本地服务状态…';
  }
}

function renderServiceState(state) {
  lastRuntimeState = state || null;
  lastRuntimeCheckAt = Date.now();
  const mcpRunning = Boolean(state?.mcpRunning);
  const tunnelRunning = Boolean(state?.tunnelRunning);
  /* 明细两行（在 .health-popover 里）继续逐项标状态类。
   * #connectionStateLabel 的文案现在写在 browser.html 里 ——
   * 改前 JS 每次心跳都给它写一遍「连接通道」，但那个字符串从未变过，
   * 是一次恒等的写入（拆开看是"有动态能力"，实际是死代码）。 */
  [['#mcpState', mcpRunning], ['#tunnelState', tunnelRunning]].forEach(([selector, value]) => {
    const element = $(selector);
    element.classList.toggle('ready', value);
    element.classList.toggle('error', !value);
  });
  renderHealthPill(mcpRunning, tunnelRunning);
  renderWorkspaceHealth();
  syncWorkspacePickerState();
}

function renderWorkspaceHealth() {
  /* 第 26 轮：小圆点从独立按钮（#workspaceHealthButton）改成纯视觉指示。
   * ★ 第 32 轮它又变回按钮了，但不是回退：第 26 轮把它降级的原因是
   *   "同一信号被画了两遍"（它读的 state.mcpRunning 正是 #mcpState 显示的），
   *   于是把点击目标合并给整块「当前 xxx」标签。
   *   第 32 轮那块标签本身并进了工作区切换器（点击被"开菜单"占用），
   *   所以同步详情的入口必须重新找地方 —— 这次它不再是"另一个红绿灯"，
   *   而是**一个 16px 的幽灵按钮**：圆点由 ::before 画，不额外占位，
   *   点击靶只有 16px。状态判据一词未改，仍与健康胶囊同源（都读 lastRuntimeState），
   *   所以两处永远不会互相矛盾。 */
  const dot = $('#workspaceHealthDot');
  if (!dot) return;
  const synced = Boolean(activeWorkspace && lastRuntimeState?.mcpRunning);
  dot.classList.toggle('ready', synced);
  dot.classList.toggle('error', Boolean(activeWorkspace) && !synced);
  $('#workspaceHealthName').textContent = baseName(activeWorkspace) || '未选择工作区';
  $('#workspaceHealthPath').textContent = activeWorkspace || '-';
  $('#workspaceHealthState').textContent = !activeWorkspace ? '未选择' : synced ? '✓ 已同步' : lastRuntimeState?.recovering ? '正在恢复' : '等待同步';
  $('#workspaceHealthTime').textContent = lastRuntimeCheckAt ? new Date(lastRuntimeCheckAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-';
  /* 提示语放在这个按钮上（改前在整块标签上）。 */
  dot.title = !activeWorkspace ? '未选择工作区' : synced ? '工作区已与 MCP 同步 · 点击查看详情' : '工作区正在等待 MCP 同步 · 点击查看详情';
}

async function refreshStatus() {
  try { renderServiceState(unwrap(await api.lightweightStatus())); }
  catch { renderServiceState(null); }
}

async function refreshTask() {
  try {
    let runtime = null;
    if (api.taskRuntime) {
      try { runtime = unwrap(await api.taskRuntime()); } catch { runtime = null; }
    }
    let fallbackPayload = null;
    if (!runtime?.state) {
      try { fallbackPayload = unwrap(await api.taskState()); } catch { fallbackPayload = null; }
    }
    let task = runtime?.state || fallbackPayload?.state || null;
    const activeWorktree = runtime?.active_worktree && runtime.active_worktree.exists !== false ? runtime.active_worktree : null;
    const runningOperation = Array.isArray(runtime?.operations)
      ? runtime.operations.filter((item) => item?.status === 'running').slice(-1)[0]
      : null;
    const now = Date.now();
    let status = String(task?.status || (runningOperation ? 'active' : 'idle'));
    if (task && ['completed', 'failed', 'stopped'].includes(status) && !runningOperation && !activeWorktree) {
      const terminalUpdatedAt = Date.parse(task.updated_at || task.created_at || '') || now;
      const keepVisibleMs = status === 'completed' ? 30000 : 120000;
      if (now - terminalUpdatedAt > keepVisibleMs) {
        task = null;
        status = 'idle';
      }
    }
    const strip = $('#taskStrip');
    strip.className = `task-strip ${status}`;
    strip.classList.toggle('isolated', Boolean(activeWorktree));
    /* ★ 第 32 轮（用户第 3 条）：空闲态显式写作「空闲」而不是「暂无任务」。
     *   改前这个位置是任务标题，空闲时填「暂无任务」——四个字加一个 7px 圆点
     *   与进度条，在一条 700px 宽、铺着浅灰底的长条上，看起来像"任务区坏了"。
     *   用户要的是紧凑的 `[ ⚪ 空闲 ]`：一个词，说明"没有任务在跑"，
     *   而"没有任务"本来就是**正常状态**，不该用"暂无"这种缺省语气。 */
    $('#taskTitle').textContent = task?.objective || (runningOperation ? '后台任务运行中' : '空闲');
    if ((!task || status === 'idle') && !runningOperation) {
      $('#taskStep').textContent = '';
      $('#taskProgressBar').style.width = '0%';
      $('#taskProgressText').textContent = '';
      strip.title = '当前没有正在执行的任务';
      return;
    }
    const createdAt = Date.parse(task.created_at || task.updated_at || '') || now;
    const updatedAt = Date.parse(task.updated_at || task.created_at || '') || createdAt;
    const elapsed = formatDuration(now - createdAt);
    const idleFor = now - updatedAt;
    const progress = progressForTask(task, status);
    /* 第 32 轮：阶段说明压成**一句**（改前是 parts.join(' · ') 的四五段）。
     * 这一行现在是 36px 高、任务胶囊 26px，装不下改前那种长句；
     * 而且完整信息本来就在设置页的任务面板里 —— 工具栏这一行只回答
     * "在干什么 + 到哪了"。所以只取最高优先级的一段：
     *   正在跑的后台操作 > 正在跑的构建/测试命令 > 当前步骤。
     * 完整的分段说明保留在 strip.title 里（悬停可看），信息没有丢。 */
    const detailParts = [humanizeTaskText(task?.current_step || task?.next_step) || '任务处理中'];
    if (activeWorktree) detailParts.unshift('安全隔离中');
    if (runningOperation) {
      const operationStartedAt = Date.parse(runningOperation.started_at || '') || (now - Number(runningOperation.elapsed_seconds || 0) * 1000);
      const heartbeatAt = Date.parse(runningOperation.heartbeat_at || '');
      const heartbeatAge = Number.isFinite(heartbeatAt)
        ? Math.max(0, Math.floor((now - heartbeatAt) / 1000))
        : Number(runningOperation.heartbeat_age_seconds || 0);
      const heartbeatText = heartbeatAge >= 15 ? `心跳偏慢 ${heartbeatAge}秒前` : `心跳 ${heartbeatAge}秒前`;
      detailParts.unshift(`${backgroundOperationStatus({ ...runningOperation, heartbeat_age_seconds: heartbeatAge })} · 已运行 ${formatDuration(now - operationStartedAt)} · ${heartbeatText}`);
    }
    const command = task?.current_command && typeof task.current_command === 'object' ? task.current_command : null;
    if (command && String(command.status || '') === 'running') {
      const commandStartedAt = Date.parse(command.started_at || '') || now;
      const kind = { build: '构建', test: '测试', command: '命令' }[String(command.kind || '')] || '命令';
      detailParts.unshift(`${kind} ${formatDuration(now - commandStartedAt)}`);
    }
    if (['active', 'paused'].includes(status)) detailParts.push(`已运行 ${elapsed}`);
    if (status === 'active' && idleFor >= 30000 && !runningOperation) detailParts.push(`最近活动 ${formatDuration(idleFor)}前`);
    if (status === 'active' && idleFor >= 120000 && !runningOperation) detailParts.push('较长时间没有新的任务状态，正在等待下一次更新');
    $('#taskStep').textContent = detailParts.filter(Boolean)[0] || '';
    $('#taskProgressBar').style.width = `${progress}%`;
    $('#taskProgressText').textContent = progressLabelForTask(task, status, runningOperation, command, progress);
    strip.title = `${detailParts.filter(Boolean).join(' · ')}\n状态：${status}；阶段进度：${progress}%；最后更新：${new Date(updatedAt).toLocaleString('zh-CN')}`;
  } catch { /* no active workspace/task yet */ }
}

/* 第 29 轮新增（用户第 10 条）：把"现在能不能切换"提前画出来。
 *
 * 实测发现的真问题：
 *   heartbeat payload 里**早就有 busy 字段**（orchestrator.snapshot 第 460 行），
 *   它表示"助手正在启动/部署中，不接受工作区切换"，但前端**从来没用过它**。
 *   于是用户在助手自启动的那十几秒里点开下拉选一个工作区，
 *   得到的是红色错误「当前已有任务正在运行。」—— 一次白白的误操作。
 *
 * 现在 renderServiceState（heartbeat 到达时）会调它，把下拉与按钮置灰，
 * 并在 title 上说明原因。busy 结束时下一次心跳会自动恢复可用。
 *
 * 与 renderWorkspace 里那条 select.disabled 的分工：
 *   · renderWorkspace 管"有没有可切目标"（数据条件，15 秒轮询一次）；
 *   · syncWorkspacePickerState 管"现在允许不允许切"（运行时条件，心跳驱动）。
 *   两者是"与"的关系，所以这里必须**重新计算**而不能直接 disable = busy，
 *   否则会把"没有其它工作区"这条判断覆盖掉。 */
function syncWorkspacePickerState() {
  const select = $('#workspaceSelect');
  const add = $('#addWorkspace');
  if (!select) return;
  const hasTargets = [...select.options].some((option) => option.value);
  const busy = Boolean(lastRuntimeState?.busy);
  select.disabled = !hasTargets || busy;
  if (add) add.disabled = busy;
  const reason = busy
    ? '助手正在启动或部署，期间不能切换工作区'
    : hasTargets ? `可切换的最近工作区：${[...select.options].filter((o) => o.value).length} 个`
      : '还没有其它工作区，用下方「添加工作区」';
  select.title = reason;
  if (add) add.title = reason;
  $('#workspaceTrigger')?.classList.toggle('disabled', busy);
  const chips = document.querySelectorAll('.workspace-chip:not(.active)');
  chips.forEach((chip) => {
    chip.disabled = busy;
    if (busy) chip.title = '助手正在启动或部署，期间不能切换工作区';
  });
}

function renderWorkspace(hub) {
  activeWorkspace = hub.activeWorkspace || '';
  const projectName = activeWorkspace ? baseName(activeWorkspace) : '未选择项目';
  const projectLabel = $('#activeProjectLabel');
  if (projectLabel) {
    projectLabel.textContent = projectName;
    projectLabel.title = activeWorkspace ? `项目：${projectName}` : '未选择项目';
  }
  const label = $('#activeWorkspaceLabel');
  if (label) {
    label.textContent = activeWorkspace ? `当前工作区：${projectName}` : '尚未选择工作区';
    label.title = activeWorkspace ? `当前工作区：${projectName} (${activeWorkspace})` : '未选择工作区';
  }
  const menuPath = $('#workspaceMenuPath');
  if (menuPath) {
    menuPath.textContent = activeWorkspace || '尚未选择工作目录';
    menuPath.title = activeWorkspace || '';
  }
  const trigger = $('#workspaceTrigger');
  if (trigger) trigger.title = activeWorkspace ? `当前项目与工作区：${activeWorkspace}` : '切换工作区';
  renderWorkspaceHealth();

  const others = (hub.recentWorkspaces || []).filter((workspace) => workspace && workspace !== activeWorkspace);

  /* 渲染自定义分层下拉列表 */
  const menuList = $('#workspaceMenuList');
  if (menuList) {
    menuList.replaceChildren();
    if (activeWorkspace) {
      const curItem = document.createElement('div');
      curItem.className = 'workspace-menu-item active';
      curItem.innerHTML = `<span class="workspace-menu-item-check" aria-hidden="true">✓</span><span class="workspace-menu-item-name" title="${activeWorkspace}">${baseName(activeWorkspace)}</span><span class="workspace-menu-badge">当前</span>`;
      menuList.appendChild(curItem);
    }
    others.forEach((ws) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'workspace-menu-item';
      item.title = `点击切换到工作区：${ws}`;
      item.innerHTML = `<span class="workspace-menu-item-dot" aria-hidden="true"></span><span class="workspace-menu-item-name">${baseName(ws)}</span>`;
      item.onclick = (e) => {
        e.stopPropagation();
        toggleWorkspaceMenu(true);
        switchWorkspace(ws, true);
      };
      menuList.appendChild(item);
    });
    if (!activeWorkspace && others.length === 0) {
      const emptyHint = document.createElement('div');
      emptyHint.className = 'workspace-menu-empty';
      emptyHint.textContent = '暂无工作区，请在设置中添加';
      menuList.appendChild(emptyHint);
    }
  }

  /* 兼容历史测试用例的 select 与 list 占位 */
  const select = $('#workspaceSelect');
  if (select) {
    select.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '选择要切换的工作区…';
    select.appendChild(placeholder);
    others.forEach((ws) => {
      const option = document.createElement('option');
      option.value = ws;
      option.textContent = baseName(ws);
      select.appendChild(option);
    });
    select.disabled = others.length === 0;
  }
  const list = $('#workspaceList');
  if (list) list.replaceChildren();

  syncWorkspacePickerState();
}

async function refreshWorkspace() {
  try { renderWorkspace(unwrap(await api.workspaceHub())); }
  catch { /* retain the last usable workspace state */ }
}

/* 第 29 轮（用户第 10 条）：这一行的状态文案原来只写进 #switchState，
 * 那是个 78px 的角落小字 —— 切换要跑 switchMcpWorkspace + probeMcp（实测约 1.5 秒），
 * 期间整条工具栏看上去**完全静止**。用户说的"不会跟着切换"里，
 * 有相当一部分其实是"看不出它在切"。
 *
 * setSwitchFeedback 做两件事：
 *   · 写文案（并切 data-phase，供 CSS 决定颜色）；
 *   · 在切换期间给 .workspace-bar 加 .switching —— 由 CSS 画一条扫过的高亮，
 *     这是"它真的在动"的唯一可见证据。
 * 失败态用 error 而不是让文案自己变红：颜色属于 CSS，JS 只声明语义阶段。 */
function setSwitchFeedback(text, phase = '') {
  const node = $('#switchState');
  if (node) {
    node.textContent = text || '';
    if (phase) node.dataset.phase = phase;
    else delete node.dataset.phase;
    /* 空文案时不留占位空隙 —— 这一行宽度紧张，一个常驻的空 span 会白占 gap。 */
    node.hidden = !text;
  }
  document.querySelector('.workspace-bar')?.classList.toggle('switching', phase === 'busy');
}

async function switchWorkspace(workspace, showProgress = true) {
  if (switching || !workspace || workspace === activeWorkspace) return;
  switching = true;
  if (showProgress) setSwitchFeedback(`正在切换到 ${baseName(workspace)}…`, 'busy');
  try {
    unwrap(await api.switchWorkspace(workspace));
    /* 先刷新，再宣布成功 —— 顺序反了会出现"已就绪"与旧标签同屏的瞬间。 */
    await Promise.all([refreshWorkspace(), refreshStatus(), refreshTask()]);
    setSwitchFeedback(`已切换到 ${baseName(activeWorkspace)}`, 'done');
    /* 完成态保留 2.4 秒（原 1.8 秒）：切换本身耗时约 1.5 秒，
     * 用户读完"正在切换"之后还需要时间看到结论。 */
    setTimeout(() => setSwitchFeedback(''), 2400);
  } catch (error) {
    setSwitchFeedback(error.message, 'error');
  } finally {
    switching = false;
    document.querySelector('.workspace-bar')?.classList.remove('switching');
  }
}

async function navigate(action) {
  try { unwrap(await api.navigate(action)); }
  catch (error) { renderChatState({ error: error.message }); }
}

$('#backButton').onclick = () => navigate('back');
$('#forwardButton').onclick = () => navigate('forward');
$('#reloadButton').onclick = () => navigate('reload');
/* 第 28 轮：删除了 #homeButton 的绑定（品牌按钮整个移除，理由见 browser.html 顶部注释）。
 * chat:navigate 的 'home' 分支**保留**在 electron/chatViewController.js ——
 * 设置页「清除 ChatGPT 登录数据」→ clearSession() → loadHome() 仍在用它，
 * 那是清除 Cookie 后必须重新落到登录页的真实需求。
 * 也就是说：UI 上少了一个入口，而不是这个动作被删掉了。 */

/* ── 三个浮层的开合 ──────────────────────────────────────────────────────
 *
 * ★ 第 32 轮的结构变成"一个切换器 + 一个健康点 + 一个健康胶囊"，
 *   每个都可能弹出一层浮层。三者必须**互斥**，理由有两层：
 *   ① 它们都从工具栏的两行**往下**弹，落点会互相重叠；
 *   ② 更实际的是：三个浮层两两重叠时，用户分不清眼前这块属于谁。
 *   所以任何一次开合都先把另外两个关掉。
 *
 * 为什么用 stopPropagation + 一个 document 级关闭，而不是逐层判断 contains：
 *   改前是后者（document 的 click 里查 label/popover 是否 contains target），
 *   每加一层就要加一个判断 —— 漏一个就是"点它自己反而把自己关掉"。
 *   现在是"每个浮层与它的触发器自己吃掉点击，其余一律关"，
 *   新增浮层时只需要给它加一行 stopPropagation，不会再漏。 */
function toggleWorkspaceMenu(force) {
  const menu = $('#workspaceMenu');
  const trigger = $('#workspaceTrigger');
  if (!menu || !trigger) return;
  const nextHidden = typeof force === 'boolean' ? force : !menu.hidden;
  menu.hidden = nextHidden;
  trigger.setAttribute('aria-expanded', String(!nextHidden));
  if (!nextHidden) {
    toggleWorkspacePopover(true);
    toggleHealthPopover(true);
  }
}

function toggleWorkspacePopover(force) {
  const popover = $('#workspaceHealthPopover');
  if (!popover) return;
  const nextHidden = typeof force === 'boolean' ? force : !popover.hidden;
  popover.hidden = nextHidden;
  if (!nextHidden) {
    toggleWorkspaceMenu(true);
    toggleHealthPopover(true);
  }
}

function toggleHealthPopover(force) {
  const popover = $('#healthPopover');
  if (popover) popover.hidden = true;
}

let isWorkspaceDropdownOpen = false;
let lastDropdownClosedTime = 0;
let wasDropdownOpenOnMouseDown = false;

async function toggleWorkspaceDropdownMenu() {
  const trigger = $('#workspaceTrigger');
  if (!trigger) return;

  const now = Date.now();
  // 1. 如果在鼠标按下时菜单已是打开状态，或者刚通过 blur 关闭不足 280ms，
  // 说明当前点击事件是失焦触发的附带点击，用户的本意是“收起菜单”，此时绝不重新打开
  if (wasDropdownOpenOnMouseDown || (now - lastDropdownClosedTime < 280)) {
    wasDropdownOpenOnMouseDown = false;
    isWorkspaceDropdownOpen = false;
    trigger.setAttribute('aria-expanded', 'false');
    api.closeWorkspaceDropdown?.();
    return;
  }

  // 2. 正常状态判断：如果已打开，则收起
  if (isWorkspaceDropdownOpen) {
    isWorkspaceDropdownOpen = false;
    trigger.setAttribute('aria-expanded', 'false');
    api.closeWorkspaceDropdown?.();
    return;
  }

  toggleWorkspacePopover(true);
  toggleHealthPopover(true);
  if (isHealthDropdownOpen) {
    isHealthDropdownOpen = false;
    api.closeHealthDropdown?.();
    // ★ 跨菜单去抖：同步戳上健康浮层的最近关闭时间，
    // 这样即便用户立刻反手点健康胶囊，也会被它的 320ms 守卫挡住，
    // 杜绝「工作区↔健康」快速来回切换时两个 BrowserWindow 同时可见。
    lastHealthDropdownClosedTime = Date.now();
  }
  isWorkspaceDropdownOpen = true;
  trigger.setAttribute('aria-expanded', 'true');
  const switcher = $('#workspaceSwitcher') || trigger;
  const rect = switcher.getBoundingClientRect();
  try {
    if (api.popupWorkspaceDropdown) {
      await api.popupWorkspaceDropdown({
        x: rect.left,
        y: rect.bottom,
        width: rect.width,
        height: rect.height
      });
    } else if (api.popupWorkspaceMenu) {
      await api.popupWorkspaceMenu({
        x: rect.left,
        y: rect.bottom + 2
      });
      isWorkspaceDropdownOpen = false;
      trigger.setAttribute('aria-expanded', 'false');
      await refreshWorkspace();
    } else {
      toggleWorkspaceMenu();
    }
  } catch {
    isWorkspaceDropdownOpen = false;
    trigger.setAttribute('aria-expanded', 'false');
  }
}

api.onWorkspaceDropdownClosed?.(() => {
  isWorkspaceDropdownOpen = false;
  lastDropdownClosedTime = Date.now();
  const trigger = $('#workspaceTrigger');
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
  refreshWorkspace();
});

api.onHealthDropdownClosed?.(() => {
  isHealthDropdownOpen = false;
  lastHealthDropdownClosedTime = Date.now();
});

/* 浮层内部点击与关闭绑定：点击健康详情自身或关闭按钮可立即收起，彻底杜绝遮挡卡死 */
if ($('#workspaceMenu')) $('#workspaceMenu').onclick = (event) => event.stopPropagation();
$('#workspaceHealthPopover').onclick = () => toggleWorkspacePopover(true);
$('#workspaceHealthClose').onclick = (event) => { event.stopPropagation(); toggleWorkspacePopover(true); };
$('#healthPopover').onclick = (event) => event.stopPropagation();
/* 第 41 轮：这里原来还有一个 #healthActionBtn 的点击绑定（前往配置）。
 * 那个按钮已经删掉 —— 它在永久隐藏的弹层里、没有任何样式，永远不可达；
 * 「前往配置」这个能力由可见的 #healthPill 承担（异常态点击进设置页）。 */
/* 三个触发器自己处理开合，并把点击吃掉（不落到 document 的"关闭一切"上）。 */
const wsTrigger = $('#workspaceTrigger');
if (wsTrigger) {
  wsTrigger.addEventListener('mousedown', () => {
    // 记录鼠标按下瞬间菜单是否打开（此时尚未触发失焦关闭）
    wasDropdownOpenOnMouseDown = isWorkspaceDropdownOpen;
  });
  wsTrigger.onclick = (event) => {
    event.stopPropagation();
    toggleWorkspaceDropdownMenu();
  };
}
$('#workspaceHealthDot').onclick = (event) => {
  event.stopPropagation();
  toggleWorkspaceDropdownMenu();
};
let isHealthDropdownOpen = false;
let lastHealthDropdownClosedTime = 0;
let wasHealthDropdownOpenOnMouseDown = false;

function toggleHealthDropdown() {
  const pill = $('#healthPill');
  if (!pill) return;

  const now = Date.now();
  // 1. 如果在鼠标按下瞬间浮层是打开的，或者刚通过失焦关闭不足 320ms，
  // 说明当前点击是失焦触发的附带点击，用户的明确意图是“收起浮层”，此时绝不重新打开，彻底根除高频振荡频闪！
  if (wasHealthDropdownOpenOnMouseDown || (now - lastHealthDropdownClosedTime < 320)) {
    wasHealthDropdownOpenOnMouseDown = false;
    isHealthDropdownOpen = false;
    api.closeHealthDropdown?.();
    return;
  }

  // 2. 正常状态判断：如果当前已打开，则收起
  if (isHealthDropdownOpen) {
    isHealthDropdownOpen = false;
    api.closeHealthDropdown?.();
    return;
  }

  // 3. 先关闭工作区下拉菜单，杜绝任何可能的界面层叠！
  if (isWorkspaceDropdownOpen) {
    isWorkspaceDropdownOpen = false;
    const trigger = $('#workspaceTrigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    api.closeWorkspaceDropdown?.();
    // ★ 跨菜单去抖：同步戳上工作区浮层的最近关闭时间，
    // 让它的 280ms 守卫立刻进入保护窗口，防止两个 BrowserWindow 同时可见。
    lastDropdownClosedTime = Date.now();
  }
  toggleWorkspaceMenu(true);
  toggleWorkspacePopover(true);

  // 4. 获取当前健康胶囊在窗口中的精确实时矩形边界
  const rect = pill.getBoundingClientRect();
  isHealthDropdownOpen = true;

  if (api.popupHealthDropdown) {
    api.popupHealthDropdown({
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    }).catch(() => {
      isHealthDropdownOpen = false;
    });
  }
}

const pillBtn = $('#healthPill');
if (pillBtn) {
  pillBtn.addEventListener('mousedown', () => {
    // 关键：在鼠标按下的瞬间（子窗口尚未发生 blur 之前）精确捕获浮层的打开状态！
    wasHealthDropdownOpenOnMouseDown = isHealthDropdownOpen;
  });
  pillBtn.onclick = (event) => {
    event.stopPropagation();
    toggleHealthDropdown();
  };
}

if ($('#manageWorkspacesButton')) {
  $('#manageWorkspacesButton').onclick = (event) => {
    event.stopPropagation();
    toggleWorkspaceMenu(true);
    api.openSettings('workspace');
  };
}
/* 点到任何别的地方 → 全部关闭。Esc 同样。
 * （改前这里只关工作区弹层；现在是"关掉所有浮层"，与上面的互斥开合对称。） */
document.addEventListener('click', () => {
  if (isWorkspaceDropdownOpen) {
    isWorkspaceDropdownOpen = false;
    const trigger = $('#workspaceTrigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    api.closeWorkspaceDropdown?.();
  }
  if (isHealthDropdownOpen) {
    isHealthDropdownOpen = false;
    api.closeHealthDropdown?.();
  }
  toggleWorkspaceMenu(true);
  toggleWorkspacePopover(true);
  toggleHealthPopover(true);
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (isHealthDropdownOpen) {
    isHealthDropdownOpen = false;
    api.closeHealthDropdown?.();
  }
  toggleWorkspaceMenu(true);
  toggleWorkspacePopover(true);
  toggleHealthPopover(true);
});

$('#managerButton').onclick = () => api.openSettings('overview');

// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// 右侧抽屉侧边栏：技能（Skills）与快捷指令（Prompts）系统
// 彻底解决 WebContentsView 遮挡，保持与主视图无缝联动
// ═══════════════════════════════════════════════════════════════════
// 右侧抽屉侧边栏：技能（Skills）与快捷指令（Prompts）系统
// 彻底解决 WebContentsView 遮挡，为大屏与自定义宽度提供平滑拖拽与舒适字号
// ═══════════════════════════════════════════════════════════════════
const SIDEBAR_MIN_WIDTH = 320;
const SIDEBAR_MAX_WIDTH = 880;
let currentSidebarWidth = (() => {
  try {
    const saved = Number(localStorage.getItem('gpt_sidebar_width'));
    if (saved && saved >= SIDEBAR_MIN_WIDTH && saved <= SIDEBAR_MAX_WIDTH) return saved;
  } catch (_) {}
  return 420; // 默认采用更舒适舒展的 420px 宽度
})();

// 同步初始化 CSS 变量并确保冷启动默认完全收起
document.documentElement.style.setProperty('--current-sidebar-width', `${currentSidebarWidth}px`);
const initialSidebar = $('#rightSidebar');
if (initialSidebar) {
  initialSidebar.hidden = true;
  initialSidebar.style.display = 'none';
}
document.body.classList.remove('sidebar-opened');
if (api.setSidebarWidth) {
  api.setSidebarWidth(0).catch(() => {});
}

let isRightSidebarOpen = false;
let activeSidebarTab = 'skills';
let sidebarSearchQuery = '';
let sidebarPromptCategory = '全部';
let cachedSkills = [];
let cachedPrompts = [];

function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getDrawerSkillIconSvg(iconKey) {
  const icon = String(iconKey || 'star').toLowerCase();
  switch (icon) {
    case 'code':
      return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;
    case 'test':
      return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2v6h6"/><path d="M4 14l5-5"/><path d="M16 4v4h4"/><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`;
    case 'clean':
      return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`;
    case 'arch':
      return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`;
    case 'star':
    default:
      return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  }
}

let sidebarSeq = 0;

function toggleRightSidebar(forceOpen, targetTab) {
  const sidebar = $('#rightSidebar');
  const skillsBtn = $('#skillsButton');
  const promptsBtn = $('#promptsButton');
  if (!sidebar) return;

  const shouldOpen = forceOpen !== undefined
    ? Boolean(forceOpen)
    : (!isRightSidebarOpen || (targetTab && activeSidebarTab !== targetTab));

  if (targetTab) {
    activeSidebarTab = targetTab;
  }

  isRightSidebarOpen = shouldOpen;
  sidebar.hidden = !shouldOpen;
  sidebar.style.display = shouldOpen ? 'flex' : 'none';
  if (shouldOpen) {
    sidebar.style.width = `${currentSidebarWidth}px`;
  }
  document.body.classList.toggle('sidebar-opened', shouldOpen);

  // 顶栏功能按键高亮状态同步
  if (skillsBtn) {
    const isCur = shouldOpen && activeSidebarTab === 'skills';
    skillsBtn.classList.toggle('active', isCur);
    skillsBtn.setAttribute('aria-expanded', String(isCur));
  }
  if (promptsBtn) {
    const isCur = shouldOpen && activeSidebarTab === 'prompts';
    promptsBtn.classList.toggle('active', isCur);
    promptsBtn.setAttribute('aria-expanded', String(isCur));
  }

  // 核心：非阻塞通知底层调整 ChatGPT 视图宽度，防止等待 IPC 导致 UI 顿挫或死锁
  const sidebarWidth = shouldOpen ? currentSidebarWidth : 0;
  if (api.setSidebarWidth) {
    api.setSidebarWidth(sidebarWidth).catch(() => {});
  }

  if (shouldOpen) {
    updateSidebarTabUi();
    // 立即使用已有缓存极速渲染，杜绝白屏与等待
    if (activeSidebarTab === 'skills') renderSidebarSkills();
    else renderSidebarPrompts();

    const currentSeq = ++sidebarSeq;
    refreshSidebarData().then(() => {
      // 若在后台数据获取期间侧边栏已被关闭或切换，丢弃过期刷新
      if (currentSeq !== sidebarSeq || !isRightSidebarOpen) return;
      if (activeSidebarTab === 'skills') renderSidebarSkills();
      else renderSidebarPrompts();
    }).catch(() => {});

    setTimeout(() => $('#sidebarSearchInput')?.focus(), 50);
  }
}

function updateSidebarTabUi() {
  const tabSkills = $('#tabSkillsBtn');
  const tabPrompts = $('#tabPromptsBtn');
  const chipsBar = $('#sidebarCategoryChips');
  if (tabSkills) tabSkills.classList.toggle('active', activeSidebarTab === 'skills');
  if (tabPrompts) tabPrompts.classList.toggle('active', activeSidebarTab === 'prompts');
  if (chipsBar) chipsBar.hidden = activeSidebarTab !== 'prompts';
}

async function refreshSidebarData() {
  const container = $('#sidebarScrollPanel');
  if (!container) return;

  try {
    if (activeSidebarTab === 'skills') {
      const res = await api.listSkills();
      cachedSkills = unwrap(res) || [];
    } else {
      const res = await api.listPrompts();
      cachedPrompts = unwrap(res) || [];
    }
  } catch (err) {
    if ((activeSidebarTab === 'skills' && !cachedSkills.length) ||
        (activeSidebarTab === 'prompts' && !cachedPrompts.length)) {
      container.innerHTML = `
        <div class="drawer-empty-state">
          <div class="drawer-empty-title">加载失败</div>
          <div class="drawer-empty-desc">${escapeHtml(err.message || '无法获取数据')}</div>
        </div>
      `;
    }
  }
}

function renderSidebarSkills() {
  const container = $('#sidebarScrollPanel');
  if (!container) return;
  const query = String(sidebarSearchQuery || '').trim().toLowerCase();

  const list = cachedSkills.filter((item) => {
    if (item.enabled === false) return false;
    if (!query) return true;
    return (
      String(item.name || '').toLowerCase().includes(query) ||
      String(item.description || '').toLowerCase().includes(query) ||
      String(item.category || '').toLowerCase().includes(query)
    );
  });

  if (!list.length) {
    container.innerHTML = `
      <div class="drawer-empty-state">
        <div class="drawer-empty-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        </div>
        <div class="drawer-empty-title">${query ? '未找到相关技能' : '暂无启用中的技能'}</div>
        <div class="drawer-empty-desc">${query ? '尝试搜索其他关键词' : '可在管理中心启用或新建自定义技能'}</div>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map((item) => {
    const iconSvg = getDrawerSkillIconSvg(item.icon);
    const safeName = escapeHtml(item.name || '未命名技能');
    const safeCat = escapeHtml(item.category || '技能');
    const safeDesc = escapeHtml(item.description || '暂无描述');
    const safePrompt = escapeHtml(String(item.prompt || '').trim());
    return `
      <div class="drawer-card" data-inject-skill="${escapeHtml(item.id)}">
        <div class="drawer-card-head">
          <div class="drawer-card-title-group">
            <div class="drawer-card-icon">${iconSvg}</div>
            <b class="drawer-card-title">${safeName}</b>
          </div>
          <span class="drawer-card-badge">${safeCat}</span>
        </div>
        <div class="drawer-card-desc">${safeDesc}</div>
        <div class="drawer-card-preview">${safePrompt.slice(0, 90)}${safePrompt.length > 90 ? '…' : ''}</div>
        <div class="drawer-card-footer">
          <span class="drawer-fill-hint">
            <span>点击自动填入</span>
            <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
          </span>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-inject-skill]').forEach((card) => {
    card.addEventListener('click', async () => {
      const id = card.dataset.injectSkill;
      const item = cachedSkills.find((s) => s.id === id);
      if (item?.prompt) {
        await doInjectPrompt(item.prompt, item.name, card);
      }
    });
  });
}

function renderSidebarPrompts() {
  const container = $('#sidebarScrollPanel');
  const chipsBar = $('#sidebarCategoryChips');
  if (!container) return;

  // 渲染分类胶囊
  if (chipsBar) {
    const cats = new Set(['全部']);
    cachedPrompts.forEach((p) => {
      if (p.category && p.category.trim()) cats.add(p.category.trim());
    });
    chipsBar.innerHTML = [...cats].map((cat) => {
      const isCur = sidebarPromptCategory === cat;
      return `<button type="button" class="sidebar-cat-chip ${isCur ? 'active' : ''}" data-cat="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`;
    }).join('');

    chipsBar.querySelectorAll('.sidebar-cat-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        sidebarPromptCategory = btn.dataset.cat || '全部';
        renderSidebarPrompts();
      });
    });
  }

  const query = String(sidebarSearchQuery || '').trim().toLowerCase();
  const list = cachedPrompts.filter((item) => {
    if (sidebarPromptCategory !== '全部' && item.category !== sidebarPromptCategory) return false;
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
      <div class="drawer-empty-state">
        <div class="drawer-empty-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        </div>
        <div class="drawer-empty-title">${query ? '未找到相关指令' : '暂无指令模版'}</div>
        <div class="drawer-empty-desc">可在管理中心添加自定义快捷指令模版</div>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map((item) => {
    const safeTitle = escapeHtml(item.title || '未命名指令');
    const safeCat = escapeHtml(item.category || '通用');
    const safeDesc = escapeHtml(item.description || '');
    const safeContent = escapeHtml(String(item.content || '').trim());
    return `
      <div class="drawer-card" data-inject-prompt="${escapeHtml(item.id)}">
        <div class="drawer-card-head">
          <div class="drawer-card-title-group">
            <b class="drawer-card-title">${safeTitle}</b>
          </div>
          <span class="drawer-card-badge">${safeCat}</span>
        </div>
        ${safeDesc ? `<div class="drawer-card-desc">${safeDesc}</div>` : ''}
        <div class="drawer-card-preview">${safeContent.slice(0, 100)}${safeContent.length > 100 ? '…' : ''}</div>
        <div class="drawer-card-footer">
          <span class="drawer-fill-hint">
            <span>点击自动填入</span>
            <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
          </span>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-inject-prompt]').forEach((card) => {
    card.addEventListener('click', async () => {
      const id = card.dataset.injectPrompt;
      const item = cachedPrompts.find((p) => p.id === id);
      if (item?.content) {
        await doInjectPrompt(item.content, item.title, card);
      }
    });
  });
}

const injectRateLimiter = {
  lastText: '',
  lastTime: 0
};

async function doInjectPrompt(text, title = '指令', cardEl = null) {
  const cleanText = String(text || '').trim();
  const now = Date.now();

  // 1. 严格限制重复点击与频率保护：正在处理中或 3.5 秒内重复点击相同指令直接拦截，杜绝无限制填入
  if (cardEl && cardEl.classList.contains('is-injecting')) {
    return;
  }
  if (injectRateLimiter.lastText === cleanText && (now - injectRateLimiter.lastTime < 3500)) {
    if (cardEl) {
      const hint = cardEl.querySelector('.drawer-fill-hint');
      if (hint) {
        hint.innerHTML = `<span style="color:#f59e0b;font-weight:600;">已在对话框中，请勿重复填入</span>`;
        setTimeout(() => {
          hint.innerHTML = `<span style="color:#10b981;font-weight:600;">已自动填入 ✓</span>`;
        }, 1800);
      }
    }
    return;
  }

  if (cardEl) {
    cardEl.classList.add('is-injecting');
    const hint = cardEl.querySelector('.drawer-fill-hint');
    if (hint) {
      hint.innerHTML = `<span style="color:#3b82f6;font-weight:600;">正在填入…</span>`;
    }
  }

  try {
    const res = await api.insertPrompt(cleanText);
    injectRateLimiter.lastText = cleanText;
    injectRateLimiter.lastTime = Date.now();

    if (cardEl) {
      const hint = cardEl.querySelector('.drawer-fill-hint');
      if (hint) {
        if (res && res.alreadyPresent) {
          hint.innerHTML = `<span style="color:#f59e0b;font-weight:600;">内容已存在，无需重复填入</span>`;
        } else {
          hint.innerHTML = `<span style="color:#10b981;font-weight:600;">已自动填入 ✓</span>`;
        }
        cardEl.classList.add('is-injected');
        // 填入后进入 4 秒保护锁定，防止用户狂点无限制重复填入；4 秒后变为“再次填入”
        setTimeout(() => {
          cardEl.classList.remove('is-injecting');
          hint.innerHTML = `<span>再次填入</span><svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v4h4M15 12v-4h-4"/><path d="M3.51 9a6 6 0 0 1 9.48-2L15 8M1 8l2.01 1a6 6 0 0 0 9.48 2"/></svg>`;
        }, 4000);
      }
    }
  } catch (_) {
    try {
      await navigator.clipboard.writeText(cleanText);
      if (cardEl) {
        const hint = cardEl.querySelector('.drawer-fill-hint');
        if (hint) {
          hint.innerHTML = `<span style="color:#f59e0b;font-weight:600;">已复制到剪贴板</span>`;
          setTimeout(() => {
            cardEl.classList.remove('is-injecting');
            hint.innerHTML = `<span>点击自动填入</span><svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>`;
          }, 2500);
        }
      }
    } catch {}
  }
}

// 事件绑定
$('#skillsButton')?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleRightSidebar(undefined, 'skills');
});

$('#promptsButton')?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleRightSidebar(undefined, 'prompts');
});

$('#tabSkillsBtn')?.addEventListener('click', (e) => {
  e.stopPropagation();
  activeSidebarTab = 'skills';
  updateSidebarTabUi();
  renderSidebarSkills();
  refreshSidebarData().then(() => {
    if (activeSidebarTab === 'skills' && isRightSidebarOpen) renderSidebarSkills();
  }).catch(() => {});
});

$('#tabPromptsBtn')?.addEventListener('click', (e) => {
  e.stopPropagation();
  activeSidebarTab = 'prompts';
  updateSidebarTabUi();
  renderSidebarPrompts();
  refreshSidebarData().then(() => {
    if (activeSidebarTab === 'prompts' && isRightSidebarOpen) renderSidebarPrompts();
  }).catch(() => {});
});

$('#closeSidebarBtn')?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleRightSidebar(false);
});

$('#sidebarSearchInput')?.addEventListener('input', (e) => {
  sidebarSearchQuery = e.target.value.trim();
  if (activeSidebarTab === 'skills') renderSidebarSkills();
  else renderSidebarPrompts();
});

$('#sidebarManageLink')?.addEventListener('click', () => {
  api.openSettings(activeSidebarTab === 'skills' ? 'skills' : 'prompts');
});

$('#sidebarBottomManageBtn')?.addEventListener('click', () => {
  api.openSettings(activeSidebarTab === 'skills' ? 'skills' : 'prompts');
});

// ── 侧边栏宽度实时拖拽调节系统 ───────────────────────────────────────────
const resizeHandle = $('#sidebarResizeHandle');
if (resizeHandle) {
  let isResizing = false;
  let startX = 0;
  let startWidth = 0;
  let resizeRaf = 0;

  resizeHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing = true;
    startX = e.clientX;
    startWidth = currentSidebarWidth;
    document.body.classList.add('sidebar-resizing');

    const onMouseMove = (moveEvent) => {
      if (!isResizing) return;
      const deltaX = startX - moveEvent.clientX; // 向左拖拽为增加侧边栏宽度
      const maxAllowed = Math.min(SIDEBAR_MAX_WIDTH, Math.round(window.innerWidth * 0.75));
      const targetWidth = Math.max(SIDEBAR_MIN_WIDTH, Math.min(maxAllowed, startWidth + deltaX));

      if (targetWidth !== currentSidebarWidth) {
        currentSidebarWidth = targetWidth;
        document.documentElement.style.setProperty('--current-sidebar-width', `${targetWidth}px`);
        const sb = $('#rightSidebar');
        if (sb) sb.style.width = `${targetWidth}px`;

        if (resizeRaf) cancelAnimationFrame(resizeRaf);
        resizeRaf = requestAnimationFrame(() => {
          if (api.setSidebarWidth && isRightSidebarOpen) {
            api.setSidebarWidth(targetWidth).catch(() => {});
          }
        });
      }
    };

    const onMouseUp = () => {
      if (!isResizing) return;
      isResizing = false;
      document.body.classList.remove('sidebar-resizing');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      try {
        localStorage.setItem('gpt_sidebar_width', String(currentSidebarWidth));
      } catch (_) {}
      if (api.setSidebarWidth && isRightSidebarOpen) {
        api.setSidebarWidth(currentSidebarWidth).catch(() => {});
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isRightSidebarOpen) {
    toggleRightSidebar(false);
  }
});
$('#workspaceSelect').onchange = () => {
  const workspace = $('#workspaceSelect').value;
  /* 立刻重置回 placeholder：这是一个**动作**选择器（选 = 执行切换），
   * 不是"当前值"选择器 —— 停在刚选的那一项上会让人以为"当前就是它"，
   * 而切换可能失败并回滚。「当前是哪个」由切换器按钮常驻负责。 */
  $('#workspaceSelect').value = '';
  if (!workspace) return;
  toggleWorkspaceMenu(true);
  switchWorkspace(workspace, true);
};
$('#pauseTask').onclick = async () => { try { unwrap(await api.pauseTask()); await refreshTask(); } catch (error) { setSwitchFeedback(error.message, 'error'); } };
$('#resumeTask').onclick = async () => { try { unwrap(await api.resumeTask()); await refreshTask(); } catch (error) { setSwitchFeedback(error.message, 'error'); } };
$('#stopTask').onclick = async () => { try { unwrap(await api.stopTask()); await refreshTask(); } catch (error) { setSwitchFeedback(error.message, 'error'); } };
/* 第 26 轮：删除了 #addAuthorizedRootQuick 的绑定。
 * 它调用 api.chooseAuthorizedRoot()，而设置页「工作区与权限」里已有完整的
 * 「额外授权目录」面板（index.html 的 #addAuthorizedRoot + #authorizedRootsList），
 * 功能完全覆盖 —— 同一功能不该有两个入口，工具栏这里属于重复。
 * api.chooseAuthorizedRoot 本身保留：设置页还在用它。 */
$('#addWorkspace').onclick = async () => {
  if (switching) return;
  switching = true;
  setSwitchFeedback('请选择工作目录…', 'busy');
  try {
    const result = unwrap(await api.chooseAndSwitchWorkspace());
    if (result) {
      await Promise.all([refreshWorkspace(), refreshStatus(), refreshTask()]);
      setSwitchFeedback(`已添加并切换到 ${baseName(activeWorkspace)}`, 'done');
      setTimeout(() => setSwitchFeedback(''), 2400);
    } else {
      setSwitchFeedback('');
    }
  } catch (error) {
    setSwitchFeedback(error.message, 'error');
  } finally {
    switching = false;
    document.querySelector('.workspace-bar')?.classList.remove('switching');
    toggleWorkspaceMenu(true);
  }
};

api.onChatState(renderChatState);
api.onHeartbeat(renderServiceState);
api.onWorkspaceChanged?.(async (targetPath) => {
  const pTitle = $('#activeProjectLabel') || $('.workspace-project-title') || $('#workspaceProjectTitle');
  const aTitle = $('#activeWorkspaceLabel');
  const trigger = $('#workspaceTrigger');
  if (targetPath) {
    const name = baseName(targetPath);
    if (pTitle) {
      pTitle.textContent = name;
      pTitle.title = `项目：${name}`;
    }
    if (aTitle) aTitle.textContent = `当前工作区：${name}`;
    if (trigger) trigger.title = `当前项目与工作区：${targetPath}`;
  } else {
    activeWorkspace = '';
    if (pTitle) {
      pTitle.textContent = '未选择项目';
      pTitle.title = '未选择项目';
    }
    if (aTitle) aTitle.textContent = '尚未选择工作区';
    if (trigger) trigger.title = '切换工作区';
  }
  await Promise.all([refreshWorkspace(), refreshStatus(), refreshTask()]);
});
api.onDownload((item) => {
  const node = $('#downloadState');
  if (item.status === 'completed') node.textContent = `已保存：${baseName(item.path)}`;
  else if (item.status === 'progressing') node.textContent = `附件 ${item.totalBytes ? Math.round((item.receivedBytes / item.totalBytes) * 100) : 0}%`;
  else if (item.error) node.textContent = item.error;
});
api.chatStatus().then((result) => renderChatState(unwrap(result))).catch(() => {});
refreshStatus();
refreshWorkspace();
refreshTask();
setInterval(refreshWorkspace, 15000);
setInterval(refreshTask, 3000);

// 后台静默预热技能与快捷指令缓存，杜绝首次打开侧边栏时的空态与卡顿
if (api.listSkills) {
  api.listSkills().then((res) => { cachedSkills = unwrap(res) || []; }).catch(() => {});
}
if (api.listPrompts) {
  api.listPrompts().then((res) => { cachedPrompts = unwrap(res) || []; }).catch(() => {});
}

// ============================================================================
// 任务通知提示音引擎（主窗口常驻持久单例，确保即便设置视图被隐藏也能准时发声）
// ============================================================================
let chatChimeBlobUrl = null;
let chatPersistentAudio = null;

function getChatChimeBlobUrl() {
  if (chatChimeBlobUrl) return chatChimeBlobUrl;
  try {
    const sampleRate = 44100;
    const duration = 0.65;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    const writeString = (offset, str) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    const f1 = 880.0;
    const f2 = 1318.51;
    const f3 = 1760.0;

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      let sample = 0;
      if (t >= 0 && t < 0.45) {
        const attack1 = Math.min(1, t / 0.006);
        const decay1 = Math.exp(-t * 9.0);
        sample += Math.sin(2 * Math.PI * f1 * t) * 0.44 * attack1 * decay1;
      }
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
    chatChimeBlobUrl = URL.createObjectURL(blob);
    return chatChimeBlobUrl;
  } catch (_) {
    return null;
  }
}

function playChatNotificationChime() {
  try {
    if (!chatPersistentAudio) {
      const url = getChatChimeBlobUrl();
      if (url) {
        chatPersistentAudio = new Audio(url);
        chatPersistentAudio.volume = 1.0;
        chatPersistentAudio.preload = 'auto';
      }
    }
    if (chatPersistentAudio) {
      chatPersistentAudio.currentTime = 0;
      chatPersistentAudio.play().catch(() => {});
    }
  } catch (_) {}
}

api?.onNotificationSound?.(() => {
  playChatNotificationChime();
});