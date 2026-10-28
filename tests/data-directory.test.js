const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { configureDataDirectories } = require('../electron/services/dataDirectoryService');

const repositoryRoot = path.resolve(__dirname, '..');
const fixtureParent = path.join(repositoryRoot, 'tmp', 'mika-development-isolation', 'node-fixtures');

function createFixture(name) {
  fs.mkdirSync(fixtureParent, { recursive: true });
  const root = fs.mkdtempSync(path.join(fixtureParent, `${name}-`));
  return {
    root,
    createRepository(repositoryName) {
      const repository = path.join(root, repositoryName);
      fs.mkdirSync(repository, { recursive: true });
      return repository;
    }
  };
}

function createApp({ repository, userData, sessionData = userData, isPackaged = false, temp, crashDumps }) {
  const paths = {
    userData,
    sessionData,
    temp: temp || path.join(path.dirname(userData), 'original-temp'),
    crashDumps: crashDumps || path.join(path.dirname(userData), 'original-crash-dumps'),
    appData: path.join(path.dirname(userData), 'app-data'), exe: path.join(repository, 'application.exe')
  };
  const setPathCalls = [];
  return {
    isPackaged,
    requestSingleInstanceLock() { return true; },
    paths,
    setPathCalls,
    getAppPath() {
      return repository;
    },
    getPath(name) {
      return paths[name];
    },
    setPath(name, value) {
      setPathCalls.push([name, value]);
      paths[name] = value;
    }
  };
}

function expectedRepositoryId(repository) {
  let canonicalPath = path.normalize(fs.realpathSync.native(repository));
  if (process.platform === 'win32') canonicalPath = canonicalPath.toLowerCase();
  return crypto.createHash('sha256').update(canonicalPath).digest('hex').slice(0, 16);
}

function expectedDefaultBase(repository) {
  return path.join(path.dirname(fs.realpathSync.native(repository)), 'Mika-Data', 'development');
}

function expectedProfileRoot(repository, base) {
  return path.join(base, expectedRepositoryId(repository), 'profile');
}

function assertRejectedWithoutMutation(app, env, initialPaths, initialEnv, message = /./) {
  assert.throws(() => configureDataDirectories(app, { env }), message);
  assert.deepEqual(app.paths, initialPaths);
  assert.deepEqual(app.setPathCalls, []);
  assert.deepEqual(env, initialEnv);
}

function assertDevelopmentPaths(app, root) {
  const calls = app.setPathCalls.slice().sort(([left], [right]) => left.localeCompare(right));
  const temp = path.join(root, 'tmp');
  const crashDumps = path.join(root, 'crash-dumps');
  assert.deepEqual(calls, [
    ['crashDumps', crashDumps],
    ['sessionData', root],
    ['temp', temp],
    ['userData', root]
  ]);
  assert.equal(app.paths.userData, root);
  assert.equal(app.paths.sessionData, root);
  assert.equal(app.paths.temp, temp);
  assert.equal(app.paths.crashDumps, crashDumps);
  assert.ok(fs.statSync(temp).isDirectory());
  assert.ok(fs.statSync(crashDumps).isDirectory());
}

function createProductionCanary(fixture, name = 'production-user-data') {
  const userData = path.join(fixture.root, name);
  fs.mkdirSync(userData, { recursive: true });
  const canary = path.join(userData, 'keep.txt');
  fs.writeFileSync(canary, 'production profile must remain untouched');
  return { userData, canary };
}

test('packaged app leaves Electron paths, environment and existing production data untouched', () => {
  const fixture = createFixture('production-noop');
  const { userData, canary } = createProductionCanary(fixture);
  const env = {
    LOCALAPPDATA: 'relative-value-that-production-must-ignore',
    MIKA_DEVELOPMENT_DATA_ROOT: 'also-ignored-by-production',
    CODING_TOOLS_MCP_MEMORY_ROOT: 'existing-memory-root',
    TEMP: 'existing-temp',
    TMP: 'existing-tmp',
    TMPDIR: 'existing-tmpdir'
  };
  const initialEnv = { ...env };
  const app = createApp({ repository: fixture.root, userData, isPackaged: true });
  const initialPaths = { ...app.paths };

  const result = configureDataDirectories(app, { env });

  assert.deepEqual(result, { channel: 'production', userData, changed: false });
  assert.deepEqual(app.paths, initialPaths);
  assert.deepEqual(app.setPathCalls, [
    ['userData', path.join(app.paths.appData, 'Mika/storage/instance-lock')],
    ['userData', userData]
  ]);
  assert.deepEqual(env, initialEnv);
  assert.equal(fs.readFileSync(canary, 'utf8'), 'production profile must remain untouched');
  assert.equal(fs.readdirSync(userData).length, 1);
});

test('configures the development profile and acquires the instance lock before loading user data stores', () => {
  const source = fs.readFileSync(path.join(repositoryRoot, 'electron', 'main.js'), 'utf8');
  const configureImport = source.indexOf("require('./services/dataDirectoryService')");
  const configureCall = source.indexOf('configureDataDirectories(app);');
  const instanceLock = source.indexOf('app.requestSingleInstanceLock()');

  assert.notEqual(configureImport, -1);
  assert.notEqual(configureCall, -1);
  assert.notEqual(instanceLock, -1);
  assert.ok(configureImport < configureCall);
  assert.ok(configureCall < instanceLock);
  for (const importStatement of [
    "require('./services/settingsStore')",
    "require('./services/skillStore')",
    "require('./services/promptStore')",
    "require('./services/secretStore')",
    "require('./services/logService')",
    "require('./services/environmentService')",
    "require('./services/notificationCheckpointStore')",
    "require('./paths')"
  ]) {
    const importPosition = source.indexOf(importStatement);
    assert.notEqual(importPosition, -1, `main.js should still load ${importStatement}`);
    assert.ok(instanceLock < importPosition, `${importStatement} must load after the profile lock`);
  }
});

test('default development profiles are deterministic per repository and isolate session, memory and temp data', () => {
  const fixture = createFixture('development-roots');
  const firstRepository = fixture.createRepository('source-one');
  const secondRepository = fixture.createRepository('source-two');
  const firstOriginal = path.join(fixture.root, 'first-production-profile');
  const secondOriginal = path.join(fixture.root, 'second-production-profile');
  fs.mkdirSync(firstOriginal);
  fs.mkdirSync(secondOriginal);
  const env = {
    LOCALAPPDATA: 'ignored-local-app-data',
    CODING_TOOLS_MCP_MEMORY_ROOT: 'old-memory-root',
    TEMP: 'old-temp',
    TMP: 'old-tmp',
    TMPDIR: 'old-tmpdir'
  };

  const firstApp = createApp({ repository: firstRepository, userData: firstOriginal });
  const first = configureDataDirectories(firstApp, { env });
  const secondApp = createApp({ repository: secondRepository, userData: secondOriginal });
  const second = configureDataDirectories(secondApp, { env });
  const repeatedApp = createApp({ repository: firstRepository, userData: firstOriginal });
  const repeated = configureDataDirectories(repeatedApp, { env });

  const firstId = expectedRepositoryId(firstRepository);
  const secondId = expectedRepositoryId(secondRepository);
  const firstRoot = expectedProfileRoot(firstRepository, expectedDefaultBase(firstRepository));
  const secondRoot = expectedProfileRoot(secondRepository, expectedDefaultBase(secondRepository));
  assert.notEqual(firstId, secondId);
  assert.equal(first.repositoryId, firstId);
  assert.equal(second.repositoryId, secondId);
  assert.equal(repeated.repositoryId, firstId);
  assert.equal(first.userData, firstRoot);
  assert.equal(first.sessionData, firstRoot);
  assert.equal(first.memoryRoot, path.join(firstRoot, 'memory-v1'));
  assert.equal(first.temp, path.join(firstRoot, 'tmp'));
  assert.equal(first.crashDumps, path.join(firstRoot, 'crash-dumps'));
  assert.equal(second.userData, secondRoot);
  assert.equal(second.sessionData, secondRoot);
  assert.equal(second.memoryRoot, path.join(secondRoot, 'memory-v1'));
  assert.equal(second.temp, path.join(secondRoot, 'tmp'));
  assert.equal(second.crashDumps, path.join(secondRoot, 'crash-dumps'));
  assert.equal(repeated.userData, firstRoot);
  assert.equal(first.channel, 'development');
  assert.equal(first.changed, true);
  assertDevelopmentPaths(firstApp, firstRoot);
  assertDevelopmentPaths(secondApp, secondRoot);
  assertDevelopmentPaths(repeatedApp, firstRoot);
  assert.equal(env.CODING_TOOLS_MCP_MEMORY_ROOT, path.join(firstRoot, 'memory-v1'));
  assert.equal(env.TEMP, path.join(firstRoot, 'tmp'));
  assert.equal(env.TMP, path.join(firstRoot, 'tmp'));
  assert.equal(env.TMPDIR, path.join(firstRoot, 'tmp'));
  assert.equal(env.LOCALAPPDATA, 'ignored-local-app-data');
  assert.ok(fs.statSync(firstRoot).isDirectory());
  assert.ok(fs.statSync(secondRoot).isDirectory());
});

test('uses an absolute MIKA_DEVELOPMENT_DATA_ROOT override as the development base', () => {
  const fixture = createFixture('development-root-override');
  const repository = fixture.createRepository('source');
  const originalUserData = path.join(fixture.root, 'original-profile');
  const overrideBase = path.join(fixture.root, 'chosen-data-root');
  const env = {
    MIKA_DEVELOPMENT_DATA_ROOT: overrideBase,
    CODING_TOOLS_MCP_MEMORY_ROOT: 'existing-memory-root',
    TEMP: 'old-temp',
    TMP: 'old-tmp',
    TMPDIR: 'old-tmpdir'
  };
  const app = createApp({ repository, userData: originalUserData });
  const result = configureDataDirectories(app, { env });
  const expectedRoot = expectedProfileRoot(repository, overrideBase);

  assert.equal(result.userData, expectedRoot);
  assert.equal(result.sessionData, expectedRoot);
  assert.equal(result.memoryRoot, path.join(expectedRoot, 'memory-v1'));
  assert.equal(result.temp, path.join(expectedRoot, 'tmp'));
  assert.equal(result.crashDumps, path.join(expectedRoot, 'crash-dumps'));
  assertDevelopmentPaths(app, expectedRoot);
  assert.equal(env.CODING_TOOLS_MCP_MEMORY_ROOT, path.join(expectedRoot, 'memory-v1'));
  assert.equal(env.TEMP, path.join(expectedRoot, 'tmp'));
  assert.equal(env.TMP, path.join(expectedRoot, 'tmp'));
  assert.equal(env.TMPDIR, path.join(expectedRoot, 'tmp'));
});

test('rejects a relative MIKA_DEVELOPMENT_DATA_ROOT without writing relative to the repository or changing state', () => {
  const fixture = createFixture('relative-development-data-root');
  const repository = fixture.createRepository('source');
  const userData = path.join(fixture.root, 'original-profile');
  const env = {
    MIKA_DEVELOPMENT_DATA_ROOT: path.relative(repositoryRoot, path.join(fixtureParent, `relative-root-${path.basename(fixture.root)}`)),
    CODING_TOOLS_MCP_MEMORY_ROOT: 'existing-memory-root',
    TEMP: 'old-temp',
    TMP: 'old-tmp',
    TMPDIR: 'old-tmpdir'
  };
  const initialEnv = { ...env };
  const app = createApp({ repository, userData });
  const initialPaths = { ...app.paths };
  const resolvedRelativeRoot = path.resolve(repositoryRoot, env.MIKA_DEVELOPMENT_DATA_ROOT);

  assertRejectedWithoutMutation(app, env, initialPaths, initialEnv);
  assert.equal(fs.existsSync(resolvedRelativeRoot), false);
});

test('rejects a development root inside the source repository before creating it', () => {
  const fixture = createFixture('repository-root-rejected');
  const repository = fixture.createRepository('source');
  const userData = path.join(fixture.root, 'original-profile');
  const env = { MIKA_DEVELOPMENT_DATA_ROOT: repository, CODING_TOOLS_MCP_MEMORY_ROOT: 'existing-memory-root' };
  const initialEnv = { ...env };
  const app = createApp({ repository, userData });
  const initialPaths = { ...app.paths };

  assertRejectedWithoutMutation(app, env, initialPaths, initialEnv);
  assert.equal(fs.existsSync(path.join(repository, expectedRepositoryId(repository))), false);
});

test('rejects a development root nested under the current userData directory', () => {
  const fixture = createFixture('profile-overlap-child');
  const repository = fixture.createRepository('source');
  const userData = path.join(fixture.root, 'original-profile');
  const developmentBase = path.join(userData, 'child-development-data');
  fs.mkdirSync(userData, { recursive: true });
  const canary = path.join(userData, 'keep.txt');
  fs.writeFileSync(canary, 'preserve original profile');
  const env = { MIKA_DEVELOPMENT_DATA_ROOT: developmentBase, CODING_TOOLS_MCP_MEMORY_ROOT: 'existing-memory-root' };
  const initialEnv = { ...env };
  const app = createApp({ repository, userData });
  const initialPaths = { ...app.paths };

  assertRejectedWithoutMutation(app, env, initialPaths, initialEnv);
  assert.equal(fs.readFileSync(canary, 'utf8'), 'preserve original profile');
});

test('rejects a current userData directory nested under the proposed development root', () => {
  const fixture = createFixture('profile-overlap-parent');
  const repository = fixture.createRepository('source');
  const developmentBase = path.join(fixture.root, 'chosen-data-root');
  const candidateRoot = expectedProfileRoot(repository, developmentBase);
  const userData = path.join(candidateRoot, 'previous-profile');
  fs.mkdirSync(userData, { recursive: true });
  const canary = path.join(userData, 'keep.txt');
  fs.writeFileSync(canary, 'preserve nested original profile');
  const env = { MIKA_DEVELOPMENT_DATA_ROOT: developmentBase, CODING_TOOLS_MCP_MEMORY_ROOT: 'existing-memory-root' };
  const initialEnv = { ...env };
  const app = createApp({ repository, userData });
  const initialPaths = { ...app.paths };

  assertRejectedWithoutMutation(app, env, initialPaths, initialEnv);
  assert.equal(fs.readFileSync(canary, 'utf8'), 'preserve nested original profile');
});

test('rejects a development base with a symbolic-link or junction ancestor', (t) => {
  const fixture = createFixture('linked-development-base');
  const repository = fixture.createRepository('source');
  const backingDirectory = path.join(fixture.root, 'backing-data-root');
  fs.mkdirSync(backingDirectory);
  const linkedDirectory = path.join(fixture.root, 'linked-data-root');
  try {
    fs.symlinkSync(backingDirectory, linkedDirectory, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP', 'ENOSYS'].includes(error.code)) {
      t.skip(`this environment cannot create a directory link (${error.code})`);
      return;
    }
    throw error;
  }
  const userData = path.join(fixture.root, 'original-profile');
  const env = { MIKA_DEVELOPMENT_DATA_ROOT: linkedDirectory, CODING_TOOLS_MCP_MEMORY_ROOT: 'existing-memory-root' };
  const initialEnv = { ...env };
  const app = createApp({ repository, userData });
  const initialPaths = { ...app.paths };

  assertRejectedWithoutMutation(app, env, initialPaths, initialEnv);
  assert.equal(fs.existsSync(path.join(backingDirectory, expectedRepositoryId(repository))), false);
});

test('rejects a linked tmp child before changing app paths or environment', (t) => {
  const fixture = createFixture('linked-temp-child');
  const repository = fixture.createRepository('source');
  const developmentBase = path.join(fixture.root, 'chosen-data-root');
  const profileRoot = expectedProfileRoot(repository, developmentBase);
  fs.mkdirSync(profileRoot, { recursive: true });
  const linkTarget = path.join(fixture.root, 'linked-temp-target');
  fs.mkdirSync(linkTarget);
  const canary = path.join(linkTarget, 'keep.txt');
  fs.writeFileSync(canary, 'preserve linked temp data');
  const tempLink = path.join(profileRoot, 'tmp');
  try {
    fs.symlinkSync(linkTarget, tempLink, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP', 'ENOSYS'].includes(error.code)) {
      t.skip(`this environment cannot create a directory link (${error.code})`);
      return;
    }
    throw error;
  }
  const env = { MIKA_DEVELOPMENT_DATA_ROOT: developmentBase, CODING_TOOLS_MCP_MEMORY_ROOT: 'existing-memory-root', TEMP: 'old-temp', TMP: 'old-tmp', TMPDIR: 'old-tmpdir' };
  const initialEnv = { ...env };
  const originalUserData = path.join(fixture.root, 'original-profile');
  const app = createApp({ repository, userData: originalUserData });
  const initialPaths = { ...app.paths };

  assertRejectedWithoutMutation(app, env, initialPaths, initialEnv);
  assert.equal(fs.readFileSync(canary, 'utf8'), 'preserve linked temp data');
  assert.equal(fs.existsSync(path.join(profileRoot, 'crash-dumps')), false);
});

test('rejects a development profile on Windows C drive before creating it', (t) => {
  if (process.platform !== 'win32') {
    t.skip('the C-drive policy is Windows-specific');
    return;
  }
  const fixture = createFixture('c-drive-rejected');
  const repository = fixture.createRepository('source');
  const userData = path.join(fixture.root, 'original-profile');
  const developmentBase = path.join('C:\\', `Mika-Data-Test-${path.basename(fixture.root)}`);
  const env = { MIKA_DEVELOPMENT_DATA_ROOT: developmentBase, CODING_TOOLS_MCP_MEMORY_ROOT: 'existing-memory-root', TEMP: 'old-temp', TMP: 'old-tmp', TMPDIR: 'old-tmpdir' };
  const initialEnv = { ...env };
  const app = createApp({ repository, userData });
  const initialPaths = { ...app.paths };

  assertRejectedWithoutMutation(app, env, initialPaths, initialEnv);
  assert.equal(fs.existsSync(path.join(developmentBase, expectedRepositoryId(repository))), false);
});

test('does not fall back when the absolute development base cannot serve as a directory', () => {
  const fixture = createFixture('unavailable-development-data-root');
  const repository = fixture.createRepository('source');
  const blockedPath = path.join(fixture.root, 'development-root-is-a-file');
  fs.writeFileSync(blockedPath, 'preserve this file');
  const userData = path.join(fixture.root, 'original-profile');
  const env = { MIKA_DEVELOPMENT_DATA_ROOT: blockedPath, CODING_TOOLS_MCP_MEMORY_ROOT: 'existing-memory-root', TEMP: 'old-temp', TMP: 'old-tmp', TMPDIR: 'old-tmpdir' };
  const initialEnv = { ...env };
  const app = createApp({ repository, userData });
  const initialPaths = { ...app.paths };

  assertRejectedWithoutMutation(app, env, initialPaths, initialEnv);
  assert.equal(fs.readFileSync(blockedPath, 'utf8'), 'preserve this file');
});
