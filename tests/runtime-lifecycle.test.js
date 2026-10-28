const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { runtimeFingerprint, runtimeSourceFingerprint, currentRuntimeState } = require('../electron/services/nativeService');
const { normalizeProxyValue } = require('../electron/services/proxyService');

function createNativeServiceHarness({
  initialState = {},
  dataRoot = path.resolve('C:\\Mika Data'),
  alivePids = [],
  runCommand,
  pythonStatus
} = {}) {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const livePids = new Set(alivePids);
  const calls = [];
  const stateWrites = [];
  const logs = { info: [], warn: [] };
  let state = JSON.parse(JSON.stringify(initialState));
  let pythonStatusCalls = 0;

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const stubs = {
    './environmentService': {
      pythonStatus: async () => {
        pythonStatusCalls += 1;
        return pythonStatus || { installed: true, command: 'python.exe', prefixArgs: [] };
      }
    },
    '../paths': {
      dataRoot: () => dataRoot,
      resourcesRoot: () => path.resolve('resources'),
      stateFile: () => 'state.json',
      mcpLogFile: () => 'mcp.log'
    },
    './jsonStore': {
      readJson: () => clone(state),
      updateJsonAtomic: (_file, update) => {
        state = update(clone(state));
        stateWrites.push(clone(state));
      },
      ensureParent: () => {}
    },
    './logService': { rotateLog: () => {} },
    './commandRunner': {
      run: async (command, args, options) => {
        calls.push({ command, args, options });
        if (runCommand) return runCommand(command, args, options, { livePids, state: clone(state) });
        if (command === 'taskkill.exe') {
          livePids.delete(Number(args[1]));
          return { code: 0, stdout: '', stderr: '' };
        }
        return {
          code: 0,
          stdout: JSON.stringify({ ok: true, archived: [], warnings: [], errors: [] }),
          stderr: ''
        };
      }
    }
  };
  const source = fs.readFileSync(path.resolve(__dirname, '../electron/services/nativeService.js'), 'utf8');
  const module = { exports: {} };
  vm.runInNewContext(source, {
    module,
    process: {
      env: {},
      kill: (pid) => {
        if (livePids.has(Number(pid))) return true;
        const error = new Error('process not alive');
        error.code = 'ESRCH';
        throw error;
      }
    },
    __dirname: path.resolve(__dirname, '../electron/services'),
    require: (name) => Object.prototype.hasOwnProperty.call(stubs, name) ? stubs[name] : require(name),
    setTimeout: (callback) => { callback(); return 0; }
  });

  const service = new module.exports.NativeService({
    info: (...args) => logs.info.push(args),
    warn: (...args) => logs.warn.push(args)
  });
  return {
    service,
    calls,
    logs,
    livePids,
    stateWrites,
    getState: () => clone(state),
    getPythonStatusCalls: () => pythonStatusCalls
  };
}

test('native runtime identity changes with workspace and port while tool mode stays smart', () => {
  const base = { workspace: 'C:\\work\\one', mcpPort: 18765, permissionMode: 'safe' };
  assert.equal(runtimeFingerprint(base), runtimeFingerprint({ ...base }));
  assert.notEqual(runtimeFingerprint(base), runtimeFingerprint({ ...base, workspace: 'C:\\work\\two' }));
  assert.notEqual(runtimeFingerprint(base), runtimeFingerprint({ ...base, mcpPort: 18766 }));
  assert.notEqual(runtimeFingerprint(base), runtimeFingerprint({ ...base, authorizedRoots: ['D:\\shared'] }));
  assert.equal(runtimeFingerprint(base), runtimeFingerprint({ ...base, toolMode: 'readonly' }));
  assert.notEqual(runtimeFingerprint(base, 'source', 'C:\\data\\one'), runtimeFingerprint(base, 'source', 'C:\\data\\two'));
});

test('native launch overrides inherited runtime root and tracks its location across reuse and workspace switches', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const { EventEmitter } = require('node:events');
  const source = fs.readFileSync(path.resolve(__dirname, '../electron/services/nativeService.js'), 'utf8');
  let userData = path.resolve('C:\\Mika Data');
  let state = {};
  let livePid = null;
  const launches = [];
  let stops = 0;
  const stubs = {
    'node:fs': { existsSync: () => false, openSync: () => 42, closeSync: () => {} },
    'node:child_process': {
      spawn: (command, args, options) => {
        launches.push({ command, args, options });
        const child = new EventEmitter();
        child.pid = 1000 + launches.length;
        child.unref = () => {};
        livePid = child.pid;
        setImmediate(() => child.emit('spawn'));
        return child;
      }
    },
    './environmentService': { pythonStatus: async () => ({ installed: true, version: 'Python 3.12', command: 'python.exe', prefixArgs: [] }) },
    '../paths': { dataRoot: () => userData, resourcesRoot: () => path.resolve('resources'), stateFile: () => 'state.json', mcpLogFile: () => 'mcp.log' },
    './jsonStore': { readJson: () => state, updateJsonAtomic: (_file, update) => { state = update(state); }, ensureParent: () => {} },
    './logService': { rotateLog: () => {} },
    './commandRunner': {
      run: async (command) => {
        stops += 1;
        if (command === 'taskkill.exe') livePid = null;
        return { code: 0, stdout: '', stderr: '' };
      }
    }
  };
  const fakeProcess = {
    env: { CODING_TOOLS_MCP_RUNTIME_ROOT: 'inherited-unsafe-root' },
    kill: (pid) => { if (pid !== livePid) throw new Error('not alive'); }
  };
  const module = { exports: {} };
  vm.runInNewContext(source, {
    module, process: fakeProcess, __dirname: path.resolve(__dirname, '../electron/services'),
    require: (name) => stubs[name] || require(name), setTimeout
  });
  const service = new module.exports.NativeService({ info: () => {}, warn: () => {} });
  const settings = { workspace: path.resolve('workspace'), mcpPort: 18765, permissionMode: 'safe' };
  const first = await service.start(settings, 'test-token', () => {});
  const firstRoot = path.join(userData, 'runtime-workspace');
  assert.equal(first.reused, false);
  assert.equal(launches[0].options.env.CODING_TOOLS_MCP_RUNTIME_ROOT, firstRoot);
  assert.equal(await service.status(settings), true);
  assert.equal((await service.start(settings, 'test-token', () => {})).reused, true);
  assert.equal(launches.length, 1);

  userData = path.resolve('C:\\Other Mika Data');
  assert.equal(await service.status(settings), false);
  assert.equal((await service.start(settings, 'test-token', () => {})).reused, false);
  assert.equal(stops, 1);
  assert.equal(launches[1].options.env.CODING_TOOLS_MCP_RUNTIME_ROOT, path.join(userData, 'runtime-workspace'));

  const switched = { ...settings, workspace: path.resolve('other-workspace') };
  await service.markWorkspace(switched);
  assert.equal(await service.status(switched), true);
  assert.equal(await service.status(settings), false);
});

test('native stop archives a dead process runtime and clears its cleanup ticket on success', async () => {
  const userData = path.resolve('C:\\Mika Data');
  const request = {
    root: path.resolve(userData, 'runtime-workspace'),
    pid: 42001,
    launchId: 'a'.repeat(32)
  };
  const harness = createNativeServiceHarness({
    dataRoot: userData,
    initialState: {
      nativePid: request.pid,
      nativeRuntimeRoot: request.root,
      nativeInstanceId: request.launchId,
      nativeFingerprint: 'fingerprint',
      nativeWorkspace: path.resolve('workspace'),
      nativePort: 18765,
      nativePermissionMode: 'safe',
      nativeSourceFingerprint: 'source'
    }
  });

  assert.equal(await harness.service.stop(), false);
  assert.deepEqual(harness.calls.map(({ command }) => command), ['python.exe']);
  assert.deepEqual([...harness.calls[0].args.slice(-6)], [
    '--root', request.root,
    '--pid', String(request.pid),
    '--launch-id', request.launchId
  ]);
  assert.equal(harness.calls[0].options.timeoutMs, 10000);
  assert.deepEqual(harness.stateWrites[0].nativeCleanupPending, [request]);
  assert.equal(harness.stateWrites[0].nativePid, null);
  assert.deepEqual(harness.getState().nativeCleanupPending, []);
  assert.equal(harness.getState().nativeRuntimeRoot, '');
});

test('native stop preserves a failed cleanup ticket and retries it on the next stop', async () => {
  const userData = path.resolve('C:\\Mika Data');
  const request = {
    root: path.resolve(userData, 'runtime-workspace'),
    pid: 42002,
    launchId: 'b'.repeat(32)
  };
  let cleanupCalls = 0;
  const harness = createNativeServiceHarness({
    dataRoot: userData,
    initialState: {
      nativePid: request.pid,
      nativeRuntimeRoot: request.root,
      nativeInstanceId: request.launchId,
      nativeFingerprint: 'fingerprint',
      nativeWorkspace: path.resolve('workspace'),
      nativePort: 18765,
      nativePermissionMode: 'safe',
      nativeSourceFingerprint: 'source'
    },
    runCommand: async (command) => {
      assert.equal(command, 'python.exe');
      cleanupCalls += 1;
      if (cleanupCalls === 1) {
        return { code: 1, stdout: JSON.stringify({ ok: false, errors: ['injected cleanup failure'] }), stderr: '' };
      }
      return { code: 0, stdout: JSON.stringify({ ok: true, archived: [], warnings: [], errors: [] }), stderr: '' };
    }
  });

  assert.equal(await harness.service.stop(), false);
  assert.deepEqual(harness.getState().nativeCleanupPending, [request]);
  assert.equal(harness.logs.warn.length, 1);
  assert.match(harness.logs.warn[0][0], /已保留待重试请求/);

  assert.equal(await harness.service.stop(), false);
  assert.equal(cleanupCalls, 2);
  assert.deepEqual(harness.getState().nativeCleanupPending, []);
  assert.equal(harness.logs.warn.length, 1);
});

test('native cleanup retains live, malformed, and non-current-root requests without invoking Python', async () => {
  const userData = path.resolve('C:\\Mika Data');
  const root = path.resolve(userData, 'runtime-workspace');
  const requests = [
    { root, pid: 42003, launchId: 'c'.repeat(32) },
    { root, pid: 42004, launchId: 'not-a-launch-id' },
    { root: path.resolve(userData, 'other-runtime'), pid: 42005, launchId: 'd'.repeat(32) }
  ];
  const harness = createNativeServiceHarness({
    dataRoot: userData,
    alivePids: [42003],
    runCommand: async () => { throw new Error('cleanup command must not run for rejected tickets'); }
  });

  assert.deepEqual([...(await harness.service.cleanupRuntimeRequests(requests))], requests);
  assert.equal(harness.calls.length, 0);
  assert.equal(harness.getPythonStatusCalls(), 0);
  assert.equal(harness.logs.warn.length, requests.length);
});

test('native stop preserves process identity and skips cleanup when the PID will not exit', async () => {
  const userData = path.resolve('C:\\Mika Data');
  const request = {
    root: path.resolve(userData, 'runtime-workspace'),
    pid: 42006,
    launchId: 'e'.repeat(32)
  };
  const initialState = {
    nativePid: request.pid,
    nativeRuntimeRoot: request.root,
    nativeInstanceId: request.launchId,
    nativeFingerprint: 'fingerprint',
    nativeWorkspace: path.resolve('workspace'),
    nativePort: 18765,
    nativePermissionMode: 'safe',
    nativeSourceFingerprint: 'source',
    nativeCleanupPending: [{ root: request.root, pid: 42000, launchId: 'f'.repeat(32) }]
  };
  const harness = createNativeServiceHarness({
    dataRoot: userData,
    initialState,
    alivePids: [request.pid],
    runCommand: async (command) => {
      assert.equal(command, 'taskkill.exe');
      return { code: 1, stdout: '', stderr: 'process remains alive' };
    }
  });

  await assert.rejects(harness.service.stop(), /未能完全退出/);
  assert.deepEqual(harness.calls.map(({ command }) => command), ['taskkill.exe']);
  assert.equal(harness.stateWrites.length, 0);
  assert.deepEqual(harness.getState(), initialState);
  assert.equal(harness.getPythonStatusCalls(), 0);
});

test('proxy values from Windows settings are normalized', () => {
  assert.equal(normalizeProxyValue('127.0.0.1:7890'), 'http://127.0.0.1:7890');
  assert.equal(normalizeProxyValue('http=127.0.0.1:8080;https=127.0.0.1:7890'), 'http://127.0.0.1:7890');
  assert.equal(normalizeProxyValue('http://user:pass@127.0.0.1:7890'), '');
});

test('background runtime processes are hidden and never detached on Windows', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '..');
  for (const relative of ['electron/services/nativeService.js', 'electron/services/tunnelService.js']) {
    const source = fs.readFileSync(path.join(root, relative), 'utf8');
    assert.match(source, /windowsHide:\s*true/);
    assert.match(source, /detached:\s*false/);
    assert.doesNotMatch(source, /detached:\s*true/);
  }
  const runner = fs.readFileSync(path.join(root, 'electron/services/commandRunner.js'), 'utf8');
  assert.doesNotMatch(runner, /spawnDetached/);
  const mcpServer = fs.readFileSync(path.join(root, 'resources/coding-tools-mcp/coding_tools_mcp/server.py'), 'utf8');
  assert.match(mcpServer, /CREATE_NO_WINDOW/);
  assert.match(mcpServer, /encoding="utf-8"/);
});

test('runtime state migration keeps only current native and tunnel fields', () => {
  assert.deepEqual(
    currentRuntimeState({ nativePid: 1, tunnelPid: 2, nativeInstanceId: 'launch', nativeSourceFingerprint: 'source', obsoletePid: 3 }),
    { nativePid: 1, tunnelPid: 2, nativeInstanceId: 'launch', nativeSourceFingerprint: 'source' }
  );
});

test('runtime source fingerprint covers the complete Python runtime tree and schema contract', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const native = fs.readFileSync(path.resolve(__dirname, '../electron/services/nativeService.js'), 'utf8');
  assert.match(native, /entry\.name\.endsWith\('\.py'\)/);
  assert.match(native, /schema-contract\.json/);
  assert.match(native, /CODING_TOOLS_MCP_SOURCE_FINGERPRINT/);
  assert.match(runtimeSourceFingerprint(), /^[a-f0-9]{64}$/);
});
