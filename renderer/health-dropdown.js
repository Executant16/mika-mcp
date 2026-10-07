const api = window.healthApi;

let currentState = {
  mcpRunning: false,
  tunnelRunning: false,
  theme: 'light'
};

const $ = (id) => document.getElementById(id);

function updateView(state) {
  if (!state) return;
  currentState = { ...currentState, ...state };

  // 1. 同步主题
  document.documentElement.dataset.theme = currentState.theme === 'dark' ? 'dark' : 'light';

  const mcpRunning = Boolean(currentState.mcpRunning);
  const tunnelRunning = Boolean(currentState.tunnelRunning);
  const isAllHealthy = mcpRunning && tunnelRunning;
  const abnormalCount = (!mcpRunning ? 1 : 0) + (!tunnelRunning ? 1 : 0);

  // 2. 头部摘要
  const headerDot = $('headerDot');
  const summaryPill = $('summaryPill');
  if (headerDot) {
    headerDot.className = `header-indicator-dot ${isAllHealthy ? 'healthy' : 'error'}`;
  }
  if (summaryPill) {
    summaryPill.className = `status-summary-pill ${isAllHealthy ? 'healthy' : 'error'}`;
    summaryPill.textContent = isAllHealthy ? '运行正常' : `${abnormalCount} 项异常`;
  }

  // 3. MCP 工具项状态
  const mcpIconBox = $('mcpIconBox');
  const mcpStateTag = $('mcpStateTag');
  const mcpActionBtn = $('mcpActionBtn');
  if (mcpIconBox) mcpIconBox.className = `service-icon-box ${mcpRunning ? 'healthy' : 'error'}`;
  if (mcpStateTag) {
    mcpStateTag.className = `service-state-tag ${mcpRunning ? 'healthy' : 'error'}`;
    mcpStateTag.textContent = mcpRunning ? '运行中' : '未运行';
  }
  if (mcpActionBtn) {
    mcpActionBtn.className = `btn-action ${mcpRunning ? 'btn-ghost' : ''}`;
    mcpActionBtn.querySelector('.btn-text').textContent = mcpRunning ? '重启服务' : '启动服务';
  }

  // 4. Tunnel 通道项状态
  const tunnelIconBox = $('tunnelIconBox');
  const tunnelStateTag = $('tunnelStateTag');
  const tunnelActionBtn = $('tunnelActionBtn');
  if (tunnelIconBox) tunnelIconBox.className = `service-icon-box ${tunnelRunning ? 'healthy' : 'error'}`;
  if (tunnelStateTag) {
    tunnelStateTag.className = `service-state-tag ${tunnelRunning ? 'healthy' : 'error'}`;
    tunnelStateTag.textContent = tunnelRunning ? '已连接' : '未连接';
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
  if (!btn) return;
  btn.classList.add('is-busy');
  const textEl = btn.querySelector('.btn-text');
  const originalText = textEl.textContent;
  textEl.textContent = '正在处理…';

  try {
    if (currentState.mcpRunning) {
      await api.restartService();
    } else {
      await api.startService();
    }
  } catch (err) {
    textEl.textContent = '操作失败';
    setTimeout(() => { textEl.textContent = originalText; }, 2000);
  } finally {
    btn.classList.remove('is-busy');
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
if (api) {
  api.onData(updateView);
  api.getData().then(updateView).catch(() => {});
}
