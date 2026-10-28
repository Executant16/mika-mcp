const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../electron/main.js'), 'utf8');

function fixture({ failStop = false, development = false } = {}) {
  const handlers = {};
  const events = [];
  const service = { status: () => ({ channel: 'production' }), plan: (target) => ({ target }), validatePlan() {},
    assertStopped() { events.push('check-stopped'); }, queue(id) { events.push(`queue:${id}`); } };
  let scheduled;
  const currentSession = { cookies: { async flushStore() { events.push('flush-cookies'); } },
    flushStorageData() { events.push('flush-storage'); } };
  const context = vm.createContext({
    getProductionStorage: () => development ? null : service,
    secureHandle: (name, handler) => { handlers[name] = handler; },
    async invokeSafely(action) { try { return { ok: true, data: await action() }; } catch (error) { return { ok: false, error: error.message }; } },
    app: { getPath: () => 'D:/fixture', relaunch() { events.push('relaunch'); }, quit() { events.push('quit'); } },
    process: { env: { CODING_TOOLS_MCP_MEMORY_ROOT: 'D:/fixture/memory' } },
    orchestrator: { busy: false, recovering: false,
      async stop() { events.push('stop'); if (failStop) throw new Error('stop failed'); },
      native: { async stop() { events.push('native-stop'); } } },
    session: { defaultSession: currentSession, fromPartition: () => currentSession },
    taskNotificationService: { stop() { events.push('notifications-stop'); }, start() { events.push('notifications-start'); } },
    setTimeout(callback) { scheduled = callback; }, storageRestarting: false, forceQuit: false
  });
  const start = source.indexOf("  secureHandle('storage:status'");
  const end = source.indexOf("  secureHandle('app:lightweight-snapshot'", start);
  assert.ok(start >= 0 && end > start);
  vm.runInContext(source.slice(start, end), context);
  return { handlers, events, context, runScheduled: () => scheduled() };
}

test('migration IPC stops services, flushes sessions, queues migration and only then requests relaunch', async () => {
  const f = fixture();
  const result = await f.handlers['storage:apply']({}, 'issued-plan');
  assert.equal(result.ok, true);
  assert.equal(result.data.restarting, true);
  assert.ok(f.events.indexOf('stop') < f.events.indexOf('native-stop'));
  assert.ok(f.events.indexOf('native-stop') < f.events.indexOf('check-stopped'));
  assert.ok(f.events.indexOf('flush-storage') < f.events.indexOf('queue:issued-plan'));
  assert.equal(f.events.includes('relaunch'), false);
  f.runScheduled();
  assert.deepEqual(f.events.slice(-2), ['relaunch', 'quit']);
});

test('failed service stop does not queue or relaunch and releases the action guard', async () => {
  const f = fixture({ failStop: true });
  const result = await f.handlers['storage:apply']({}, 'issued-plan');
  assert.equal(result.ok, false);
  assert.match(result.error, /stop failed/);
  assert.equal(f.context.storageRestarting, false);
  assert.equal(f.events.some((event) => event.startsWith('queue:')), false);
});

test('development IPC refuses production migration', async () => {
  const f = fixture({ development: true });
  assert.equal((await f.handlers['storage:status']()).data.canChange, false);
  assert.equal((await f.handlers['storage:apply']({}, 'id')).ok, false);
  assert.equal(f.events.length, 0);
});
