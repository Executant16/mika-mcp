(() => {
  /* 这个脚本被两个页面共用：设置页 index.html 与聊天页 browser.html。
   *
   * 它只负责"文档解析期就把 data-theme 定下来"，避免首帧闪一版错色；
   * 后续的真实切换由各页自己的 applyTheme / applyChatTheme 负责。
   *
   * 解析规则：
   *   ?theme=light        → light
   *   ?theme=custom       → custom（settings 页的深色自定义调色板）
   *   ?theme=dark / 缺省  → dark
   * 缺省为 dark 而非 light：应用默认主题是深色（见 main.js 的 fallback），
   * 缺省成浅色会在设置页首帧闪一下白。
   *
   * 为什么用 location.search 而不是偏好设置：browser.html 的 CSP 是
   * script-src 'self'，内联脚本被禁；而两页都需要在窗口显示前定色，
   * 等浏览器进程异步读配置会明显闪一下。URL 参数在解析期即可用。 */
  const requested = new URLSearchParams(location.search).get('theme');
  const theme = requested === 'light' ? 'light' : (requested === 'custom' ? 'custom' : 'dark');
  document.body.dataset.theme = theme;
  document.documentElement.dataset.theme = theme;

  // 顶层防御性绑定：确保无论后续业务逻辑发生何种状况，左上角“返回主界面”都绝不卡死
  const bindBackToMain = () => {
    const btn = document.getElementById('backToMain');
    if (btn && !btn._hasEarlyBound) {
      btn._hasEarlyBound = true;
      btn.addEventListener('click', () => {
        window.mcpAssistant?.closeSettings?.();
      });
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindBackToMain);
  } else {
    bindBackToMain();
  }

  // 早期主题单选卡片即时同步：确保在 DOM 树就绪瞬间，外观卡片即与当前主题严格一致，消除空白状态
  const syncEarlyThemeCards = () => {
    const pick = theme === 'light' ? 'light' : 'dark';
    const cards = document.querySelectorAll('[data-theme-pick]');
    if (cards && cards.length) {
      cards.forEach((card) => {
        const active = card.dataset.themePick === pick;
        card.classList.toggle('selected', active);
        card.setAttribute('aria-checked', String(active));
      });
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncEarlyThemeCards);
  } else {
    syncEarlyThemeCards();
  }

  // 防卡死兜底看门狗：即使 app.js 解析异常、IPC 挂起或数据读取超时，也绝对不能永久卡死在准备遮罩
  const exitBootingSafely = () => {
    if (document.body && document.body.classList.contains('booting')) {
      document.body.classList.remove('booting');
      document.body.classList.add('booted');
      const bs = document.getElementById('bootScreen');
      if (bs) bs.setAttribute('aria-hidden', 'true');
    }
  };
  // 超时兜底强制放行主界面外壳，防止界面无谓等待
  setTimeout(exitBootingSafely, 300);
  if (document.readyState === 'complete') {
    setTimeout(exitBootingSafely, 50);
  } else {
    window.addEventListener('load', () => setTimeout(exitBootingSafely, 50));
  }
})();
