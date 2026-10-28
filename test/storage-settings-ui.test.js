const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, '../renderer/app.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, '../renderer/index.html'), 'utf8');

function functionSource(source, name) {
  const start = source.search(new RegExp(`^(?:async )?function ${name}\\(`, 'm'));
  assert.ok(start >= 0, `function ${name} exists`);
  const tail = source.slice(start + 1);
  const next = tail.search(/^(?:async )?function /m);
  return source.slice(start, next < 0 ? source.length : start + 1 + next);
}

function fixture() {
  const elements = new Map();
  function element(selector) {
    if (!elements.has(selector)) {
      elements.set(selector, {
        textContent: '', disabled: false, attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        addEventListener(event, handler) { this[event] = handler; }
      });
    }
    return elements.get(selector);
  }
  const storageView = { status: null, loading: false, busy: false, restarting: false, message: '', error: '' };
  const ok = (data) => ({ ok: true, data });
  const calls = { status: 0, choose: 0, plans: [], applied: [], opened: 0, confirms: [], toasts: [] };
  const api = {
    storageStatus: async () => { calls.status += 1; return ok({ channel: 'production', currentRoot: 'C:\\Mika\\profile', defaultRoot: 'C:\\Mika\\profile', memoryRoot: 'C:\\Mika\\profile\\memory-v1', canChange: true }); },
    storageChoose: async () => { calls.choose += 1; return ok({ target: 'D:\\Mika-Data\\profile' }); },
    storagePlan: async (target) => { calls.plans.push(target); return ok({ id: 'plan-1', source: 'C:\\Mika\\profile', target: target || 'C:\\Mika\\profile', bytes: 2048, files: 4, restoringDefault: target === null }); },
    storageApply: async (id) => { calls.applied.push(id); return ok({ restarting: true }); },
    storageOpen: async () => { calls.opened += 1; return ok(true); }
  };
  let confirmResult = true;
  const context = vm.createContext({
    storageView, api, $, $$: () => [],
    unwrap(result) { if (!result?.ok) throw new Error(result?.error || 'IPC 操作失败'); return result.data; },
    storageChannelLabel: undefined,
    showModernConfirm: async (options) => { calls.confirms.push(options); return confirmResult; },
    toast: (...args) => calls.toasts.push(args),
    console
  });
  function $(selector) { return element(selector); }
  context.$ = $;
  for (const name of [
    'storageChannelLabel', 'formatStorageBytes', 'storagePathsMatch', 'renderStorageSettings',
    'refreshStorageStatus', 'runStorageSettingsAction', 'planAndApplyStorageChange',
    'handleOpenStorageDirectory', 'handleChooseStorageDirectory', 'handleRestoreDefaultStorage',
    'bindStorageSettingsEvents'
  ]) {
    vm.runInContext(functionSource(appSource, name), context);
  }
  return { context, storageView, api, calls, element, ok, setConfirmResult(value) { confirmResult = value; } };
}

test('settings markup exposes paths, channel, actions and live status', () => {
  for (const id of ['storageSettingsSection', 'storageChannelValue', 'storageCurrentPath', 'storageDefaultPath', 'storageMemoryPath', 'storageStatusMessage', 'storageOpenBtn', 'storageChangeBtn', 'storageResetBtn']) {
    assert.match(htmlSource, new RegExp(`id="${id}"`), id);
  }
  assert.match(htmlSource, /数据与存储/);
  assert.match(htmlSource, /长期记忆目录/);
});

test('development status shows actual paths and disables change and restore actions', () => {
  const { context, storageView, element } = fixture();
  storageView.status = { channel: 'development', currentRoot: 'D:\\Mika-Data\\development\\repo\\profile', defaultRoot: 'D:\\Mika-Data\\development\\repo\\profile', memoryRoot: 'D:\\Mika-Data\\development\\repo\\profile\\memory-v1', canChange: false };
  context.renderStorageSettings();
  assert.equal(element('#storageChannelValue').textContent, '开发版');
  assert.equal(element('#storageCurrentPath').textContent, storageView.status.currentRoot);
  assert.equal(element('#storageMemoryPath').textContent, storageView.status.memoryRoot);
  assert.equal(element('#storageOpenBtn').disabled, false);
  assert.equal(element('#storageChangeBtn').disabled, true);
  assert.equal(element('#storageResetBtn').disabled, true);
});

test('healthy storage is quiet and distinguishes default from custom paths without shortening them', async () => {
  const { context, storageView, element } = fixture();
  await context.refreshStorageStatus();
  assert.equal(element('#storageStatusMessage').hidden, true);
  assert.equal(element('#storageStatusMessage').textContent, '');
  assert.equal(element('#storageLocationKind').textContent, '默认位置');
  storageView.status.currentRoot = 'D:\\自定义目录\\很长的完整路径\\profile';
  context.renderStorageSettings();
  assert.equal(element('#storageLocationKind').textContent, '自定义位置');
  assert.equal(element('#storageCurrentPath').textContent, storageView.status.currentRoot);
  storageView.status.error = '迁移失败，原目录仍可用';
  context.renderStorageSettings();
  assert.equal(element('#storageStatusMessage').hidden, false);
  assert.equal(element('#storageStatusMessage').attributes['data-error'], 'true');
});

test('storage layout separates actions from full-width paths and groups secondary locations', () => {
  const section = htmlSource.slice(htmlSource.indexOf('<section class="settings-section storage-settings"'), htmlSource.indexOf('<!-- Panel 2: 连接 -->'));
  assert.match(section, /<code class="storage-path storage-current-path" id="storageCurrentPath">/);
  assert.match(section, /<details class="storage-details">/);
  assert.match(section, /<summary>默认位置与长期记忆<\/summary>/);
  assert.match(section, /不是恢复出厂设置/);
  const css = fs.readFileSync(path.join(__dirname, '../renderer/styles.css'), 'utf8');
  assert.match(css, /\.storage-settings \.storage-path\s*\{[^}]*overflow-wrap:anywhere/);
  assert.match(css, /\.storage-settings \.storage-actions\s*\{[^}]*flex-wrap:wrap/);
});

test('storage status failures show the returned detail and keep destructive controls disabled', async () => {
  const { context, api, element } = fixture();
  api.storageStatus = async () => { throw new Error('存储定位配置不可读取'); };
  await context.refreshStorageStatus();
  assert.match(element('#storageStatusMessage').textContent, /存储定位配置不可读取/);
  assert.equal(element('#storageCurrentPath').textContent, '无法确认');
  assert.equal(element('#storageOpenBtn').disabled, true);
  assert.equal(element('#storageChangeBtn').disabled, true);
});

test('change plans and asks for explicit confirmation before applying, then reports queued restart without polling', async () => {
  const { context, storageView, calls, element } = fixture();
  storageView.status = { channel: 'production', currentRoot: 'C:\\Mika\\profile', defaultRoot: 'C:\\Mika\\profile', memoryRoot: 'C:\\Mika\\profile\\memory-v1', canChange: true };
  await context.handleChooseStorageDirectory();
  assert.equal(calls.choose, 1);
  assert.deepEqual(calls.plans, ['D:\\Mika-Data\\profile']);
  assert.deepEqual(calls.applied, ['plan-1']);
  assert.match(calls.confirms[0].message, /C:\\Mika\\profile/);
  assert.match(calls.confirms[0].message, /D:\\Mika-Data\\profile/);
  assert.match(calls.confirms[0].message, /4 个文件/);
  assert.match(calls.confirms[0].message, /2\.00 KB/);
  assert.match(calls.confirms[0].message, /原目录会保留/);
  assert.match(calls.confirms[0].message, /停止正在运行的任务/);
  assert.match(calls.confirms[0].message, /自动重启/);
  assert.equal(storageView.restarting, true);
  assert.match(element('#storageStatusMessage').textContent, /正在重启/);
  assert.equal(element('#storageChangeBtn').disabled, true);
  assert.equal(calls.status, 0, 'successful apply must not poll storage status');
});

test('cancelled migration never applies and restoring default plans with null', async () => {
  const change = fixture();
  change.storageView.status = { channel: 'production', currentRoot: 'C:\\Mika\\profile', defaultRoot: 'C:\\Mika\\profile', memoryRoot: 'C:\\Mika\\profile\\memory-v1', canChange: true };
  change.setConfirmResult(false);
  await change.context.handleChooseStorageDirectory();
  assert.deepEqual(change.calls.applied, []);
  assert.match(change.element('#storageStatusMessage').textContent, /已取消/);

  const restore = fixture();
  restore.storageView.status = { channel: 'production', currentRoot: 'D:\\custom\\profile', defaultRoot: 'C:\\Mika\\profile', memoryRoot: 'D:\\custom\\profile\\memory-v1', canChange: true };
  await restore.context.handleRestoreDefaultStorage();
  assert.deepEqual(restore.calls.plans, [null]);
  assert.equal(restore.calls.confirms[0].title, '恢复默认数据位置');
  assert.deepEqual(restore.calls.applied, ['plan-1']);
});

test('apply errors are visible and release the in-progress lock', async () => {
  const { context, storageView, api, calls, element } = fixture();
  storageView.status = { channel: 'production', currentRoot: 'C:\\Mika\\profile', defaultRoot: 'C:\\Mika\\profile', memoryRoot: 'C:\\Mika\\profile\\memory-v1', canChange: true };
  api.storageApply = async () => { throw new Error('目标磁盘空间不足'); };
  await context.handleChooseStorageDirectory();
  assert.equal(storageView.busy, false);
  assert.match(element('#storageStatusMessage').textContent, /目标磁盘空间不足/);
  assert.equal(element('#storageChangeBtn').disabled, false);
  assert.equal(calls.toasts.length, 1);
});

test('preview API cannot migrate storage and reports changing as unavailable', async () => {
  const previewContext = vm.createContext({});
  vm.runInContext(functionSource(appSource, 'createPreviewApi'), previewContext);
  const previewApi = previewContext.createPreviewApi();
  const status = await previewApi.storageStatus();
  assert.equal(status.data.canChange, false);
  assert.equal((await previewApi.storageChoose()).data, null);
  await assert.rejects(previewApi.storagePlan(null), /静态预览模式不支持迁移/);
  await assert.rejects(previewApi.storageApply('plan'), /静态预览模式不支持迁移/);
});

test('login-item control is available only for confirmed production identity', () => {
  const { context, storageView, element } = fixture();
  for (const channel of ['development', 'preview', undefined]) {
    storageView.status = { channel };
    context.renderStorageSettings();
    assert.equal(element('#startWithWindowsToggle').disabled, true);
    assert.match(element('#startWithWindowsHint').textContent, /仅正式版/);
  }
  storageView.status = { channel: 'production' };
  context.renderStorageSettings();
  assert.equal(element('#startWithWindowsToggle').disabled, false);
});
