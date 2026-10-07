const { shell, session, WebContentsView } = require('electron');
const { DownloadService } = require('./services/downloadService');

const CHAT_HOME = 'https://chatgpt.com/';
const CHAT_PARTITION = 'persist:chatgpt-session';
const NAVIGATION_HOSTS = new Set([
  'chatgpt.com', 'www.chatgpt.com', 'openai.com', 'www.openai.com',
  'auth.openai.com', 'login.openai.com', 'auth0.openai.com', 'platform.openai.com',
  'accounts.google.com', 'login.microsoftonline.com', 'appleid.apple.com'
]);
const POPUP_HOSTS = new Set([
  'auth.openai.com', 'login.openai.com', 'auth0.openai.com',
  'accounts.google.com', 'login.microsoftonline.com', 'appleid.apple.com'
]);
const TRANSIENT_CHAT_LOAD_ERROR = /ERR_(?:CONNECTION_RESET|CONNECTION_CLOSED|CONNECTION_TIMED_OUT|TIMED_OUT|NETWORK_CHANGED|INTERNET_DISCONNECTED|HTTP2_PROTOCOL_ERROR|INCOMPLETE_CHUNKED_ENCODING)/i;

function parseUrl(value) {
  try { return new URL(value); } catch { return null; }
}

function isAllowedNavigation(value) {
  const parsed = parseUrl(value);
  if (!parsed || parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  if (NAVIGATION_HOSTS.has(host)) return true;
  if (host.endsWith('.chatgpt.com') || host.endsWith('.openai.com')) return true;
  if (host.endsWith('.cloudflare.com') || host === 'cloudflare.com') return true;
  if (host.endsWith('.arkoselabs.com') || host === 'arkoselabs.com') return true;
  if (host.endsWith('.oaistatic.com') || host.endsWith('.oaiusercontent.com')) return true;
  return false;
}

function isAuthPopup(value) {
  const parsed = parseUrl(value);
  if (!parsed || parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  if (POPUP_HOSTS.has(host)) return true;
  if (host.endsWith('.cloudflare.com') || host === 'cloudflare.com') return true;
  if (host.endsWith('.arkoselabs.com') || host === 'arkoselabs.com') return true;
  if (host.endsWith('.openai.com')) return true;
  if (host === 'accounts.google.com' || host.endsWith('.google.com')) return true;
  if (host === 'login.microsoftonline.com' || host.endsWith('.microsoftonline.com') || host.endsWith('.live.com')) return true;
  if (host === 'appleid.apple.com' || host.endsWith('.apple.com')) return true;
  return false;
}

function isChatGptNavigation(value) {
  const parsed = parseUrl(value);
  if (!parsed || parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  return host === 'chatgpt.com' || host === 'www.chatgpt.com';
}

function isTransientChatLoadError(description) {
  return TRANSIENT_CHAT_LOAD_ERROR.test(String(description || ''));
}

class ChatViewController {
  /* toolbarHeight 实际由 main.js 显式传入（CHAT_TOOLBAR_HEIGHT）。
   * 这个默认值曾经是 64 —— 与真实的 112 不符，属于潜伏的错误兜底：
   * 谁不传参谁就拿到一个偏小的值，视图会盖住工具栏底部 48px。
   * 第 24 轮改成与 renderer/browser.css 的 --toolbar-height 一致，
   * 第 32 轮随顶部栏瘦身同步为 76（40 + 36）。 */
  constructor({ window, log, settings, toolbarHeight = 64, onState = () => {}, onDownload = () => {} }) {
    this.window = window;
    this.log = log;
    this.toolbarHeight = toolbarHeight;
    this.onState = onState;
    this.settings = settings;
    this.onDownload = onDownload;
    this.view = null;
    this.loading = false;
    this.lastError = '';
    this.errorLayer = '';
    this.retryTimer = null;
    this.retryAttempt = 0;
    this.nextRetryAt = 0;
    /* 第 23 轮：可见性闸门（见 reveal 的说明）。 */
    this.revealed = false;
    this.revealReason = '';
    this.surfaceVisible = true;
    this.revealTimer = null;
    this.revealWatchTimer = null;
    this.sidebarWidth = 0;
    this.boundResize = () => this.resize();
  }

  /* ── 可见性闸门：让"正在打开 ChatGPT"占位真正露出来 ──────────────────
   * 问题（第 23 轮实测）：
   *   ChatGPT 是原生 WebContentsView，**永远合成在宿主页面 renderer 之上**。
   *   browser.html 里那个 .loading-stage 占位与这个视图的几何逐像素重合
   *   （实测两边都是 x0 y112 1346×752），所以占位在任何时刻都被完全遮住
   *   —— 它从被写下的那天起就没被任何人看到过。
   *   代价是：从窗口可见（+0.86s）到 ChatGPT 画出内容（+3.58s）之间，
   *   用户只能盯着一块纯色空白（原生视图自己的 #f7f7f8），实测 2.72 秒。
   *
   * 修法：加载完成前**不显示**原生视图。视图一藏，下面宿主页的占位
   *   （转圈 + "正在打开 ChatGPT"）就真的露出来了 —— 那正是它存在的意义。
   *   内容就绪后再显示，空白期从"纯色"变成"有解释的等待"。
   *
   * 为什么只在**首次**加载期间藏：
   *   后续导航（点聊天、刷新）如果也藏，快速切换会出现"闪一下占位再出内容"
   *   的抖动，比空白更糟。首次加载是用户唯一必然会遇到的空白窗口期。 */
  /* 内容是否真的就绪（可以放行视图了）。
   * 判据是"当前 URL 已经是一次真实导航"，而不是"某个加载事件来过"——
   * 因为初始 about:blank / 空文档也会走完一轮加载事件，此时页面还是空的。
   * 用既有的 isAllowedNavigation() 复用同一套白名单，避免新增判断口径。 */
  contentReady() {
    const contents = this.view?.webContents;
    if (!contents || contents.isDestroyed()) return false;
    return isAllowedNavigation(contents.getURL());
  }

  isVerificationUrl(url) {
    const raw = String(url || '').toLowerCase();
    return raw.includes('challenge') || raw.includes('cloudflare') || raw.includes('turnstile') ||
      raw.includes('auth.openai.com') || raw.includes('login.openai.com') || raw.includes('auth0.openai.com') ||
      raw.includes('arkoselabs') || raw.includes('checkpoint');
  }

  /* 问一次页面"有内容了吗"，有就放行。
   * 事件处理器只负责"提醒去问一下"，判断标准统一收在这里，
   * 避免 did-navigate / did-finish-load / did-stop-loading 各写一套口径。 */
  checkContentAndReveal() {
    if (this.revealed) return;
    const contents = this.view?.webContents;
    if (!contents || contents.isDestroyed()) return;
    const currentUrl = contents.getURL();
    if (!this.contentReady()) return;

    // ★ 关键：如果已经进入 Cloudflare 或 OpenAI 验证阶段，必须立即放行显现，让用户即时交互
    if (this.isVerificationUrl(currentUrl)) {
      this.reveal('verification-page');
      return;
    }

    if (contents.isLoading()) return;
    contents.executeJavaScript(
      '(() => document.body ? (document.body.childElementCount + ":" + (document.body.innerText || "").length) : "0:0")()',
      true
    ).then((value) => {
      const [kids, text] = String(value).split(':').map(Number);
      if ((kids && kids >= 3) || text > 0) this.reveal();
    }).catch(() => { /* 正在导航，交给看门狗下一次问 */ });
  }

  /* ── 放行看门狗：轮询"页面里是否真的有东西了" ────────────────────────
   * 为什么必须轮询而不是等某一个事件：
   *   实测这一轮加载会在一个生命周期里触发**两次** did-stop-loading ——
   *   第一次是初始空文档（+0.9s，0 字符），第二次才是真正的 ChatGPT
   *   （+3.6s，56 字符）。若看到第一个事件就放行，用户看到的仍是空白，
   *   闸门等于白设。
   *   而"第二次"什么时候来、以及 did-navigate 时正文是否已经画出来，
   *   都受网络速度影响，靠事件顺序判断不可靠（两次实测的时序就不同）。
   *   唯一稳的判据是直接问页面：DOM 里有子元素 / 有文字了吗？
   * 检查很轻（两个属性），150ms 一次，放行即停，只在启动期跑。 */
  startRevealWatch() {
    if (this.revealWatchTimer || this.revealed) return;
    this.revealWatchTimer = setInterval(() => {
      if (this.revealed) return;
      this.checkContentAndReveal();
    }, 150);
    this.revealWatchTimer.unref?.();
  }

  reveal(reason = 'content-ready') {
    if (this.revealed) return;
    this.revealed = true;
    /* 记下放行原因。运行时排查时，"视图显示了"本身不够 ——
     * 得知道是"内容真就绪"还是"超时兜底/失败兜底"放行的，两者含义完全不同：
     * 前者是正常路径，后者说明加载出了问题（此时工具栏应显示失败原因）。 */
    this.revealReason = reason;
    if (this.revealTimer) { clearTimeout(this.revealTimer); this.revealTimer = null; }
    if (this.revealWatchTimer) { clearInterval(this.revealWatchTimer); this.revealWatchTimer = null; }
    this.injectAntiDragStyles();
    this.resize();
    this.applyVisibility();
  }

  /* 真正把"该不该显示"落到原生层。
   * 两个条件是**与**关系：
   *   surfaceVisible —— 当前表面是不是 ChatGPT（切到设置时该为 false）
   *   revealed       —— 视图自己是否已备好内容
   * 漏掉任一条件都会出问题：只看 surfaceVisible 会让设置页面下露出空白视图；
   * 只看 revealed 会在切到设置后与设置视图叠在一起。 */
  applyVisibility() {
    if (!this.view || this.view.webContents.isDestroyed()) return;
    this.view.setVisible(this.surfaceVisible && this.revealed);
  }

  /* 供主进程的表面切换调用，替代直接 view.setVisible()。
   * 必须走这里，否则 setActiveSurface('chat') 会在首次加载未完成时
   * 把还没内容的视图强行显示出来，闸门就白设了。 */
  setSurfaceVisible(wanted) {
    this.surfaceVisible = Boolean(wanted);
    this.applyVisibility();
  }

  clearRetryState({ resetAttempt = true } = {}) {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.nextRetryAt = 0;
    if (resetAttempt) this.retryAttempt = 0;
  }

  scheduleTransientRetry(url, description) {
    if (!isTransientChatLoadError(description) || !isAllowedNavigation(url) || this.retryTimer) return false;
    const delay = Math.min(30000, 1500 * (2 ** Math.min(this.retryAttempt, 5)));
    this.retryAttempt += 1;
    this.nextRetryAt = Date.now() + delay;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.nextRetryAt = 0;
      const contents = this.view?.webContents;
      if (!contents || contents.isDestroyed()) return;
      contents.loadURL(url).catch((error) => {
        this.lastError = error.message;
        this.errorLayer = 'chat-page';
        this.emitState();
      });
    }, delay);
    this.retryTimer.unref?.();
    this.log.warn('ChatGPT 页面网络加载中断，将按退避策略重试页面；不会重启本地 MCP', {
      url, description, attempt: this.retryAttempt, delayMs: delay
    });
    return true;
  }

  mount() {
    if (this.view || !this.window || this.window.isDestroyed()) return;
    const chatSession = session.fromPartition(CHAT_PARTITION);
    // 关键优化：去除 User-Agent 中的 Electron 标识，防止 Cloudflare / Arkose 判定为机器人导致验证死循环
    const rawUa = chatSession.getUserAgent();
    const cleanUa = rawUa.replace(/\s*Electron\/[0-9.]+/g, '');
    chatSession.setUserAgent(cleanUa);
    chatSession.webRequest.onBeforeSendHeaders((details, callback) => {
      const headers = { ...details.requestHeaders };
      if (headers['User-Agent']) {
        headers['User-Agent'] = headers['User-Agent'].replace(/\s*Electron\/[0-9.]+/g, '');
      }
      callback({ requestHeaders: headers });
    });

    new DownloadService({ electronSession: chatSession, settings: this.settings, log: this.log, onState: this.onDownload }).bind();
    const mayWriteClipboard = (permission, origin) => permission === 'clipboard-sanitized-write' && isAllowedNavigation(origin);
    chatSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
      callback(mayWriteClipboard(permission, details.requestingUrl || details.securityOrigin || ''));
    });
    chatSession.setPermissionCheckHandler((_webContents, permission, origin) => mayWriteClipboard(permission, origin));

    this.view = new WebContentsView({
      webPreferences: {
        partition: CHAT_PARTITION,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false
      }
    });
    this.view.setBackgroundColor('#f7f7f8');
    this.window.contentView.addChildView(this.view);
    this.window.on('resize', this.boundResize);
    this.resize();
    /* 第 23 轮：先藏起来，让宿主页的"正在打开 ChatGPT"占位露出来。
     * 内容就绪（did-stop-loading）后再由 reveal() 显示。 */
    this.applyVisibility();
    /* 兜底：万一 did-stop-loading 因故没来（渲染进程崩溃 / 页面卡死），
     * 不能让视图永远不显示 —— 那会是一片永久空白，比原来的问题更严重。
     * 12 秒后无条件放行，宁可显示空白也不能卡住用户。 */
    this.revealTimer = setTimeout(() => {
      if (!this.revealed) {
        this.log.warn('ChatGPT 首次加载超时，强制显示视图以避免永久空白', { timeoutMs: 12000 });
        this.reveal('timeout');
      }
    }, 12000);
    this.revealTimer.unref?.();
    /* 直接问页面"有没有内容"，比等事件顺序可靠（见 startRevealWatch 说明）。 */
    this.startRevealWatch();
    this.bindWebContents();
    this.loadHome();
  }

  bindWebContents() {
    const contents = this.view.webContents;
    contents.setWindowOpenHandler(({ url }) => {
      if (isAuthPopup(url)) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 560,
            height: 760,
            parent: this.window,
            modal: false,
            maximizable: false,
            fullscreenable: false,
            autoHideMenuBar: true,
            webPreferences: {
              partition: CHAT_PARTITION,
              nodeIntegration: false,
              contextIsolation: true,
              sandbox: true,
              webSecurity: true
            }
          }
        };
      }
      if (isAllowedNavigation(url) && parseUrl(url)?.hostname.toLowerCase().endsWith('chatgpt.com')) {
        this.openUrl(url);
      } else if (/^https?:/i.test(url)) {
        shell.openExternal(url).catch(() => {});
      }
      return { action: 'deny' };
    });
    contents.on('did-create-window', (popup) => this.bindAuthPopup(popup));
    contents.on('will-navigate', (event, url) => {
      if (isAllowedNavigation(url)) return;
      event.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url).catch(() => {});
    });
    contents.on('did-start-loading', () => {
      this.loading = true;
      this.lastError = '';
      this.errorLayer = '';
      this.emitState();
    });
    contents.on('did-finish-load', () => {
      this.clearRetryState();
      this.lastError = '';
      this.errorLayer = '';
      this.checkContentAndReveal();
      this.injectAntiDragStyles();
      this.emitState();
    });
    contents.on('dom-ready', () => {
      this.injectAntiDragStyles();
      this.scheduleChatUiEnhancements();
    });
    contents.on('did-stop-loading', () => {
      this.loading = false;
      this.checkContentAndReveal();
      this.injectAntiDragStyles();
      this.emitState();
      this.scheduleChatUiEnhancements();
    });
    contents.on('did-navigate', () => {
      this.checkContentAndReveal();
      this.injectAntiDragStyles();
      this.emitState();
    });
    contents.on('did-navigate-in-page', () => {
      this.emitState();
      this.injectAntiDragStyles();
      this.suspendChatUiEnhancements();
      setTimeout(() => this.scheduleChatUiEnhancements(), 1200);
    });
    contents.on('page-title-updated', () => this.emitState());
    contents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || errorCode === -3) return;
      this.loading = false;
      this.lastError = `${errorDescription} (${errorCode})`;
      this.errorLayer = 'chat-page';
      this.log.warn('ChatGPT 页面加载失败', { url: validatedURL, errorCode, errorDescription });
      const willRetry = this.scheduleTransientRetry(validatedURL, errorDescription);
      /* 第 23 轮：会重试的就继续让占位转圈（"正在打开 ChatGPT" 此刻是实话）；
       * 不会重试的（离线、DNS 失败等）必须放行视图 —— 否则占位会一直转，
       * 假装"马上就好"，而工具栏其实已经写着失败原因了。宁可显示空白，
       * 也不能留一个撒谎的加载指示器。 */
      if (!willRetry) this.reveal('load-failed');
      this.emitState();
    });
    contents.on('render-process-gone', (_event, details) => {
      this.loading = false;
      this.lastError = `页面进程已退出：${details.reason}`;
      this.errorLayer = 'chat-renderer';
      this.log.error(this.lastError, { exitCode: details.exitCode });
      /* 第 23 轮：渲染进程没了，占位再转也没有意义，放行视图。 */
      this.reveal('render-gone');
      this.emitState();
    });
  }

  bindAuthPopup(popup) {
    const popupContents = popup?.webContents;
    if (!popupContents || popupContents.isDestroyed()) return;
    let completed = false;
    const finishInMainView = (url) => {
      if (completed || !isChatGptNavigation(url)) return false;
      completed = true;
      this.openUrl(url).catch((error) => {
        this.lastError = error.message;
        this.emitState();
      }).finally(() => {
        if (!popup.isDestroyed()) popup.close();
      });
      return true;
    };
    popup.setMenuBarVisibility(false);
    popup.setMaximizable(false);
    popup.setFullScreenable(false);
    popupContents.setWindowOpenHandler(({ url }) => {
      if (finishInMainView(url)) return { action: 'deny' };
      if (/^https?:/i.test(url) && !isAllowedNavigation(url)) shell.openExternal(url).catch(() => {});
      return { action: 'deny' };
    });
    popupContents.on('will-navigate', (event, url) => {
      if (finishInMainView(url)) {
        event.preventDefault();
        return;
      }
      if (!isAllowedNavigation(url)) {
        event.preventDefault();
        if (/^https?:/i.test(url)) shell.openExternal(url).catch(() => {});
      }
    });
    popupContents.on('did-navigate', (_event, url) => finishInMainView(url));
    popupContents.on('did-navigate-in-page', (_event, url) => finishInMainView(url));
  }

  suspendChatUiEnhancements() {
    const contents = this.view?.webContents;
    if (!contents || contents.isDestroyed()) return;
    contents.executeJavaScript(`(() => {
      if (window.__mcpCompactToolObserver) {
        try { window.__mcpCompactToolObserver.disconnect(); } catch {}
        window.__mcpCompactToolObserver = null;
      }
      if (window.__mcpCompactToolTimer) {
        clearTimeout(window.__mcpCompactToolTimer);
        window.__mcpCompactToolTimer = 0;
      }
      document.querySelectorAll('[data-mcp-tool-summary="1"]').forEach((node) => node.remove());
      document.querySelectorAll('.mcp-tool-call-hidden').forEach((node) => node.classList.remove('mcp-tool-call-hidden'));
      document.querySelectorAll('.mcp-tool-call-row').forEach((node) => node.classList.remove('mcp-tool-call-row'));
      document.querySelectorAll('[data-mcp-tools-expanded]').forEach((node) => delete node.dataset.mcpToolsExpanded);
      return true;
    })()`, true).catch(() => false);
  }

  scheduleChatUiEnhancements() {
    const contents = this.view?.webContents;
    if (!contents || contents.isDestroyed()) return;
    const currentUrl = contents.getURL();
    // ★ 关键防护：严禁在 Cloudflare 人机验证、登录认证期间注入任何脚本，防止触发防篡改机制导致验证卡死
    if (this.isVerificationUrl(currentUrl)) return;
    const parsed = parseUrl(currentUrl);
    if (!parsed || !parsed.hostname.toLowerCase().endsWith('chatgpt.com')) return;

    [700, 2400].forEach((delay) => setTimeout(() => {
      if (contents.isDestroyed()) return;
      if (this.isVerificationUrl(contents.getURL())) return;
      contents.executeJavaScript(`(() => {
        const STYLE_ID = 'mcp-chat-compact-tools-style';
        if (!document.getElementById(STYLE_ID)) {
          const style = document.createElement('style');
          style.id = STYLE_ID;
          style.textContent = [
            '*{-webkit-app-region:no-drag!important;}',
            'button,[role="button"],a,input,[data-testid]{-webkit-app-region:no-drag!important;pointer-events:auto!important;}',
            '.mcp-tool-call-row{margin-top:2px!important;margin-bottom:2px!important;min-height:0!important;}',
            '.mcp-tool-call-hidden{display:none!important;}',
            '.mcp-tool-turn-hidden{display:none!important;}',
            '.mcp-tool-call-summary{display:inline-flex!important;align-items:center!important;gap:7px!important;margin:7px 0 5px!important;padding:6px 10px!important;border:1px solid rgba(0,0,0,.09)!important;border-radius:10px!important;background:rgba(0,0,0,.035)!important;color:inherit!important;font:inherit!important;font-size:12px!important;line-height:1.2!important;cursor:pointer!important;}',
            '.mcp-tool-cluster-toggle{display:inline-flex!important;align-items:center!important;margin-left:7px!important;padding:3px 7px!important;border:0!important;border-radius:7px!important;background:rgba(0,0,0,.045)!important;color:inherit!important;font:inherit!important;font-size:11px!important;line-height:1.2!important;cursor:pointer!important;}',
            '.dark .mcp-tool-call-summary{border-color:rgba(255,255,255,.12)!important;background:rgba(255,255,255,.055)!important;}',
            '.mcp-tool-call-summary:hover{background:rgba(0,0,0,.065)!important;}',
            '.dark .mcp-tool-call-summary:hover{background:rgba(255,255,255,.09)!important;}'
          ].join('');
          document.head.appendChild(style);
        }

        const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
        const isToolLabel = (value) => {
          const text = normalize(value).toLowerCase();
          return text.includes('已调用工具') || text.includes('called tool') ||
            text.includes('used tool') || text.includes('tool called');
        };
        const findRow = (button, host) => {
          const existing = button.closest('.mcp-tool-call-row');
          if (existing && host.contains(existing)) return existing;
          let node = button;
          for (let depth = 0; depth < 4; depth += 1) {
            const parent = node.parentElement;
            if (!parent || parent === host) break;
            if (parent.querySelector('[data-mcp-tool-summary="1"]')) break;
            const text = normalize(parent.innerText || parent.textContent);
            const controls = parent.querySelectorAll('button,[role="button"]').length;
            if (text.length <= 100 && controls <= 2) node = parent;
            else break;
          }
          return node;
        };

        const compactHost = (host) => {
            if (!host) return;
            const buttons = Array.from(host.querySelectorAll('button,[role="button"]')).filter((button) => {
              if (button.dataset.mcpToolSummary === '1') return false;
              return isToolLabel(button.innerText || button.textContent);
            });
            const rows = [];
            const seen = new Set();
            for (const button of buttons) {
              const row = findRow(button, host);
              if (!row || seen.has(row)) continue;
              seen.add(row);
              row.classList.add('mcp-tool-call-row');
              rows.push(row);
            }

            let summary = host.querySelector(':scope > [data-mcp-tool-summary="1"], [data-mcp-tool-summary="1"]');
            if (rows.length < 1) {
              if (summary) summary.remove();
              rows.forEach((row) => row.classList.remove('mcp-tool-call-hidden'));
              delete host.dataset.mcpToolsExpanded;
              return;
            }

            if (!summary) {
              summary = document.createElement('button');
              summary.type = 'button';
              summary.dataset.mcpToolSummary = '1';
              summary.className = 'mcp-tool-call-summary';
              summary.addEventListener('click', () => {
                host.dataset.mcpToolsExpanded = host.dataset.mcpToolsExpanded === '1' ? '0' : '1';
                refresh();
              });
              rows[0].parentElement?.insertBefore(summary, rows[0]);
            }
            const expanded = host.dataset.mcpToolsExpanded === '1';
            const label = expanded ? ('▾ 工具 × ' + rows.length + ' · 收起') : ('▸ 工具 × ' + rows.length);
            const title = expanded ? '收起工具调用记录' : '展开查看全部工具调用记录';
            if (summary.textContent !== label) summary.textContent = label;
            if (summary.title !== title) summary.title = title;
            rows.forEach((row) => row.classList.toggle('mcp-tool-call-hidden', !expanded));
        };

        const refresh = () => {
          const turns = Array.from(document.querySelectorAll('[data-testid^="conversation-turn-"]'));
          if (turns.length) {
            turns.forEach(compactHost);
            return;
          }
          document.querySelectorAll('[data-message-author-role="assistant"]').forEach(compactHost);
        };

        const target = document.querySelector('main') || document.body;
        const scheduleStableRefresh = (delayMs = 1800) => {
          if (window.__mcpCompactToolTimer) clearTimeout(window.__mcpCompactToolTimer);
          window.__mcpCompactToolTimer = setTimeout(() => {
            const observer = window.__mcpCompactToolObserver;
            try { observer?.disconnect(); } catch {}
            try { refresh(); } finally {
              if (observer && target?.isConnected) {
                observer.observe(target, { childList: true, subtree: true });
              }
            }
          }, delayMs);
        };
        window.__mcpCompactSchedule = scheduleStableRefresh;
        if (!window.__mcpCompactToolObserver) {
          window.__mcpCompactToolObserver = new MutationObserver(() => scheduleStableRefresh(1800));
          if (target) window.__mcpCompactToolObserver.observe(target, { childList: true, subtree: true });
        }
        scheduleStableRefresh(1800);
        return true;
      })()`, true).catch(() => false);
    }, delay));
  }

  injectAntiDragStyles() {
    const contents = this.view?.webContents;
    if (!contents || contents.isDestroyed()) return;

    const css = [
      '* { -webkit-app-region: no-drag !important; }',
      'html, body, #__next, div, header, nav, aside, main, section, button, a, svg, span, input, textarea, select {',
      '  -webkit-app-region: no-drag !important;',
      '}',
      'button, [role="button"], a, input, [data-testid] {',
      '  -webkit-app-region: no-drag !important;',
      '  pointer-events: auto !important;',
      '  cursor: pointer;',
      '}'
    ].join('\n');

    contents.insertCSS(css).catch(() => {});

    contents.executeJavaScript(`(() => {
      const STYLE_ID = 'mcp-chat-anti-drag-style';
      let style = document.getElementById(STYLE_ID);
      if (!style) {
        style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = ${JSON.stringify(css)};
        (document.head || document.documentElement).appendChild(style);
      }
      return true;
    })()`, true).catch(() => false);
  }

  setSidebarWidth(width) {
    const next = Math.max(0, Number(width) || 0);
    if (this.sidebarWidth === next) return;
    this.sidebarWidth = next;
    this.resize();
  }

  resize() {
    if (!this.view || !this.window || this.window.isDestroyed()) return;
    const [width, height] = this.window.getContentSize();
    const rightMargin = this.sidebarWidth || 0;
    this.view.setBounds({
      x: 0,
      y: this.toolbarHeight,
      width: Math.max(0, width - rightMargin),
      height: Math.max(0, height - this.toolbarHeight)
    });
  }

  emitState() {
    this.onState(this.getState());
  }

  getState() {
    const contents = this.view?.webContents;
    return {
      loading: this.loading,
      error: this.lastError,
      errorLayer: this.errorLayer,
      retryAttempt: this.retryAttempt,
      nextRetryAt: this.nextRetryAt,
      /* 第 23 轮：可见性闸门的状态。暴露出来是为了让运行时验证能区分
       * "内容就绪正常放行" 与 "超时/失败兜底放行" —— 前者正常，后者意味着
       * ChatGPT 加载出了问题（此时视图是显出来了，但里面是空的）。 */
      revealed: this.revealed,
      revealReason: this.revealReason,
      url: contents && !contents.isDestroyed() ? contents.getURL() : '',
      title: contents && !contents.isDestroyed() ? contents.getTitle() : '',
      isVerification: this.isVerificationUrl(contents && !contents.isDestroyed() ? contents.getURL() : ''),
      canGoBack: Boolean(contents && !contents.isDestroyed() && contents.canGoBack()),
      canGoForward: Boolean(contents && !contents.isDestroyed() && contents.canGoForward())
    };
  }

  async openUrl(url) {
    if (!isAllowedNavigation(url)) throw new Error('不允许在内联窗口打开该地址。');
    const contents = this.view?.webContents;
    if (!contents || contents.isDestroyed()) return false;
    if (contents.getURL() === url) return true;

    const target = parseUrl(url);
    const current = parseUrl(contents.getURL());
    if (target && current && target.origin === current.origin) {
      const targetPath = `${target.pathname}${target.search}${target.hash}`;
      try {
        const clicked = await contents.executeJavaScript(`(() => {
          const wanted = ${JSON.stringify(targetPath)};
          const link = Array.from(document.querySelectorAll('a[href]')).find((item) => {
            try { const parsed = new URL(item.href, location.href); return parsed.pathname + parsed.search + parsed.hash === wanted; }
            catch { return false; }
          });
          if (!link) return false;
          link.click();
          return true;
        })()`, true);
        if (clicked) return true;
      } catch { /* fall through */ }
    }

    contents.stop();
    contents.loadURL(url).catch((error) => {
      this.lastError = error.message;
      this.emitState();
    });
    return true;
  }

  async loadHome() {
    return this.openUrl(CHAT_HOME);
  }

  async navigate(action) {
    const contents = this.view?.webContents;
    if (!contents || contents.isDestroyed()) return false;
    if (action === 'back' && contents.canGoBack()) contents.goBack();
    else if (action === 'forward' && contents.canGoForward()) contents.goForward();
    else if (action === 'reload') contents.reload();
    else if (action === 'home') await this.loadHome();
    else throw new Error('不支持的导航操作。');
    this.emitState();
    return true;
  }

  async insertPrompt(text) {
    const contents = this.view?.webContents;
    if (!contents || contents.isDestroyed()) return false;
    const payload = String(text || '').trim();
    if (!payload) return false;

    try {
      // 1. 激活 ChatGPT WebContentsView 的系统级窗口输入焦点（关键：未聚焦时 execCommand 与键盘输入会被 Chromium 静默丢弃）
      contents.focus();

      // 2. 在 ChatGPT 页面内查找输入框并准备光标定位
      const prepared = await contents.executeJavaScript(`(() => {
        const selectors = [
          '#prompt-textarea',
          'div.ProseMirror[contenteditable="true"]',
          'div[contenteditable="true"]',
          'textarea[data-id="root"]',
          'textarea[placeholder]',
          'textarea'
        ];
        let target = null;
        for (const s of selectors) {
          const el = document.querySelector(s);
          if (el && el.offsetParent !== null) {
            target = el;
            break;
          }
        }
        if (!target) {
          target = document.querySelector('#prompt-textarea') || document.querySelector('div[contenteditable="true"]');
        }
        if (!target) return { found: false };

        target.focus();

        const isTextarea = target.tagName === 'TEXTAREA';
        const curText = (isTextarea ? (target.value || '') : (target.textContent || '')).trim();
        const incomingText = (${JSON.stringify(payload)} || '').trim();
        if (incomingText && curText && (curText === incomingText || curText.includes(incomingText))) {
          return { found: true, isTextarea, alreadyPresent: true };
        }

        if (!isTextarea) {
          const sel = window.getSelection();
          const range = document.createRange();
          const p = target.querySelector('p');
          const focusNode = p || target;
          range.selectNodeContents(focusNode);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }

        return {
          found: true,
          isTextarea
        };
      })()`, true).catch(() => ({ found: false }));

      if (!prepared || !prepared.found) return false;
      if (prepared.alreadyPresent) return { alreadyPresent: true };

      // 3. 优先使用 Electron 原生底层系统级文本注入（模拟物理打字/粘贴，直接驱动 ProseMirror/Lexical 等现代富文本模型）
      if (typeof contents.insertText === 'function') {
        try {
          await contents.insertText(payload);
        } catch (_) {}
      }

      // 4. 验证注入结果并提供全方位事件与 DOM 兜底保障
      await contents.executeJavaScript(`(() => {
        const payload = ${JSON.stringify(payload)};
        const selectors = [
          '#prompt-textarea',
          'div.ProseMirror[contenteditable="true"]',
          'div[contenteditable="true"]',
          'textarea[data-id="root"]',
          'textarea'
        ];
        let target = null;
        for (const s of selectors) {
          const el = document.querySelector(s);
          if (el && el.offsetParent !== null) { target = el; break; }
        }
        if (!target) target = document.querySelector('#prompt-textarea') || document.querySelector('div[contenteditable="true"]');
        if (!target) return false;

        const isTextarea = target.tagName === 'TEXTAREA';
        const curText = isTextarea ? (target.value || '') : (target.textContent || '');

        // 若底层 insertText 已经成功灌入内容，触发输入事件更新发送按钮状态
        if (curText.includes(payload)) {
          target.dispatchEvent(new Event('input', { bubbles: true }));
          target.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }

        // 兜底分支 A：针对标准 textarea
        target.focus();
        if (isTextarea) {
          const start = target.selectionStart || 0;
          const end = target.selectionEnd || 0;
          target.value = curText.slice(0, start) + payload + curText.slice(end);
          target.selectionStart = target.selectionEnd = start + payload.length;
          target.dispatchEvent(new Event('input', { bubbles: true }));
          target.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }

        // 兜底分支 B：通过构造明确 Range 后的 execCommand 注入
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(target);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);

        let execOk = false;
        try {
          execOk = document.execCommand('insertText', false, payload);
        } catch (_) {}

        if (execOk && (target.textContent || '').includes(payload)) {
          target.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }

        // 兜底分支 C：ProseMirror 节点级直接构造与 InputEvent 派发
        let p = target.querySelector('p');
        if (!p) {
          p = document.createElement('p');
          target.appendChild(p);
        }
        if (p.classList.contains('placeholder')) {
          p.classList.remove('placeholder');
          p.removeAttribute('data-placeholder');
        }
        p.textContent = p.textContent ? (p.textContent + payload) : payload;

        const finalSel = window.getSelection();
        const finalRange = document.createRange();
        finalRange.selectNodeContents(p);
        finalRange.collapse(false);
        finalSel.removeAllRanges();
        finalSel.addRange(finalRange);

        try {
          target.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: payload, bubbles: true, cancelable: true }));
          target.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: payload, bubbles: true }));
        } catch (_) {
          target.dispatchEvent(new Event('input', { bubbles: true }));
        }
        target.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()`, true).catch(() => false);

      return true;
    } catch (err) {
      this.log?.warn?.(`[ChatViewController] 提示词填入异常: ${err?.message || err}`);
      return false;
    }
  }

  async clearSession() {
    const chatSession = session.fromPartition(CHAT_PARTITION);
    await chatSession.clearStorageData();
    await chatSession.clearCache();
    this.clearRetryState();
    this.lastError = '';
    this.errorLayer = '';
    await this.loadHome();
  }

  async checkAuthStatus() {
    try {
      const contents = this.view?.webContents;
      // 1. 若当前 WebContents 活跃并且位于 chatgpt.com 或 openai.com，优先通过页面实际 DOM 状态判定（眼见为实）
      if (contents && !contents.isDestroyed()) {
        const url = contents.getURL() || '';
        if (url.includes('chatgpt.com') || url.includes('openai.com')) {
          const domCheck = await contents.executeJavaScript(`(() => {
            const hasLoginTestId = Boolean(
              document.querySelector('[data-testid="login-button"]') ||
              document.querySelector('[data-testid="signup-button"]')
            );
            const buttons = Array.from(document.querySelectorAll('button, a'));
            const hasLoginText = buttons.some((b) => {
              const text = (b.textContent || '').trim();
              return text === 'Log in' || text === '登录' || text === 'Sign up' || text === '免费注册';
            });
            const hasLoginBtn = hasLoginTestId || hasLoginText;
            const hasProfile = Boolean(
              document.querySelector('[data-testid="profile-button"]') ||
              document.querySelector('[data-testid="accounts-profile-button"]') ||
              document.querySelector('button[aria-label*="User"]') ||
              document.querySelector('button[aria-label*="Profile"]') ||
              document.querySelector('#user-menu-button')
            );
            return { hasLoginBtn, hasProfile };
          })()`, true).catch(() => null);

          if (domCheck) {
            if (domCheck.hasLoginBtn && !domCheck.hasProfile) {
              return { loggedIn: false, reason: 'login_button_detected' };
            }
            if (domCheck.hasProfile) {
              return { loggedIn: true, reason: 'profile_detected' };
            }
          }
        }
      }

      // 2. Cookie 鉴权校验（检查 partition 内的 session token）
      const chatSession = session.fromPartition(CHAT_PARTITION);
      const cookies = await chatSession.cookies.get({}).catch(() => []);
      const hasAuthCookie = cookies.some((c) => {
        const name = (c.name || '').toLowerCase();
        const domain = (c.domain || '').toLowerCase();
        const isAuthName = name === '__secure-next-auth.session-token' || name.includes('session-token');
        const isTargetDomain = domain.includes('chatgpt.com') || domain.includes('openai.com');
        return isAuthName && isTargetDomain;
      });

      return { loggedIn: Boolean(hasAuthCookie), reason: hasAuthCookie ? 'auth_cookie_found' : 'no_auth_cookie' };
    } catch (err) {
      return { loggedIn: false, reason: 'error', error: err?.message };
    }
  }

  dispose() {
    this.clearRetryState();
    if (this.revealTimer) { clearTimeout(this.revealTimer); this.revealTimer = null; }
    if (this.revealWatchTimer) { clearInterval(this.revealWatchTimer); this.revealWatchTimer = null; }
    if (this.window && !this.window.isDestroyed()) this.window.removeListener('resize', this.boundResize);
    if (this.view && this.window && !this.window.isDestroyed()) {
      try { this.window.contentView.removeChildView(this.view); } catch { /* already detached */ }
    }
    if (this.view?.webContents && !this.view.webContents.isDestroyed()) {
      this.view.webContents.close();
    }
    this.view = null;
  }
}

module.exports = { ChatViewController, CHAT_HOME, CHAT_PARTITION, isAllowedNavigation, isAuthPopup, isChatGptNavigation, isTransientChatLoadError };
