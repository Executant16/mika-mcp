const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { ProductionStorageService } = require('../electron/services/productionStorageService');

const scratchRoot = path.resolve(__dirname, '../tmp/production-storage');

function fixture(t, name = 'case') {
  fs.mkdirSync(scratchRoot, { recursive: true });
  const root = fs.mkdtempSync(path.join(scratchRoot, `${name}-`));
  // Preserve per-run evidence; do not recursively remove migration fixtures.
  return {
    root,
    defaultRoot: path.join(root, 'profile'),
    locatorFile: path.join(root, 'locator', 'production-data.json'),
    legacyMemoryRoot: path.join(root, 'legacy-memory'),
    forbiddenRoots: [path.join(root, 'application')]
  };
}

function service(options) {
  return new ProductionStorageService(options);
}

function appStub() {
  return {
    paths: {},
    setPath(name, value) { this.paths[name] = value; }
  };
}

function writeLocator(f, value) {
  fs.mkdirSync(path.dirname(f.locatorFile), { recursive: true });
  fs.writeFileSync(f.locatorFile, JSON.stringify(value, null, 2));
}

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

test('without a locator the production default remains unchanged', (t) => {
  const f = fixture(t, 'default');
  const storage = service(f);
  const app = appStub();
  const env = { KEEP: 'unchanged' };

  assert.deepEqual(storage.configure(app, env), {
    channel: 'production', userData: f.defaultRoot, changed: false
  });
  assert.deepEqual(app.paths, {});
  assert.deepEqual(env, { KEEP: 'unchanged' });
  assert.equal(storage.status().currentRoot, f.defaultRoot);
});

test('first migration copies the profile and external memory with matching hashes and applies the saved paths', (t) => {
  const f = fixture(t, 'initial-migration');
  const target = path.join(f.root, 'custom-profile');
  const profileBytes = Buffer.from('profile preferences\n');
  const sessionBytes = Buffer.from('session fixture\n');
  const memoryBytes = Buffer.from('legacy memory fixture\n');
  fs.mkdirSync(path.join(f.defaultRoot, 'account'), { recursive: true });
  fs.writeFileSync(path.join(f.defaultRoot, 'settings.json'), JSON.stringify({ configVersion: 9, theme: 'dark' }));
  fs.writeFileSync(path.join(f.defaultRoot, 'preferences.json'), profileBytes);
  fs.writeFileSync(path.join(f.defaultRoot, 'account', 'session.dat'), sessionBytes);
  fs.writeFileSync(path.join(f.defaultRoot, 'runtime-state.json'), JSON.stringify({ transient: true }));
  fs.writeFileSync(path.join(f.defaultRoot, 'runtime-state.json.bak'), 'transient backup');
  fs.mkdirSync(path.join(f.defaultRoot, 'runtime-workspace', 'task-1'), { recursive: true });
  fs.writeFileSync(path.join(f.defaultRoot, 'runtime-workspace', 'task-1', 'state.json'), 'live task state');
  fs.mkdirSync(f.legacyMemoryRoot, { recursive: true });
  fs.writeFileSync(path.join(f.legacyMemoryRoot, 'memory.md'), memoryBytes);

  const original = service(f);
  const plan = original.plan(target);
  original.queue(plan.id);

  const restarted = service(f);
  const app = appStub();
  const env = {};
  const configured = restarted.configure(app, env);

  assert.equal(configured.userData, target);
  assert.equal(configured.memoryRoot, path.join(target, 'memory-v1'));
  assert.equal(app.paths.userData, target);
  assert.equal(app.paths.sessionData, target);
  assert.equal(app.paths.temp, path.join(target, 'tmp'));
  assert.equal(app.paths.crashDumps, path.join(target, 'crash-dumps'));
  assert.equal(env.CODING_TOOLS_MCP_MEMORY_ROOT, path.join(target, 'memory-v1'));
  assert.equal(env.TEMP, path.join(target, 'tmp'));
  assert.equal(env.TMP, path.join(target, 'tmp'));
  assert.equal(env.TMPDIR, path.join(target, 'tmp'));

  for (const [relative, sourceBytes] of [
    ['preferences.json', profileBytes],
    [path.join('account', 'session.dat'), sessionBytes],
    [path.join('memory-v1', 'memory.md'), memoryBytes]
  ]) {
    const copied = fs.readFileSync(path.join(target, relative));
    assert.equal(digest(copied), digest(sourceBytes), `${relative} SHA-256`);
  }
  assert.equal(fs.existsSync(path.join(target, 'runtime-state.json')), false);
  assert.equal(fs.existsSync(path.join(target, 'runtime-state.json.bak')), false);
  assert.equal(fs.existsSync(path.join(target, 'runtime-workspace')), false);
  assert.equal(fs.existsSync(path.join(f.defaultRoot, 'runtime-state.json')), true, 'source remains intact');
  assert.equal(fs.existsSync(path.join(f.defaultRoot, 'runtime-workspace', 'task-1', 'state.json')), true);
  assert.equal(fs.existsSync(path.join(f.legacyMemoryRoot, 'memory.md')), true, 'legacy memory source remains intact');
  assert.deepEqual(restarted.status().currentRoot, target);
});

test('restoring the default preserves its old contents in a before-switch backup', (t) => {
  const f = fixture(t, 'restore-default');
  const currentRoot = path.join(f.root, 'custom-profile');
  const memoryFile = path.join(currentRoot, 'memory-v1', 'current.md');
  fs.mkdirSync(path.dirname(memoryFile), { recursive: true });
  fs.writeFileSync(path.join(currentRoot, 'current-profile.json'), 'current profile');
  fs.writeFileSync(path.join(currentRoot, 'settings.json'), '{"configVersion":9}');
  fs.writeFileSync(memoryFile, 'current memory');
  fs.mkdirSync(f.defaultRoot, { recursive: true });
  fs.writeFileSync(path.join(f.defaultRoot, 'old-default.json'), 'old default data');
  writeLocator(f, {
    version: 1,
    defaultRoot: f.defaultRoot,
    activeRoot: currentRoot,
    memoryRoot: path.join(currentRoot, 'memory-v1')
  });

  const original = service(f);
  const plan = original.plan(null);
  assert.equal(plan.target, f.defaultRoot);
  assert.equal(plan.restoringDefault, true);
  original.queue(plan.id);

  const restarted = service(f);
  restarted.configure(appStub(), {});
  const locator = JSON.parse(fs.readFileSync(f.locatorFile, 'utf8'));

  assert.equal(restarted.status().currentRoot, f.defaultRoot);
  assert.equal(fs.readFileSync(path.join(f.defaultRoot, 'current-profile.json'), 'utf8'), 'current profile');
  assert.equal(fs.readFileSync(path.join(f.defaultRoot, 'memory-v1', 'current.md'), 'utf8'), 'current memory');
  assert.ok(locator.displacedBackup);
  assert.equal(fs.readFileSync(path.join(locator.displacedBackup, 'old-default.json'), 'utf8'), 'old default data');
  assert.equal(fs.existsSync(path.join(currentRoot, 'current-profile.json')), true, 'migration source remains intact');
});

test('target validation rejects non-empty, overlapping, workspace, linked, and unavailable targets', async (t) => {
  await t.test('non-empty target', (t) => {
    const f = fixture(t, 'non-empty');
    const target = path.join(f.root, 'target');
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, 'keep.txt'), 'existing');
    assert.throws(() => service(f).plan(target), /非空/);
  });

  await t.test('target nested inside current profile', (t) => {
    const f = fixture(t, 'overlap');
    fs.mkdirSync(f.defaultRoot, { recursive: true });
    assert.throws(() => service(f).plan(path.join(f.defaultRoot, 'nested')), /重叠/);
  });

  await t.test('target inside a configured workspace', (t) => {
    const f = fixture(t, 'workspace');
    const workspace = path.join(f.root, 'project');
    fs.mkdirSync(f.defaultRoot, { recursive: true });
    fs.mkdirSync(workspace);
    fs.writeFileSync(path.join(f.defaultRoot, 'settings.json'), JSON.stringify({ workspace }));
    assert.throws(() => service(f).plan(path.join(workspace, 'storage')), /重叠/);
  });

  await t.test('linked target', (t) => {
    const f = fixture(t, 'link');
    const realTarget = path.join(f.root, 'real-target');
    const linkedTarget = path.join(f.root, 'linked-target');
    fs.mkdirSync(realTarget);
    try {
      fs.symlinkSync(realTarget, linkedTarget, process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error) {
      if (['EACCES', 'EPERM', 'ENOTSUP'].includes(error.code)) {
        t.skip(`directory link creation unavailable (${error.code})`);
        return;
      }
      throw error;
    }
    assert.throws(() => service(f).plan(linkedTarget), /链接或非目录/);
  });

  await t.test('target whose parent is a file', (t) => {
    const f = fixture(t, 'unavailable');
    const parentFile = path.join(f.root, 'not-a-directory');
    fs.writeFileSync(parentFile, 'occupied');
    assert.throws(() => service(f).plan(path.join(parentFile, 'target')), /非目录/);
  });
});

test('queue rejects a plan identifier that was not issued by this service instance', (t) => {
  const f = fixture(t, 'invalid-plan');
  const storage = service(f);
  assert.throws(() => storage.queue('not-a-plan-id'), /计划已失效/);
  assert.equal(fs.existsSync(f.locatorFile), false);
});

test('an interrupted copying phase keeps the source and partial stage for inspection', (t) => {
  const f = fixture(t, 'interrupted');
  const target = path.join(f.root, 'target');
  fs.mkdirSync(f.defaultRoot, { recursive: true });
  fs.writeFileSync(path.join(f.defaultRoot, 'profile.json'), 'source profile');
  const planned = service(f);
  const plan = planned.plan(target);
  planned.queue(plan.id);
  const locator = JSON.parse(fs.readFileSync(f.locatorFile, 'utf8'));
  const stage = `${target}.mika-stage-${plan.id}`;
  locator.pending.phase = 'copying';
  locator.pending.stage = stage;
  writeLocator(f, locator);
  fs.mkdirSync(stage);
  fs.writeFileSync(path.join(stage, 'partial.txt'), 'partial copy');

  const restarted = service(f);
  const app = appStub();
  const result = restarted.configure(app, {});

  assert.equal(result.userData, f.defaultRoot);
  assert.equal(restarted.status().currentRoot, f.defaultRoot);
  assert.match(restarted.status().error, /上次迁移中断/);
  assert.equal(restarted.state.pending, undefined);
  assert.equal(restarted.state.failedMigration.phase, 'copying');
  assert.equal(fs.readFileSync(path.join(stage, 'partial.txt'), 'utf8'), 'partial copy');
  assert.equal(fs.readFileSync(path.join(f.defaultRoot, 'profile.json'), 'utf8'), 'source profile');
  assert.equal(fs.existsSync(target), false);
  assert.deepEqual(app.paths, {});
});

test('a copy hash mismatch prevents switching and retains source data', (t) => {
  const f = fixture(t, 'hash-mismatch');
  const target = path.join(f.root, 'target');
  const sourceFile = path.join(f.defaultRoot, 'profile.json');
  fs.mkdirSync(f.defaultRoot, { recursive: true });
  fs.writeFileSync(sourceFile, 'verified source');
  const planned = service(f);
  const plan = planned.plan(target);
  planned.queue(plan.id);

  const originalCopyFileSync = fs.copyFileSync;
  fs.copyFileSync = function copyFileSyncWithCorruption(source, destination, flags) {
    const result = originalCopyFileSync.call(fs, source, destination, flags);
    fs.writeFileSync(destination, 'corrupted destination');
    return result;
  };
  let restarted;
  try {
    restarted = service(f);
    restarted.configure(appStub(), {});
  } finally {
    fs.copyFileSync = originalCopyFileSync;
  }

  assert.equal(fs.copyFileSync, originalCopyFileSync, 'fault injection is restored');
  assert.match(restarted.status().error, /内容校验失败/);
  assert.equal(fs.readFileSync(sourceFile, 'utf8'), 'verified source');
  assert.equal(fs.existsSync(target), false);
  assert.equal(fs.existsSync(restarted.state.failedMigration.stage), true, 'failed stage remains available for inspection');
});

test('an old live Runtime PID refuses migration', (t) => {
  const f = fixture(t, 'live-pid');
  const target = path.join(f.root, 'target');
  fs.mkdirSync(f.defaultRoot, { recursive: true });
  fs.writeFileSync(path.join(f.defaultRoot, 'runtime-state.json'), JSON.stringify({ nativePid: process.pid }));
  const planned = service(f);
  const plan = planned.plan(target);
  planned.queue(plan.id);

  const restarted = service(f);
  const app = appStub();
  restarted.configure(app, {});

  assert.match(restarted.status().error, /仍有旧 Runtime\/Tunnel 进程/);
  assert.equal(restarted.status().currentRoot, f.defaultRoot);
  assert.equal(fs.existsSync(target), false);
  assert.deepEqual(app.paths, {});
});

test('a missing active root is reported without falling back to the default', (t) => {
  const f = fixture(t, 'missing-active');
  const missingRoot = path.join(f.root, 'missing-profile');
  writeLocator(f, {
    version: 1,
    defaultRoot: f.defaultRoot,
    activeRoot: missingRoot,
    memoryRoot: path.join(missingRoot, 'memory-v1')
  });
  const storage = service(f);
  const app = appStub();

  assert.throws(() => storage.configure(app, {}), /已配置的数据目录不可用，不会回退/);
  assert.equal(storage.status().currentRoot, missingRoot);
  assert.deepEqual(app.paths, {});
});

test('a corrupt locator fails closed instead of selecting the default', (t) => {
  const f = fixture(t, 'corrupt-locator');
  fs.mkdirSync(path.dirname(f.locatorFile), { recursive: true });
  fs.writeFileSync(f.locatorFile, '{broken-json');

  assert.throws(() => service(f), SyntaxError);
  assert.equal(fs.existsSync(f.defaultRoot), false, 'the default was not created as a fallback');
});

test('source changes during copy are detected before committing the locator', (t) => {
  const f = fixture(t, 'changing-source');
  fs.mkdirSync(f.defaultRoot, { recursive: true });
  const filename = path.join(f.defaultRoot, 'data.txt');
  fs.writeFileSync(filename, 'before');
  const storage = service(f);
  const target = path.join(f.root, 'target');
  storage.queue(storage.plan(target).id);
  const copy = fs.copyFileSync;
  fs.copyFileSync = (...args) => { copy(...args); fs.writeFileSync(filename, 'changed'); };
  try { service(f).configure(appStub(), {}); } finally { fs.copyFileSync = copy; }
  assert.match(service(f).status().error, /来源发生变化/);
  assert.equal(service(f).status().currentRoot, f.defaultRoot);
  assert.equal(fs.existsSync(target), false);
});

test('insufficient disk space rejects a plan without changing the locator', (t) => {
  const f = fixture(t, 'space');
  const statfs = fs.statfsSync;
  fs.statfsSync = () => ({ bavail: 0, bsize: 4096 });
  try { assert.throws(() => service(f).plan(path.join(f.root, 'target')), /空间不足/); }
  finally { fs.statfsSync = statfs; }
  assert.equal(fs.existsSync(f.locatorFile), false);
});

test('missing sources at cold startup never become empty profiles or empty memory', (t) => {
  for (const missing of ['profile', 'memory']) {
    const f = fixture(t, `offline-${missing}`);
    fs.mkdirSync(f.defaultRoot, { recursive: true });
    fs.mkdirSync(f.legacyMemoryRoot, { recursive: true });
    fs.writeFileSync(path.join(f.legacyMemoryRoot, 'keep.md'), 'keep');
    const storage = service(f);
    const target = path.join(f.root, 'target');
    storage.queue(storage.plan(target).id);
    const source = missing === 'profile' ? f.defaultRoot : f.legacyMemoryRoot;
    fs.renameSync(source, `${source}.offline`);
    assert.throws(() => service(f).configure(appStub(), {}), /已不可用/);
    assert.equal(fs.existsSync(source), false);
    assert.equal(fs.existsSync(target), false);
  }
});
