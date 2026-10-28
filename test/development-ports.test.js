const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const net = require('node:net');
const { normalize, DEFAULTS, DEVELOPMENT_PORTS, validateRuntimeSettings } = require('../electron/services/config');
const root = path.resolve(__dirname, '..');
const dev = (input = {}) => normalize(input, { development: true });

test('production defaults stay unchanged and development defaults use distinct valid ports', () => {
  assert.equal(normalize().mcpPort, 18765);
  assert.equal(normalize().healthPort, 18081);
  assert.equal(dev().mcpPort, 28765);
  assert.equal(dev().healthPort, 28081);
  validateRuntimeSettings(dev());
  assert.equal(new Set([DEFAULTS.mcpPort, DEFAULTS.healthPort, ...Object.values(DEVELOPMENT_PORTS)]).size, 4);
  assert.equal(dev({ mcpPort: 'invalid', healthPort: 'invalid' }).mcpPort, 28765);
});

test('only the legacy default pair is upgraded once; custom and mixed pairs stay intact', () => {
  const upgraded = dev({ mcpPort: '18765', healthPort: '18081' });
  assert.equal(upgraded.mcpPort, 28765);
  assert.equal(upgraded.healthPort, 28081);
  assert.equal(upgraded.developmentPortsMigrated, true);
  for (const input of [{ mcpPort: 30001, healthPort: 30002 }, { mcpPort: 18765, healthPort: 30002 }]) {
    const result = dev(input);
    assert.equal(result.mcpPort, input.mcpPort);
    assert.equal(result.healthPort, input.healthPort);
  }
  // Once acknowledged, even explicitly reselected production ports are not rewritten.
  const saved = dev({ ...upgraded, mcpPort: 18765, healthPort: 18081 });
  assert.equal(saved.mcpPort, 18765);
  assert.equal(saved.healthPort, 18081);
  assert.equal(normalize({ mcpPort: 18765, healthPort: 18081 }).mcpPort, 18765);
});

test('SettingsStore persists channel defaults and migration state across fresh instances', () => {
  const parent = path.join(root, 'tmp/development-ports');
  fs.mkdirSync(parent, { recursive: true });
  const task = fs.mkdtempSync(path.join(parent, 'settings-'));
  const filename = path.join(task, 'settings.json');
  const source = fs.readFileSync(path.join(root, 'electron/services/settingsStore.js'), 'utf8');
  const module = { exports: {} };
  vm.runInNewContext(source, { module, console, require(name) {
    if (name === '../paths') return { settingsFile: () => filename };
    return require(name.startsWith('./') ? path.join(root, 'electron/services', name) : name);
  } });
  const { SettingsStore } = module.exports;
  fs.writeFileSync(filename, JSON.stringify({ mcpPort: 18765, healthPort: 18081 }));
  const store = new SettingsStore({ development: true });
  assert.equal(store.load().mcpPort, 28765);
  assert.equal(JSON.parse(fs.readFileSync(filename, 'utf8')).developmentPortsMigrated, true);
  store.save({ mcpPort: 18765, healthPort: 18081 });
  assert.equal(new SettingsStore({ development: true }).load().mcpPort, 18765);
  assert.equal(new SettingsStore().load().healthPort, 18081);
  assert.match(fs.readFileSync(path.join(root, 'electron/main.js'), 'utf8'), /new SettingsStore\(\{ development: !app\.isPackaged \}\)/);
});

test('the four default loopback endpoints can listen concurrently when available', async (t) => {
  const servers = [];
  try {
    for (const port of [18765, 18081, 28765, 28081]) {
      const server = net.createServer((socket) => socket.end('mika-port-probe'));
      try {
        await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
      } catch (error) {
        if (['EADDRINUSE', 'EACCES', 'EPERM'].includes(error.code)) {
          t.skip(`port ${port} unavailable (${error.code}); existing listeners left untouched`);
          return;
        }
        throw error;
      }
      servers.push(server);
      const content = await new Promise((resolve, reject) => {
        const socket = net.connect(port, '127.0.0.1');
        let value = '';
        socket.setTimeout(2000, () => socket.destroy(new Error('connection timeout')));
        socket.on('error', reject); socket.on('data', (data) => { value += data; });
        socket.on('end', () => resolve(value));
      });
      assert.equal(content, 'mika-port-probe');
    }
  } finally {
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
  }
});
