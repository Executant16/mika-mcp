const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('service descriptions stay concise and wrap instead of losing their meaning to ellipsis', () => {
  const html = read('renderer/health-dropdown.html');
  assert.match(html, /读写工作区，执行测试、构建和命令/);
  assert.match(html, /让 ChatGPT 调用本地 MCP 工具/);
  const descriptionRule = read('renderer/health-dropdown.css').match(/\.service-desc\s*\{([^}]+)\}/)?.[1];
  assert.ok(descriptionRule);
  assert.match(descriptionRule, /white-space:\s*normal/);
  assert.match(descriptionRule, /overflow-wrap:\s*anywhere/);
  assert.doesNotMatch(descriptionRule, /ellipsis|overflow:\s*hidden|nowrap/);
});

test('existing health popup includes webpage failures and updates when page recovers or loads', async () => {
  const elements = new Map();
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, {
      textContent: '', className: '', classList: { add() {}, remove() {} },
      addEventListener() {}, querySelector() { return get(`${id}-text`); }
    });
    return elements.get(id);
  };
  let emit;
  const context = vm.createContext({ window: { healthApi: {
    onData(callback) { emit = callback; },
    getData: async () => ({ ok: true, data: { mcpRunning: false, tunnelRunning: false,
      chatState: { error: 'ERR_BLOCKED_BY_CLIENT <test>', loading: false } } })
  } }, document: { getElementById: get, documentElement: { dataset: {} }, addEventListener() {} } });
  vm.runInContext(read('renderer/health-dropdown.js'), context);
  await new Promise(setImmediate);
  assert.equal(get('summaryPill').textContent, '3 项异常');
  assert.equal(get('chatStateTag').textContent, '加载失败');
  assert.equal(get('chatStateDescription').textContent, '网页请求被本机应用或拦截规则阻止。');
  assert.equal(get('chatErrorTechnical').textContent, 'ERR_BLOCKED_BY_CLIENT <test>');
  assert.equal(get('chatErrorDetails').hidden, false);
  assert.equal(get('chatErrorDetails').open, false);
  get('chatErrorDetails').open = true;
  assert.match(get('chatIconBox').className, /error/);
  emit({ mcpRunning: true, tunnelRunning: true });
  assert.equal(get('summaryPill').textContent, '1 项异常');
  assert.equal(get('chatErrorDetails').open, true, '服务心跳不收起用户展开的错误详情');
  emit({ chatState: { error: 'ERR_NAME_NOT_RESOLVED', loading: false } });
  assert.equal(get('chatErrorDetails').open, false);
  assert.match(get('chatStateDescription').textContent, /无法解析网站地址/);
  assert.equal(get('chatErrorTechnical').textContent, 'ERR_NAME_NOT_RESOLVED');
  emit({ chatState: { error: '', loading: true } });
  assert.equal(get('chatStateTag').textContent, '加载中');
  assert.equal(get('summaryPill').textContent, '网页加载中');
  assert.equal(get('chatErrorDetails').hidden, true);
  assert.equal(get('chatErrorTechnical').textContent, '');
  assert.doesNotMatch(get('summaryPill').className, /healthy|error/);
  emit({ chatState: { error: '', loading: false, isVerification: true } });
  assert.equal(get('chatStateTag').textContent, '安全验证中');
  assert.equal(get('summaryPill').textContent, '等待网页验证');
  assert.doesNotMatch(get('headerDot').className, /healthy|error/);
  emit({ chatState: null });
  assert.equal(get('summaryPill').textContent, '状态检查中');
  emit({ chatState: { error: '', loading: false, revealed: false } });
  assert.equal(get('chatStateTag').textContent, '加载中');
  assert.equal(get('summaryPill').textContent, '网页加载中');
  emit({ mcpRunning: false });
  assert.equal(get('summaryPill').textContent, '1 项异常');
  emit({ mcpRunning: true });
  emit({ chatState: { error: '', loading: false } });
  assert.equal(get('chatStateTag').textContent, '已就绪');
  assert.equal(get('summaryPill').textContent, '运行正常');
  assert.match(get('chatIconBox').className, /healthy/);
});

test('known Chromium errors get concise Chinese descriptions while unknown errors remain uncertain', () => {
  const source = read('renderer/health-dropdown.js');
  const start = source.indexOf('function describeChatError(');
  const end = source.indexOf('\nfunction updateView(', start);
  const describe = vm.runInNewContext(`(${source.slice(start, end).trim()})`);
  for (const [code, expected] of [
    ['ERR_BLOCKED_BY_CLIENT', /拦截规则/],
    ['ERR_INTERNET_DISCONNECTED', /未连接到互联网/],
    ['ERR_NAME_NOT_RESOLVED', /无法解析网站地址/],
    ['ERR_TIMED_OUT', /超时/], ['ERR_CONNECTION_TIMED_OUT', /超时/],
    ['ERR_CERT_DATE_INVALID', /证书校验失败/],
    ['ERR_PROXY_CONNECTION_FAILED', /代理连接失败/],
    ['ERR_TUNNEL_CONNECTION_FAILED', /代理连接失败/],
    ['ERR_CONNECTION_RESET', /连接已中断/], ['ERR_CONNECTION_CLOSED', /连接已中断/],
    ['ERR_UNKNOWN_FAILURE', /具体原因可查看技术详情/],
    ['plain error <img>', /具体原因可查看技术详情/]
  ]) assert.match(describe(`${code} (-20) loading 'https://chatgpt.com/'`), expected);
  const html = read('renderer/health-dropdown.html');
  assert.match(html, /<details class="chat-error-details" id="chatErrorDetails" hidden>/);
  assert.match(html, /<summary>技术详情<\/summary>/);
  assert.doesNotMatch(html, /id="chatError(?:Details|Technical)"[^>]*title=/);
});

test('toolbar summary counts webpage failures and the separate page indicator stays hidden', () => {
  const source = read('renderer/browser.js');
  const start = source.indexOf('function healthPillText(');
  const end = source.indexOf('\nfunction renderHealthPill(', start);
  const summary = vm.runInNewContext(`(${source.slice(start, end).trim()})`);
  assert.equal(summary(false, false, false, { error: 'blocked' }), '3 项异常');
  assert.equal(summary(true, true, false, { error: 'blocked' }), '网页加载失败');
  assert.equal(summary(true, true, false, { error: '' }), '服务正常');
  assert.equal(summary(true, true, false, null), '状态检查中');
  assert.equal(summary(true, true, false, { loading: true }), '网页加载中');
  assert.equal(summary(true, true, false, { revealed: false }), '网页加载中');
  assert.equal(summary(true, true, false, { isVerification: true, loading: true }), '等待网页验证');
  assert.equal(summary(false, true, false, { loading: true }), '本地工具未就绪');
  assert.equal(summary(false, false, true, { error: 'blocked' }), '网页加载失败');
  assert.match(source, /element\.hidden = true/);
  const main = read('electron/main.js');
  assert.match(main, /send\('service-health:data', \{ chatState: payload \}\)/);
  assert.equal((main.match(/(?:send\('service-health:data', |return )healthDropdownPayload\((?:snap\?\.status|latest\?\.status|status)\)/g) || []).length, 4);
  assert.match(read('renderer/health-dropdown.html'), /id="chatIconBox">\s*<svg/);
});

test('unknown runtime state is neutral rather than two failures or a healthy system', async () => {
  const elements = new Map();
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, { textContent: '', className: '',
      addEventListener() {}, querySelector() { return get(`${id}-text`); } });
    return elements.get(id);
  };
  let emit;
  vm.runInNewContext(read('renderer/health-dropdown.js'), {
    window: { healthApi: { onData(callback) { emit = callback; }, getData: async () => ({ ok: true, data: {} }) } },
    document: { getElementById: get, documentElement: { dataset: {} }, addEventListener() {} }
  });
  await new Promise(setImmediate);
  assert.equal(get('summaryPill').textContent, '状态检查中');
  assert.equal(get('mcpStateTag').textContent, '检查中');
  assert.equal(get('tunnelStateTag').textContent, '检查中');
  assert.equal(get('mcpActionBtn').disabled, true);
  assert.doesNotMatch(get('headerDot').className, /healthy|error/);
  emit({ chatState: { error: 'blocked' } });
  assert.equal(get('summaryPill').textContent, '1 项异常');
  emit({ mcpRunning: true, tunnelRunning: true, chatState: { error: '', loading: false } });
  assert.equal(get('summaryPill').textContent, '运行正常');
  assert.equal(get('mcpActionBtn').disabled, false);
});
