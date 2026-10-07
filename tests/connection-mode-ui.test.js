const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('experimental local Bridge UI is fully removed', () => {
  const html = read('renderer/index.html');
  const app = read('renderer/app.js');
  const main = read('electron/main.js');
  const config = read('electron/services/config.js');
  assert.doesNotMatch(html, /data-connection-mode=/);
  assert.doesNotMatch(html, /id="modeGate"/);
  assert.doesNotMatch(html, /id="changeConnectionMode"/);
  assert.doesNotMatch(app, /LOCAL_MCP_CALL|WEB_MCP_BRIDGE|selectConnectionMode|openConnectionModeChooser/);
  assert.doesNotMatch(main, /ChatBridgeService|bridgeService/);
  assert.match(html, /ChatGPT 通道/, '当前连接界面应保留 ChatGPT 通道状态说明');
  assert.match(config, /const DEFAULTS = Object\.freeze\(\{[\s\S]*?connectionMode:\s*'official'/,
    '真实持久化配置的默认连接模式应仍是官方 MCP 通道');
  assert.match(config, /merged\.connectionMode\s*=\s*'official'/,
    '配置归一化必须把历史或外部输入收口到官方 MCP 通道');
});

test('legacy Bridge users get a visible migration notice instead of an automatic mode switch', () => {
  const html = read('renderer/index.html');
  const app = read('renderer/app.js');
  assert.match(html, /id="bridgeRemovedNotice"/);
  assert.match(html, /实验性本地 Bridge 已移除/);
  assert.match(html, /id="ackBridgeRemoved"/);
  assert.match(app, /bridgeRemovedNotice/);
});
