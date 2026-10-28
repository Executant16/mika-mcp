const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ProductionStorageService } = require('../electron/services/productionStorageService');
const { runBootstrap } = require('../electron/services/storageBootstrap');

function fixture(t) {
  const parent = path.resolve(__dirname, '../tmp/storage-bootstrap-controller');
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, 'case-'));
  const paths = { userData: path.join(root, 'profile'), appData: path.join(root, 'app-data'),
    exe: path.join(root, 'application', 'Mika.exe'), temp: path.join(root, 'temp') };
  const options = { defaultRoot: paths.userData,
    locatorFile: path.join(paths.appData, 'Mika/storage/production.json'),
    legacyMemoryRoot: path.join(root, 'memory'), forbiddenRoots: [path.join(root, 'application')] };
  const previousEnv = { TEMP: process.env.TEMP, TMP: process.env.TMP, TMPDIR: process.env.TMPDIR,
    CODING_TOOLS_MCP_MEMORY_ROOT: process.env.CODING_TOOLS_MCP_MEMORY_ROOT };
  process.env.CODING_TOOLS_MCP_MEMORY_ROOT = options.legacyMemoryRoot;
  t.after(() => { for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  } });
  const calls = [];
  const handlers = {};
  let window;
  class Window {
    constructor(configuration) {
      window = this; this.configuration = configuration;
      this.webContents = { mainFrame: {}, send: (_event, state) => calls.push(['state', state]),
        setWindowOpenHandler() {}, on() {} };
    }
    isDestroyed() { return false; }
    on() {}
    async loadFile(filename) { calls.push(['page', filename]); }
    show() { calls.push(['show']); }
    focus() {}
    setMenu(menu) { calls.push(['menu', menu]); }
  }
  const electron = { app: { isPackaged: true, getPath: (name) => paths[name],
    getAppPath: () => path.join(root, 'application/app.asar'),
    requestSingleInstanceLock: () => { calls.push(['lock', paths.userData]); return true; },
    setPath: (name, value) => { paths[name] = value; }, whenReady: async () => {}, on() {},
    relaunch: () => calls.push(['relaunch']), quit: () => calls.push(['quit']) },
    BrowserWindow: Window, dialog: { showOpenDialog: async () => ({ canceled: true }) },
    ipcMain: { handle: (name, callback) => { handlers[name] = callback; } } };
  return { root, paths, options, calls, handlers, electron,
    event: () => ({ sender: window.webContents, senderFrame: window.webContents.mainFrame }), getWindow: () => window };
}

test('pending migration uses an isolated bootstrap Session, real worker and relaunches without loading normal services', async (t) => {
  const f = fixture(t);
  fs.mkdirSync(f.options.defaultRoot, { recursive: true });
  fs.writeFileSync(path.join(f.options.defaultRoot, 'settings.json'), '{"configVersion":9}');
  const target = path.join(f.root, 'target');
  const storage = new ProductionStorageService(f.options);
  storage.queue(storage.plan(target).id);
  await runBootstrap(f.electron);
  assert.equal(new ProductionStorageService(f.options).status().currentRoot, target);
  assert.notEqual(f.paths.userData, f.options.defaultRoot);
  assert.notEqual(f.paths.userData, target);
  assert.equal(f.getWindow().configuration.webPreferences.partition, 'mika-storage-bootstrap');
  assert.equal(f.getWindow().configuration.webPreferences.nodeIntegration, false);
  assert.deepEqual(f.calls.find(([event]) => event === 'lock'),
    ['lock', path.join(path.dirname(f.options.locatorFile), 'instance-lock')]);
  assert.equal(f.getWindow().configuration.icon, path.resolve(__dirname, '../electron/app-icon.png'));
  assert.ok(f.calls.some(([event, menu]) => event === 'menu' && menu === null));
  assert.equal(f.calls.some(([event]) => event === 'relaunch'), true);
  const phases = f.calls.filter(([event]) => event === 'state').map(([, state]) => state.progress.phase);
  assert.ok(phases.includes('copy'));
  assert.equal(phases.at(-1), 'done');
});

test('restore default backs up its old contents while the instance lock stays outside both profiles', async (t) => {
  const f = fixture(t);
  const source = path.join(f.root, 'custom-profile');
  const memory = path.join(source, 'memory-v1');
  fs.mkdirSync(memory, { recursive: true });
  fs.writeFileSync(path.join(source, 'settings.json'), '{"configVersion":9}');
  fs.writeFileSync(path.join(memory, 'config.json'), '{}');
  fs.writeFileSync(path.join(memory, 'sample.md'), 'preserved memory');
  fs.mkdirSync(f.options.defaultRoot, { recursive: true });
  fs.writeFileSync(path.join(f.options.defaultRoot, 'old.txt'), 'old default contents');
  const storage = new ProductionStorageService(f.options);
  storage.recover({ profile: source, memory });
  storage.queue(storage.plan().id);
  await runBootstrap(f.electron);
  const result = new ProductionStorageService(f.options);
  assert.equal(result.status().currentRoot, f.options.defaultRoot);
  assert.equal(result.status().error, '');
  assert.equal(fs.readFileSync(path.join(f.options.defaultRoot, 'memory-v1/sample.md'), 'utf8'), 'preserved memory');
  assert.equal(fs.readFileSync(path.join(result.state.displacedBackup, 'old.txt'), 'utf8'), 'old default contents');
  assert.ok(fs.existsSync(path.join(source, 'settings.json')));
  assert.deepEqual(f.calls.find(([event]) => event === 'lock'),
    ['lock', path.join(path.dirname(f.options.locatorFile), 'instance-lock')]);
});

test('corrupt locator opens recovery only and rejects IPC from other pages', async (t) => {
  const f = fixture(t);
  fs.mkdirSync(path.dirname(f.options.locatorFile), { recursive: true });
  fs.writeFileSync(f.options.locatorFile, '{broken');
  await runBootstrap(f.electron);
  const result = await f.handlers['boot-storage:status'](f.event());
  assert.equal(result.data.mode, 'recovery');
  assert.equal(result.data.currentRoot, '');
  assert.equal(f.calls.some(([event]) => event === 'relaunch'), false);
  assert.equal(fs.existsSync(f.options.defaultRoot), false);
  assert.equal((await f.handlers['boot-storage:restart'](f.event())).ok, false);
  assert.equal((await f.handlers['boot-storage:status']({ sender: {}, senderFrame: {} })).ok, false);
  assert.equal(fs.readFileSync(f.options.locatorFile, 'utf8'), '{broken');
});

test('interrupted migration with a usable source shows its error and permits one acknowledged restart', async (t) => {
  const f = fixture(t);
  fs.mkdirSync(f.options.defaultRoot, { recursive: true });
  fs.writeFileSync(path.join(f.options.defaultRoot, 'settings.json'), '{"configVersion":9}');
  const storage = new ProductionStorageService(f.options);
  storage.queue(storage.plan(path.join(f.root, 'target')).id);
  const locator = JSON.parse(fs.readFileSync(f.options.locatorFile, 'utf8'));
  locator.pending.phase = 'copying';
  fs.writeFileSync(f.options.locatorFile, JSON.stringify(locator));
  await runBootstrap(f.electron);
  const status = (await f.handlers['boot-storage:status'](f.event())).data;
  assert.equal(status.progress.phase, 'done');
  assert.match(status.error, /上次迁移中断/);
  assert.equal(status.currentRoot, f.options.defaultRoot);
  assert.equal(f.calls.some(([event]) => event === 'relaunch'), false);
  assert.equal((await f.handlers['boot-storage:restart'](f.event())).ok, true);
  assert.equal((await f.handlers['boot-storage:restart'](f.event())).ok, true);
  await new Promise((resolve) => setTimeout(resolve, 130));
  assert.equal(f.calls.filter(([event]) => event === 'relaunch').length, 1);
});

test('an existing but empty configured profile enters recovery instead of creating replacement settings', async (t) => {
  const f = fixture(t);
  const activeRoot = path.join(f.root, 'empty-profile');
  fs.mkdirSync(path.join(activeRoot, 'memory-v1'), { recursive: true });
  fs.mkdirSync(path.dirname(f.options.locatorFile), { recursive: true });
  fs.writeFileSync(f.options.locatorFile, JSON.stringify({ version: 1, defaultRoot: f.options.defaultRoot,
    activeRoot, memoryRoot: path.join(activeRoot, 'memory-v1') }));
  await runBootstrap(f.electron);
  const status = (await f.handlers['boot-storage:status'](f.event())).data;
  assert.equal(status.mode, 'recovery');
  assert.match(status.error, /缺少有效配置/);
  assert.equal(fs.existsSync(path.join(activeRoot, 'settings.json')), false);
});
