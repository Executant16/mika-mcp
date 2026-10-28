const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const { ProductionStorageService } = require('../electron/services/productionStorageService');
const { inspectBootstrap } = require('../electron/services/storageBootstrap');

const evidenceRoot = path.resolve(__dirname, '../tmp/storage-bootstrap');
const workerFile = path.resolve(__dirname, '../electron/services/storageBootstrapWorker.js');

function fixture(name) {
  fs.mkdirSync(evidenceRoot, { recursive: true });
  const root = fs.mkdtempSync(path.join(evidenceRoot, name + '-' + process.pid + '-'));
  return {
    root,
    defaultRoot: path.join(root, 'default-profile'),
    locatorFile: path.join(root, 'locator', 'production.json'),
    legacyMemoryRoot: path.join(root, 'legacy-memory'),
    forbiddenRoots: [path.join(root, 'installation')]
  };
}

function storage(f, extra = {}) {
  return new ProductionStorageService({ ...f, ...extra });
}

function writeProfile(profile, extra = {}) {
  fs.mkdirSync(profile, { recursive: true });
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ configVersion: 1, ...extra }));
}

function writeLocator(f, value) {
  fs.mkdirSync(path.dirname(f.locatorFile), { recursive: true });
  fs.writeFileSync(f.locatorFile, JSON.stringify(value, null, 2));
}

function fakeApp(root, isPackaged = true) {
  const paths = {
    userData: path.join(root, 'default-profile'),
    appData: path.join(root, 'app-data'),
    exe: path.join(root, 'installation', 'mika.exe')
  };
  return {
    isPackaged,
    paths,
    getPath(name) { return paths[name]; },
    getAppPath() { return path.join(root, 'installation'); }
  };
}

function runWorker(workerData) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerFile, { workerData });
    const messages = [];
    worker.on('message', (message) => messages.push(message));
    worker.once('error', reject);
    worker.once('exit', (code) => resolve({ code, messages }));
  });
}

test('recovery backs up a damaged locator and selects existing profile and memory', () => {
  const f = fixture('recover-damaged-locator');
  const profile = path.join(f.root, 'selected-profile');
  const memory = path.join(f.root, 'selected-memory');
  const locatorBytes = '{damaged locator fixture';
  writeProfile(profile);
  fs.mkdirSync(memory, { recursive: true });
  fs.writeFileSync(path.join(profile, 'account.json'), 'profile fixture');
  fs.writeFileSync(path.join(memory, 'config.json'), '{"version":1}');
  fs.writeFileSync(path.join(memory, 'memory.md'), 'memory fixture');
  fs.mkdirSync(path.dirname(f.locatorFile), { recursive: true });
  fs.writeFileSync(f.locatorFile, locatorBytes);
  const progress = [];

  const result = storage(f, { recovery: true, onProgress: (item) => progress.push(item) })
    .recover({ profile, memory, allowEmptyMemory: false });

  assert.equal(result.currentRoot, profile);
  assert.equal(result.memoryRoot, memory);
  assert.equal(fs.readFileSync(path.join(profile, 'account.json'), 'utf8'), 'profile fixture');
  assert.equal(fs.readFileSync(path.join(memory, 'memory.md'), 'utf8'), 'memory fixture');
  assert.ok(progress.some((item) => item.phase === 'inventory'));
  const backup = fs.readdirSync(path.dirname(f.locatorFile))
    .find((name) => name.startsWith('production.json.recovery-backup-'));
  assert.ok(backup, 'the damaged locator has a recovery backup');
  assert.equal(fs.readFileSync(path.join(path.dirname(f.locatorFile), backup), 'utf8'), locatorBytes);
  const saved = JSON.parse(fs.readFileSync(f.locatorFile, 'utf8'));
  assert.equal(saved.activeRoot, profile);
  assert.equal(saved.memoryRoot, memory);
});

test('recovery rejects missing and empty profiles without creating replacement data', async (t) => {
  await t.test('missing profile', () => {
    const f = fixture('recover-missing-profile');
    const missing = path.join(f.root, 'missing-profile');
    assert.throws(() => storage(f, { recovery: true }).recover({ profile: missing, allowEmptyMemory: true }), /缺失或空白/);
    assert.equal(fs.existsSync(missing), false);
    assert.equal(fs.existsSync(f.locatorFile), false);
  });

  await t.test('empty profile', () => {
    const f = fixture('recover-empty-profile');
    const empty = path.join(f.root, 'empty-profile');
    fs.mkdirSync(empty, { recursive: true });
    assert.throws(() => storage(f, { recovery: true }).recover({ profile: empty, allowEmptyMemory: true }), /缺少 settings.json/);
    assert.deepEqual(fs.readdirSync(empty), []);
    assert.equal(fs.existsSync(f.locatorFile), false);
  });
});

test('recovery creates profile/memory-v1 only after explicit empty-memory confirmation', () => {
  const f = fixture('recover-explicit-empty-memory');
  const profile = path.join(f.root, 'selected-profile');
  writeProfile(profile);
  const memoryRoot = path.join(profile, 'memory-v1');
  const service = storage(f, { recovery: true });

  assert.throws(() => service.recover({ profile, allowEmptyMemory: false }), /记忆目录不存在/);
  assert.equal(fs.existsSync(memoryRoot), false);
  const result = service.recover({ profile, allowEmptyMemory: true });

  assert.equal(result.memoryRoot, memoryRoot);
  assert.equal(fs.existsSync(memoryRoot), true);
  assert.deepEqual(fs.readdirSync(memoryRoot), []);
  assert.equal(JSON.parse(fs.readFileSync(f.locatorFile, 'utf8')).activeRoot, profile);
});

test('recovery rejects linked profiles, installation directories, and profiles with a live Runtime PID', async (t) => {
  await t.test('linked profile', (t) => {
    const f = fixture('recover-linked-profile');
    const real = path.join(f.root, 'real-profile');
    const linked = path.join(f.root, 'linked-profile');
    writeProfile(real);
    try {
      fs.symlinkSync(real, linked, process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error) {
      if (['EACCES', 'EPERM', 'ENOTSUP'].includes(error.code)) {
        t.skip('directory link creation is unavailable: ' + error.code);
        return;
      }
      throw error;
    }
    assert.throws(() => storage(f, { recovery: true }).recover({ profile: linked, allowEmptyMemory: true }), /链接或非目录/);
    assert.equal(fs.existsSync(f.locatorFile), false);
  });

  await t.test('installation directory', () => {
    const f = fixture('recover-installation-profile');
    writeProfile(f.forbiddenRoots[0]);
    assert.throws(() => storage(f, { recovery: true }).recover({ profile: f.forbiddenRoots[0], allowEmptyMemory: true }), /程序或定位配置目录重叠/);
    assert.equal(fs.existsSync(f.locatorFile), false);
  });

  await t.test('live Runtime PID', () => {
    const f = fixture('recover-live-pid');
    const profile = path.join(f.root, 'live-profile');
    writeProfile(profile);
    fs.writeFileSync(path.join(profile, 'runtime-state.json'), JSON.stringify({ nativePid: process.pid }));
    const memory = path.join(f.root, 'selected-memory');
    fs.mkdirSync(memory, { recursive: true });
    fs.writeFileSync(path.join(memory, 'config.json'), '{}');
    assert.throws(() => storage(f, { recovery: true }).recover({ profile, memory, allowEmptyMemory: false }), /仍有旧 Runtime\/Tunnel 进程/);
    assert.equal(fs.existsSync(f.locatorFile), false);
  });
});

test('inspectBootstrap skips development, normal profiles, and marks pending migrations for progress', () => {
  const devRoot = fixture('inspect-development').root;
  const devApp = fakeApp(devRoot, false);
  let pathReads = 0;
  devApp.getPath = () => { pathReads += 1; throw new Error('development inspection must not read production paths'); };
  assert.deepEqual(inspectBootstrap(devApp, {}), { needed: false });
  assert.equal(pathReads, 0);

  const normalRoot = fixture('inspect-normal').root;
  const normalApp = fakeApp(normalRoot);
  writeProfile(normalApp.paths.userData);
  assert.deepEqual(inspectBootstrap(normalApp, {}), { needed: false });

  const pendingRoot = fixture('inspect-pending').root;
  const pendingApp = fakeApp(pendingRoot);
  const pendingOptions = {
    version: 1,
    defaultRoot: pendingApp.paths.userData,
    pending: {
      id: require('node:crypto').randomUUID(),
      phase: 'queued',
      source: pendingApp.paths.userData,
      target: path.join(pendingRoot, 'new-profile')
    }
  };
  const pendingLocator = path.join(pendingApp.paths.appData, 'Mika', 'storage', 'production.json');
  fs.mkdirSync(path.dirname(pendingLocator), { recursive: true });
  fs.writeFileSync(pendingLocator, JSON.stringify(pendingOptions));
  const pending = inspectBootstrap(pendingApp, {});
  assert.equal(pending.needed, true);
  assert.equal(pending.mode, 'progress');
  assert.equal(pending.currentRoot, pendingApp.paths.userData);
});

test('inspectBootstrap sends a damaged locator or missing active profile to recovery', () => {
  const damagedRoot = fixture('inspect-damaged-locator').root;
  const damagedApp = fakeApp(damagedRoot);
  const damagedLocator = path.join(damagedApp.paths.appData, 'Mika', 'storage', 'production.json');
  fs.mkdirSync(path.dirname(damagedLocator), { recursive: true });
  fs.writeFileSync(damagedLocator, '{broken');
  const damaged = inspectBootstrap(damagedApp, {});
  assert.equal(damaged.needed, true);
  assert.equal(damaged.mode, 'recovery');
  assert.match(damaged.error, /JSON|position|Unexpected/i);

  const missingRoot = fixture('inspect-missing-active').root;
  const missingApp = fakeApp(missingRoot);
  const missingLocator = path.join(missingApp.paths.appData, 'Mika', 'storage', 'production.json');
  const activeRoot = path.join(missingRoot, 'missing-active-profile');
  fs.mkdirSync(path.dirname(missingLocator), { recursive: true });
  fs.writeFileSync(missingLocator, JSON.stringify({
    version: 1,
    defaultRoot: missingApp.paths.userData,
    activeRoot,
    memoryRoot: path.join(activeRoot, 'memory-v1')
  }));
  const missing = inspectBootstrap(missingApp, {});
  assert.equal(missing.needed, true);
  assert.equal(missing.mode, 'recovery');
  assert.match(missing.error, /已配置的数据目录不可用/);
  assert.equal(fs.existsSync(activeRoot), false);
});

test('main checks bootstrap before loading normal persistent stores', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../electron/main.js'), 'utf8');
  const bootstrap = source.indexOf("require('./services/storageBootstrap').shouldBootstrap()");
  assert.notEqual(bootstrap, -1);
  for (const moduleName of [
    './services/dataDirectoryService',
    './services/settingsStore',
    './services/secretStore',
    './services/runtimeOrchestrator'
  ]) {
    const imported = source.indexOf("require('" + moduleName + "')");
    assert.notEqual(imported, -1, 'expected main entry import: ' + moduleName);
    assert.ok(bootstrap < imported, 'bootstrap must run before ' + moduleName);
  }
});

test('planAsync registers the real worker plan in the parent service before queueing it', async () => {
  const f = fixture('async-plan-registration');
  fs.mkdirSync(f.defaultRoot, { recursive: true });
  fs.writeFileSync(path.join(f.defaultRoot, 'preferences.json'), 'plan fixture');
  const target = path.join(f.root, 'selected-target');
  const service = storage(f);

  const plan = await service.planAsync(target);
  assert.equal(plan.target, target);
  assert.equal(plan.source, f.defaultRoot);
  assert.equal(plan.files, 1);
  assert.equal(plan.bytes, Buffer.byteLength('plan fixture'));
  assert.equal(service.validatePlan(plan.id).target, target);

  service.queue(plan.id);
  const queued = JSON.parse(fs.readFileSync(f.locatorFile, 'utf8'));
  assert.equal(queued.pending.id, plan.id);
  assert.equal(queued.pending.phase, 'queued');
  assert.equal(queued.pending.target, target);
  assert.equal(fs.existsSync(target), false);
});

test('the real migration Worker reports every phase and copies verified profile and memory while preserving sources', async () => {
  const f = fixture('real-migration-worker');
  const profileBytes = Buffer.from('worker profile fixture');
  const sessionBytes = Buffer.from('worker session fixture');
  const memoryBytes = Buffer.from('worker memory fixture');
  fs.mkdirSync(path.join(f.defaultRoot, 'account'), { recursive: true });
  fs.writeFileSync(path.join(f.defaultRoot, 'settings.json'), JSON.stringify({ configVersion: 1 }));
  fs.writeFileSync(path.join(f.defaultRoot, 'account', 'session.dat'), sessionBytes);
  const settingsBytes = fs.readFileSync(path.join(f.defaultRoot, 'settings.json'));
  fs.mkdirSync(f.legacyMemoryRoot, { recursive: true });
  fs.writeFileSync(path.join(f.legacyMemoryRoot, 'config.json'), '{}');
  fs.writeFileSync(path.join(f.legacyMemoryRoot, 'memory.md'), memoryBytes);
  const target = path.join(f.root, 'migrated-profile');
  const planned = storage(f);
  planned.queue(planned.plan(target).id);

  const { code, messages } = await runWorker({ action: 'migrate', options: f });
  assert.equal(code, 0);
  const phases = messages.filter((message) => message.type === 'progress').map((message) => message.progress.phase);
  for (const phase of ['inventory', 'copy', 'verify', 'commit', 'done']) {
    assert.ok(phases.includes(phase), 'worker reports phase ' + phase);
  }
  const done = messages.find((message) => message.type === 'progress' && message.progress.phase === 'done');
  assert.ok(done);
  assert.equal(done.progress.files, 4);
  assert.equal(done.progress.bytes, settingsBytes.length + sessionBytes.length + Buffer.byteLength('{}') + memoryBytes.length);
  const result = messages.find((message) => message.type === 'result');
  assert.ok(result, 'worker returns a result after commit');
  assert.equal(result.status.currentRoot, target);
  assert.deepEqual(messages.filter((message) => message.type === 'failure'), []);

  assert.deepEqual(fs.readFileSync(path.join(target, 'settings.json')), settingsBytes);
  assert.deepEqual(fs.readFileSync(path.join(target, 'account', 'session.dat')), sessionBytes);
  assert.equal(fs.readFileSync(path.join(target, 'memory-v1', 'memory.md'), 'utf8'), memoryBytes.toString('utf8'));
  assert.equal(fs.readFileSync(path.join(target, 'memory-v1', 'config.json'), 'utf8'), '{}');
  assert.deepEqual(fs.readFileSync(path.join(f.defaultRoot, 'account', 'session.dat')), sessionBytes);
  assert.equal(fs.readFileSync(path.join(f.legacyMemoryRoot, 'memory.md'), 'utf8'), memoryBytes.toString('utf8'));
});

test('a real Worker failure is returned without changing the active data root', async () => {
  const f = fixture('worker-failure-no-switch');
  fs.mkdirSync(path.dirname(f.locatorFile), { recursive: true });
  const damagedLocator = '{worker locator failure fixture';
  fs.writeFileSync(f.locatorFile, damagedLocator);
  const target = path.join(f.root, 'must-not-become-active');

  const { code, messages } = await runWorker({ action: 'migrate', options: f });

  assert.equal(code, 0);
  const failure = messages.find((message) => message.type === 'failure');
  assert.ok(failure, 'worker returns a failure message');
  assert.equal(typeof failure.error, 'string');
  assert.deepEqual(messages.filter((message) => message.type === 'result'), []);
  assert.equal(fs.existsSync(target), false);
  assert.equal(fs.readFileSync(f.locatorFile, 'utf8'), damagedLocator);
});
