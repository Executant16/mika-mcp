const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const htmlSource = fs.readFileSync(path.join(__dirname, '../renderer/storage-bootstrap.html'), 'utf8');
const rendererSource = fs.readFileSync(path.join(__dirname, '../renderer/storage-bootstrap.js'), 'utf8');
const preloadSource = fs.readFileSync(path.join(__dirname, '../electron/storageBootstrapPreload.js'), 'utf8');

class ElementFixture {
  constructor(id) {
    this.id = id;
    this.textContent = '';
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this.value = 0;
    this.max = 1;
    this.listeners = new Map();
  }

  addEventListener(type, callback) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(callback);
    this.listeners.set(type, listeners);
  }

  async dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) || []) await listener({ target: this, ...event });
  }
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function createRendererFixture({ snapshot, choose, recover, restart } = {}) {
  const elements = new Map();
  const quitButtons = [new ElementFixture('quitProgressButton'), new ElementFixture('quitRecoveryButton')];
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new ElementFixture(id));
      return elements.get(id);
    },
    querySelectorAll(selector) {
      return selector === '.quit-button' ? quitButtons : [];
    }
  };
  const calls = { choose: [], recover: [], restart: 0, quit: 0 };
  let stateListener = null;
  const api = {
    status: async () => snapshot || { mode: 'recovery', error: '定位文件不可用', currentRoot: 'D:\\Mika-Data\\profile', locatorFile: 'D:\\Mika-Data\\locator.json' },
    choose: async (kind) => {
      calls.choose.push(kind);
      return choose ? choose(kind) : `D:\\Mika-Data\\${kind}`;
    },
    recover: async (payload) => {
      calls.recover.push(payload);
      return recover ? recover(payload) : { restarting: true };
    },
    restart: async () => {
      calls.restart += 1;
      return restart ? restart() : undefined;
    },
    quit: async () => { calls.quit += 1; },
    onState(callback) { stateListener = callback; return () => { stateListener = null; }; }
  };
  vm.runInNewContext(rendererSource, { window: { storageBootstrap: api }, document, console });
  return {
    api, calls, document, elements,
    element(id) { return document.getElementById(id); },
    quitButtons,
    emit(snapshotUpdate) { stateListener?.(snapshotUpdate); }
  };
}

function createPreloadFixture(resultFor = () => ({ ok: true, data: undefined })) {
  const ipcListeners = new Map();
  const invocations = [];
  let exposedApi;
  const electron = {
    contextBridge: { exposeInMainWorld(name, api) { assert.equal(name, 'storageBootstrap'); exposedApi = api; } },
    ipcRenderer: {
      invoke(channel, ...args) { invocations.push({ channel, args }); return Promise.resolve(resultFor(channel, args)); },
      on(channel, listener) { ipcListeners.set(channel, listener); },
      removeListener(channel, listener) { if (ipcListeners.get(channel) === listener) ipcListeners.delete(channel); }
    }
  };
  vm.runInNewContext(preloadSource, { require(name) { assert.equal(name, 'electron'); return electron; } });
  return { api: exposedApi, invocations, ipcListeners };
}

test('bootstrap page uses local-only CSP and contains recovery, progress, confirmation and exit controls', () => {
  assert.match(htmlSource, /default-src 'none';[^\"]*script-src 'self'; style-src 'self'/);
  assert.match(htmlSource, /href="design-tokens\.css"/);
  assert.match(htmlSource, /href="styles\.css"/);
  assert.match(htmlSource, /src="storage-bootstrap\.js"/);
  assert.doesNotMatch(htmlSource, /https?:\/\//i);
  assert.doesNotMatch(htmlSource, /\son[a-z]+\s*=/i);
  assert.doesNotMatch(htmlSource, /\sstyle\s*=/i);
  for (const id of [
    'progressPanel', 'progressPhase', 'progressFiles', 'progressBytes', 'progressMeter', 'continueButton',
    'recoveryPanel', 'currentRoot', 'locatorFile', 'chooseProfileButton', 'chooseMemoryButton',
    'allowEmptyMemory', 'recoveryConfirmation', 'confirmProfilePath', 'confirmLocatorFile',
    'confirmRecoveryButton', 'reviewRecoveryButton', 'retryRestartButton'
  ]) assert.match(htmlSource, new RegExp(`id="${id}"`), id);
  assert.match(htmlSource, /该配置原本未使用长期记忆，允许新建记忆子目录/);
  assert.match(htmlSource, /原定位配置/);
  assert.match(htmlSource, /退出/);
  assert.doesNotMatch(rendererSource, /\.innerHTML\s*=/);
});

test('preload maps the narrow API, unwraps IPC results, and validates subscription callbacks', async () => {
  const f = createPreloadFixture((channel, args) => ({ ok: true, data: { channel, args } }));
  assert.deepEqual(await f.api.status(), { channel: 'boot-storage:status', args: [] });
  assert.deepEqual(await f.api.choose('profile'), { channel: 'boot-storage:choose', args: ['profile'] });
  const payload = { profile: 'D:\\Mika\\profile', memory: null, allowEmptyMemory: true };
  assert.deepEqual(plain(await f.api.recover(payload)), { channel: 'boot-storage:recover', args: [payload] });
  await f.api.restart();
  await f.api.quit();
  assert.deepEqual(f.invocations.map((call) => call.channel), [
    'boot-storage:status', 'boot-storage:choose', 'boot-storage:recover', 'boot-storage:restart', 'boot-storage:quit'
  ]);
  assert.throws(() => f.api.choose('other'), /目录类型无效/);
  assert.throws(() => f.api.recover({ profile: 'D:\\profile', memory: null, allowEmptyMemory: false }), /选择记忆目录/);
  assert.throws(() => f.api.onState(null), /必须是函数/);

  let received;
  const unsubscribe = f.api.onState((state) => { received = state; });
  const state = { mode: 'progress', progress: { phase: 'copy' } };
  f.ipcListeners.get('boot-storage:state')({}, state);
  assert.equal(received, state);
  unsubscribe();
  assert.equal(f.ipcListeners.has('boot-storage:state'), false);

  const failed = createPreloadFixture(() => ({ ok: false, error: '定位配置损坏' }));
  await assert.rejects(failed.api.status(), /定位配置损坏/);
  const malformed = createPreloadFixture(() => ({ data: 'bad' }));
  await assert.rejects(malformed.api.status(), /IPC 返回格式无效/);
});

test('progress mode shows stage and counts without inventing a percentage when totals are absent', async () => {
  const f = createRendererFixture({ snapshot: {
    mode: 'progress', currentRoot: 'D:\\Mika\\profile', locatorFile: '',
    progress: { phase: 'copy', files: 3, bytes: 1536 }
  } });
  await flush();
  assert.equal(f.element('progressPanel').hidden, false);
  assert.equal(f.element('recoveryPanel').hidden, true);
  assert.equal(f.element('progressPhase').textContent, '复制数据');
  assert.equal(f.element('progressFiles').textContent, '已处理 3 个文件');
  assert.equal(f.element('progressBytes').textContent, '已处理 1.50 KB');
  assert.equal(f.element('progressMeter').hidden, true);
  assert.doesNotMatch(f.element('progressFiles').textContent + f.element('progressBytes').textContent, /%/);
});

test('progress completion uses an explicit continue action and reports restart failure for retry', async () => {
  const f = createRendererFixture({ snapshot: {
    mode: 'progress', progress: { phase: 'done', files: 4, totalFiles: 4, bytes: 4096, totalBytes: 4096 }
  }, restart: () => { throw new Error('重启被拒绝'); } });
  await flush();
  assert.equal(f.element('progressMeter').hidden, false);
  assert.equal(f.element('progressMeter').value, 4);
  assert.equal(f.element('continueButton').hidden, false);
  await f.element('continueButton').dispatch('click');
  assert.equal(f.calls.restart, 1);
  assert.equal(f.element('progressError').hidden, false);
  assert.match(f.element('progressError').textContent, /重启被拒绝/);
  assert.equal(f.element('continueButton').hidden, false);
  assert.match(f.element('continueButton').textContent, /重试/);
});

test('migration failure marked done keeps the existing profile usable and lets the user continue', async () => {
  const f = createRendererFixture({ snapshot: {
    mode: 'progress', error: '迁移未完成，继续使用原目录。',
    progress: { phase: 'done', files: 2, totalFiles: 3 }
  } });
  await flush();
  assert.equal(f.element('progressError').hidden, false);
  assert.equal(f.element('continueButton').hidden, false);
  assert.equal(f.element('continueButton').textContent, '使用原目录进入 Mika');
  assert.equal(f.element('progressTitle').textContent, '迁移未完成');
  assert.equal(f.element('progressPhase').textContent, '切换失败，保留原目录');
  assert.equal(f.element('progressMeter').hidden, true);
  assert.equal(f.element('progressDoneMessage').className, 'panel-description');
  assert.doesNotMatch(f.element('progressDescription').textContent, /已校验完成/);
  assert.equal(f.element('progressDoneMessage').textContent, '迁移未完成，原数据目录仍可用。可以进入 Mika 后检查存储设置。');
  await f.element('continueButton').dispatch('click');
  assert.equal(f.calls.restart, 1);
});

test('recovery requires a profile and either an existing memory folder or explicit empty-memory consent', async () => {
  const f = createRendererFixture({
    snapshot: { mode: 'recovery', error: '<img src=x onerror=alert(1)>', currentRoot: 'D:\\Mika\\old', locatorFile: 'D:\\Mika\\locator.json' },
    choose: (kind) => kind === 'profile' ? 'D:\\Mika\\profile\\<img onerror=1>' : 'D:\\Mika\\memory'
  });
  await flush();
  assert.equal(f.element('recoveryPanel').hidden, false);
  assert.equal(f.element('progressPanel').hidden, true);
  assert.equal(f.element('recoveryError').textContent, '<img src=x onerror=alert(1)>');
  assert.equal(f.element('reviewRecoveryButton').disabled, true);

  await f.element('chooseProfileButton').dispatch('click');
  assert.equal(f.element('profilePath').textContent, 'D:\\Mika\\profile\\<img onerror=1>');
  assert.equal(f.element('reviewRecoveryButton').disabled, true);
  await f.element('allowEmptyMemory').dispatch('change', { target: { checked: true } });
  assert.equal(f.element('reviewRecoveryButton').disabled, false);
  await f.element('reviewRecoveryButton').dispatch('click');
  assert.equal(f.element('recoveryConfirmation').hidden, false);
  assert.equal(f.element('confirmProfilePath').textContent, 'D:\\Mika\\profile\\<img onerror=1>');
  assert.equal(f.element('confirmMemoryPath').textContent, '将按确认创建空记忆子目录');
  assert.equal(f.element('confirmLocatorFile').textContent, 'D:\\Mika\\locator.json');
  assert.match(htmlSource, /确认后会先备份上方的原定位配置/);
  await f.element('confirmRecoveryButton').dispatch('click');
  assert.deepEqual(plain(f.calls.recover), [{ profile: 'D:\\Mika\\profile\\<img onerror=1>', memory: null, allowEmptyMemory: true }]);
  assert.equal(f.calls.restart, 0, 'recovery IPC has already queued the automatic relaunch');
  assert.equal(f.element('recoveryRestartMessage').hidden, false);
  assert.equal(f.element('reviewRecoveryButton').hidden, true);
  assert.equal(f.element('retryRestartButton').hidden, false);
  await f.element('retryRestartButton').dispatch('click');
  assert.equal(f.calls.restart, 1, 'manual re-entry is only a fallback action');
  assert.equal(f.quitButtons.length, 2);
});

test('existing memory selection satisfies recovery and duplicate submits stay locked until completion', async () => {
  const recovery = deferred();
  const f = createRendererFixture({
    snapshot: { mode: 'recovery', error: '原数据盘暂不可用', currentRoot: 'D:\\old', locatorFile: 'C:\\locator.json' },
    choose: (kind) => kind === 'profile' ? 'D:\\Mika\\profile' : 'D:\\Mika\\memory',
    recover: () => recovery.promise
  });
  await flush();
  await f.element('chooseProfileButton').dispatch('click');
  await f.element('chooseMemoryButton').dispatch('click');
  assert.equal(f.element('allowEmptyMemory').disabled, false);
  assert.equal(f.element('reviewRecoveryButton').disabled, false);
  await f.element('reviewRecoveryButton').dispatch('click');
  const firstSubmit = f.element('confirmRecoveryButton').dispatch('click');
  assert.equal(f.element('confirmRecoveryButton').disabled, true);
  await f.element('confirmRecoveryButton').dispatch('click');
  assert.equal(f.calls.recover.length, 1);
  recovery.resolve({ restarting: true });
  await firstSubmit;
  assert.deepEqual(plain(f.calls.recover[0]), { profile: 'D:\\Mika\\profile', memory: 'D:\\Mika\\memory', allowEmptyMemory: false });
  assert.equal(f.calls.restart, 0, 'successful recovery already queued restart');
  assert.equal(f.element('chooseProfileButton').disabled, true);
});

test('recover failure is visible and re-enables the confirmation action without restarting', async () => {
  const f = createRendererFixture({
    snapshot: { mode: 'recovery', error: '定位文件无效', currentRoot: '', locatorFile: 'D:\\locator.json' },
    recover: () => { throw new Error('所选目录不包含配置'); }
  });
  await flush();
  await f.element('chooseProfileButton').dispatch('click');
  await f.element('chooseMemoryButton').dispatch('click');
  await f.element('reviewRecoveryButton').dispatch('click');
  await f.element('confirmRecoveryButton').dispatch('click');
  assert.equal(f.element('recoveryOperationError').hidden, false);
  assert.match(f.element('recoveryOperationError').textContent, /所选目录不包含配置/);
  assert.equal(f.element('confirmRecoveryButton').disabled, false);
  assert.equal(f.calls.restart, 0);
});
