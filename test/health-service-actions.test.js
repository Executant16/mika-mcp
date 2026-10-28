const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../renderer/health-dropdown.js'), 'utf8');

async function fixture({ running = false, action, getData } = {}) {
  const elements = new Map();
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, {
      textContent: '', className: '', disabled: false, hidden: false,
      addEventListener(event, callback) { this[event] = callback; },
      querySelector() { return get(`${id}-text`); }
    });
    return elements.get(id);
  };
  const calls = [];
  let emit;
  const api = {
    onData(callback) { emit = callback; },
    getData: getData || (async () => ({ ok: true, data: { mcpRunning: running, tunnelRunning: false } })),
    startService: async () => { calls.push('start'); return action(); },
    restartService: async () => { calls.push('restart'); return action(); }
  };
  vm.runInNewContext(source, { window: { healthApi: api }, document: {
    getElementById: get, documentElement: { dataset: {} }, addEventListener() {}
  } });
  await new Promise(setImmediate);
  return { get, calls, emit: (value) => emit(value), click: () => get('mcpActionBtn').click(), refresh: () => get('healthRefreshBtn').click() };
}

test('structured start failure stays inline across heartbeats and never becomes HTML', async () => {
  const f = await fixture({ action: () => ({ ok: false, error: '端口被占用 <img>' }) });
  await f.click();
  assert.equal(f.get('mcpActionError').textContent, '上次启动失败：端口被占用 <img>');
  assert.equal(f.get('mcpActionError').hidden, false);
  f.emit({ mcpRunning: true });
  assert.equal(f.get('mcpStateTag').textContent, '运行中');
  assert.match(f.get('mcpActionError').textContent, /^上次启动失败/);
  assert.equal(f.get('mcpActionBtn').disabled, false);
  f.emit({ mcpRunning: false });
  assert.equal(f.get('mcpActionError').hidden, false);
  assert.deepEqual(f.calls, ['start']);
});

test('restart IPC rejection reports its actual reason and releases the button', async () => {
  const f = await fixture({ running: true, action: () => { throw new Error('进程退出超时'); } });
  await f.click();
  assert.equal(f.get('mcpActionError').textContent, '上次重启失败：进程退出超时');
  assert.deepEqual(f.calls, ['restart']);
  assert.equal(f.get('mcpActionBtn').disabled, false);
});

test('pending action blocks duplicate clicks despite heartbeats; successful retry clears error', async () => {
  let finish;
  let attempt = 0;
  const f = await fixture({ action: () => ++attempt === 1 ? { ok: false, error: '第一次失败' }
    : new Promise((resolve) => { finish = resolve; }) });
  await f.click();
  const pending = f.click();
  assert.equal(f.get('mcpActionError').hidden, true);
  f.emit({ mcpRunning: true });
  assert.equal(f.get('mcpActionBtn').disabled, true);
  assert.match(f.get('mcpActionBtn').className, /is-busy/);
  assert.equal(f.get('mcpActionBtn-text').textContent, '正在处理…');
  await f.click();
  assert.deepEqual(f.calls, ['start', 'start']);
  finish({ ok: true, data: {} });
  await pending;
  assert.equal(f.get('mcpActionBtn').disabled, false);
  assert.equal(f.get('mcpActionError').hidden, true);
  assert.equal(f.get('mcpActionBtn-text').textContent, '重启服务');
});

test('missing IPC response is not treated as success', async () => {
  const f = await fixture({ action: () => undefined });
  await f.click();
  assert.match(f.get('mcpActionError').textContent, /未收到有效的操作结果/);
  assert.equal(f.get('mcpActionBtn').disabled, false);
});

test('read failure is visible; manual refresh blocks repeats and clears the error on real success', async () => {
  let attempt = 0;
  let finish;
  const f = await fixture({ getData: () => {
    attempt += 1;
    if (attempt === 1) return Promise.resolve({ ok: false, error: '状态服务不可用 <test>' });
    return new Promise((resolve) => { finish = resolve; });
  } });
  assert.equal(f.get('summaryPill').textContent, '状态读取失败');
  assert.equal(f.get('healthReadError').hidden, false);
  assert.match(f.get('healthReadError').textContent, /状态服务不可用 <test>/);
  assert.equal(f.get('mcpStateTag').textContent, '未能确认');
  assert.equal(f.get('mcpActionBtn').disabled, true);
  const refresh = f.refresh();
  assert.equal(f.get('healthRefreshBtn').disabled, true);
  await f.refresh();
  assert.equal(attempt, 2);
  finish({ ok: true, data: { mcpRunning: true, tunnelRunning: true, chatState: { loading: false, error: '' } } });
  await refresh;
  assert.equal(f.get('healthReadError').hidden, true);
  assert.equal(f.get('summaryPill').textContent, '运行正常');
  assert.equal(f.get('healthRefreshBtn').disabled, false);
});

test('read rejection invalidates old service status; subsequent heartbeat restores it', async () => {
  let attempt = 0;
  const f = await fixture({ getData: async () => {
    if (++attempt > 1) throw new Error('读取请求中断');
    return { ok: true, data: { mcpRunning: true, tunnelRunning: true, chatState: { error: '' } } };
  } });
  await f.refresh();
  assert.equal(f.get('summaryPill').textContent, '状态读取失败');
  assert.equal(f.get('mcpStateTag').textContent, '未能确认');
  f.emit({ chatState: { error: '' } });
  assert.equal(f.get('healthReadError').hidden, false, '网页事件不能伪装成服务状态恢复');
  f.emit({ mcpRunning: true, tunnelRunning: true, statusError: '' });
  assert.equal(f.get('healthReadError').hidden, true);
  assert.equal(f.get('summaryPill').textContent, '运行正常');
});
