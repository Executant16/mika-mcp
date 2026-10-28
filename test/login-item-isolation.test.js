const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../electron/main.js'), 'utf8');

function fixture(isPackaged, initial = false) {
  const calls = [];
  let stored = { startWithWindows: initial };
  let handler;
  const context = vm.createContext({
    app: { isPackaged, setLoginItemSettings: (value) => calls.push(value) },
    settings: { load: () => ({ ...stored }), save: (patch) => (stored = { ...stored, ...patch }) },
    secrets: { get: () => '' }, process: { execPath: 'D:/fixture/application.exe' },
    secureHandle: (_channel, callback) => { handler = callback; },
    invokeSafely: async (action) => ({ ok: true, data: await action() })
  });
  const start = source.indexOf("  secureHandle('settings:save'");
  const end = source.indexOf("  secureHandle('theme:sync-titlebar'", start);
  assert.ok(start >= 0 && end > start);
  vm.runInContext(source.slice(start, end), context);
  return { context, calls, save: (patch) => handler({}, patch), stored: () => stored };
}

test('development startup never registers or removes a login item, even with an old enabled preference', () => {
  const start = source.indexOf('  if (app.isPackaged) {', source.indexOf('app.whenReady().then(async () => {'));
  const end = source.indexOf('  session.defaultSession.setPermissionRequestHandler', start);
  assert.ok(start > 0 && end > start);
  const startup = source.slice(start, end);
  for (const initial of [true, false]) {
    const f = fixture(false, initial);
    vm.runInContext(startup, f.context);
    assert.equal(f.calls.length, 0);
  }
  const production = fixture(true, true);
  vm.runInContext(startup, production.context);
  assert.equal(production.calls.length, 1);
  assert.equal(production.calls[0].openAtLogin, true);
});

test('development settings ignore login changes while preserving unrelated settings', async () => {
  for (const initial of [false, true]) {
    const f = fixture(false, initial);
    await f.save({ startWithWindows: !initial, progressReportSeconds: 120 });
    assert.equal(f.calls.length, 0);
    assert.equal(f.stored().startWithWindows, initial);
    assert.equal(f.stored().progressReportSeconds, 120);
  }
});

test('production settings retain enable, disable and unchanged behavior', async () => {
  const f = fixture(true);
  await f.save({ startWithWindows: true });
  await f.save({ startWithWindows: true });
  await f.save({ startWithWindows: false });
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[0].openAtLogin, true);
  assert.equal(f.calls[1].openAtLogin, false);
  assert.equal(f.calls[0].path, 'D:/fixture/application.exe');
  assert.equal((source.match(/app\.setLoginItemSettings\(/g) || []).length, 2);
});
