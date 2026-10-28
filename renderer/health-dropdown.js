const api = window.healthApi;

let currentState = {
  mcpRunning: null,
  tunnelRunning: null,
  theme: 'light'
};

const $ = (id) => document.getElementById(id);
let mcpActionBusy = false;
let mcpActionError = '';
let statusReading = false;

function describeChatError(error) {
  const code = String(error).match(/\bERR_[A-Z0-9_]+\b/)?.[0] || '';
  if (code === 'ERR_BLOCKED_BY_CLIENT') return '网页请求被本机应用或拦截规则阻止。';
  if (code === 'ERR_INTERNET_DISCONNECTED') return '当前未连接到互联网，请检查网络连接。';
  if (code === 'ERR_NAME_NOT_RESOLVED') return '无法解析网站地址，请检查网络或 DNS 设置。';
  if (code === 'ERR_TIMED_OUT' || code === 'ERR_CONNECTION_TIMED_OUT') return '网页连接超时，请稍后重试。';
  if (code.startsWith('ERR_CERT_')) return '安全证书校验失败，请检查系统时间和网络设置。';
  if (code === 'ERR_PROXY_CONNECTION_FAILED' || code === 'ERR_TUNNEL_CONNECTION_FAILED') return '代理连接失败，请检查代理设置。';
  if (code === 'ERR_CONNECTION_RESET' || code === 'ERR_CONNECTION_CLOSED') return '网页连接已中断，请检查网络后重试。';
  return '网页未能加载，请检查网络后重试；具体原因可查看技术详情。';
}

function updateView(state) {
  if (!state) return;
  currentState = { ...currentState, ...state };
  if (currentState.statusError) {
    currentState.mcpRunning = null;
    currentState.tunnelRunning = null;
  }

  // 1. 同步主题
  document.documentElement.dataset.theme = currentState.theme === 'dark' ? 'dark' : 'light';

  const mcpRunning = Boolean(currentState.mcpRunning);
  const tunnelRunning = Boolean(currentState.tunnelRunning);
  const mcpKnown = typeof currentState.mcpRunning === 'boolean';
  const tunnelKnown = typeof currentState.tunnelRunning === 'boolean';
  const chat = currentState.chatState;
  const chatError = Boolean(chat?.error);
  const chatLoading = Boolean(chat?.loading || chat?.revealed === false);
  const chatReady = Boolean(chat) && !chatError && !chatLoading && !chat.isVerification;
  const isAllHealthy = mcpRunning && tunnelRunning && chatReady;
  const abnormalCount = (mcpKnown && !mcpRunning ? 1 : 0) + (tunnelKnown && !tunnelRunning ? 1 : 0) + (chatError ? 1 : 0);
  const pendingLabel = !mcpKnown || !tunnelKnown || !chat ? '状态检查中'
    : chat.isVerification ? '等待网页验证' : '网页加载中';
  const summaryClass = currentState.statusError || abnormalCount ? 'error' : isAllHealthy ? 'healthy' : '';
  const chatLabel = !chat ? '检查中' : chatError ? '加载失败' : chat.isVerification ? '安全验证中' : chatLoading ? '加载中' : '已就绪';
  $('chatIconBox').className = `service-icon-box ${chatError ? 'error' : chatReady ? 'healthy' : ''}`;
  $('chatStateTag').className = `service-state-tag ${chatError ? 'error' : chatReady ? 'healthy' : ''}`;
  $('chatStateTag').textContent = chatLabel;
  $('chatStateDescription').textContent = chatError ? describeChatError(chat.error)
    : !chat ? '正在读取网页状态…' : chat.isVerification ? '请在网页中完成安全验证。'
    : chatLoading ? '正在加载 ChatGPT，请稍候。' : 'ChatGPT 网页已加载。';
  const details = $('chatErrorDetails');
  const technical = $('chatErrorTechnical');
  const rawError = chatError ? String(chat.error) : '';
  // 心跳不打断用户阅读；错误改变或恢复后收起旧详情。
  if (technical.textContent !== rawError || !chatError) details.open = false;
  technical.textContent = rawError;
  details.hidden = !chatError;

  // 2. 头部摘要
  const headerDot = $('headerDot');
  const summaryPill = $('summaryPill');
  if (headerDot) {
    headerDot.className = `header-indicator-dot ${summaryClass}`;
  }
  if (summaryPill) {
    summaryPill.className = `status-summary-pill ${summaryClass}`;
    summaryPill.textContent = currentState.statusError ? '状态读取失败' : abnormalCount ? `${abnormalCount} 项异常` : isAllHealthy ? '运行正常' : pendingLabel;
  }
  $('healthReadError').textContent = currentState.statusError ? `未能确认服务状态：${currentState.statusError}` : '';
  $('healthReadError').hidden = !currentState.statusError;
  $('healthRefreshBtn').disabled = statusReading;
  $('healthRefreshBtn').textContent = statusReading ? '读取中…' : '刷新';

  // 3. MCP 工具项状态
  const mcpIconBox = $('mcpIconBox');
  const mcpStateTag = $('mcpStateTag');
  const mcpActionBtn = $('mcpActionBtn');
  if (mcpIconBox) mcpIconBox.className = `service-icon-box ${!mcpKnown ? '' : mcpRunning ? 'healthy' : 'error'}`;
  if (mcpStateTag) {
    mcpStateTag.className = `service-state-tag ${!mcpKnown ? '' : mcpRunning ? 'healthy' : 'error'}`;
    mcpStateTag.textContent = !mcpKnown ? (currentState.statusError ? '未能确认' : '检查中') : mcpRunning ? '运行中' : '未运行';
  }
  if (mcpActionBtn) {
    mcpActionBtn.className = `btn-action ${mcpRunning ? 'btn-ghost' : ''} ${mcpActionBusy ? 'is-busy' : ''}`;
    mcpActionBtn.disabled = mcpActionBusy || !mcpKnown;
    mcpActionBtn.querySelector('.btn-text').textContent = mcpActionBusy ? '正在处理…' : mcpRunning ? '重启服务' : '启动服务';
  }
  const actionError = $('mcpActionError');
  actionError.textContent = mcpActionError;
  actionError.hidden = !mcpActionError;

  // 4. Tunnel 通道项状态
  const tunnelIconBox = $('tunnelIconBox');
  const tunnelStateTag = $('tunnelStateTag');
  const tunnelActionBtn = $('tunnelActionBtn');
  if (tunnelIconBox) tunnelIconBox.className = `service-icon-box ${!tunnelKnown ? '' : tunnelRunning ? 'healthy' : 'error'}`;
  if (tunnelStateTag) {
    tunnelStateTag.className = `service-state-tag ${!tunnelKnown ? '' : tunnelRunning ? 'healthy' : 'error'}`;
    tunnelStateTag.textContent = !tunnelKnown ? (currentState.statusError ? '未能确认' : '检查中') : tunnelRunning ? '已连接' : '未连接';
  }
  if (tunnelActionBtn) {
    if (tunnelRunning) {
      tunnelActionBtn.className = 'btn-action btn-ghost';
      tunnelActionBtn.querySelector('.btn-text').textContent = '查看连接';
    } else {
      tunnelActionBtn.className = 'btn-action btn-secondary';
      tunnelActionBtn.querySelector('.btn-text').textContent = '配置凭据 →';
    }
  }
}

// 事件绑定
$('mcpActionBtn')?.addEventListener('click', async () => {
  const btn = $('mcpActionBtn');
  if (!btn || mcpActionBusy) return;
  const restarting = Boolean(currentState.mcpRunning);
  mcpActionBusy = true;
  mcpActionError = '';
  updateView({});

  try {
    const result = await (restarting ? api.restartService() : api.startService());
    if (result?.ok !== true) throw new Error(result?.error || '未收到有效的操作结果，请检查服务状态。');
  } catch (err) {
    mcpActionError = `上次${restarting ? '重启' : '启动'}失败：${err?.message || '未知错误，请查看故障诊断。'}`;
  } finally {
    mcpActionBusy = false;
    updateView({});
  }
});

$('tunnelActionBtn')?.addEventListener('click', () => {
  api?.openSettings('deploy');
});

$('gotoHealthBtn')?.addEventListener('click', () => {
  api?.openSettings('health');
});

$('gotoSettingsBtn')?.addEventListener('click', () => {
  api?.openSettings('overview');
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    api?.close();
  }
});

// 初始化数据
async function refreshHealthState() {
  if (statusReading) return;
  statusReading = true;
  updateView({});
  try {
    const result = await api.getData();
    if (result?.ok !== true || !result.data || typeof result.data !== 'object') {
      throw new Error(result?.error || '未收到有效的状态数据。');
    }
    updateView({ ...result.data, statusError: '' });
  } catch (error) {
    updateView({ statusError: error?.message || '读取状态失败，请稍后手动刷新。' });
  } finally {
    statusReading = false;
    updateView({});
  }
}
$('healthRefreshBtn')?.addEventListener('click', refreshHealthState);
if (api) {
  api.onData(updateView);
  refreshHealthState();
}
