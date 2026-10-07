const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('obsolete custom conversation sidebar is removed from the product code', () => {
  const combined = [
    read('renderer/browser.html'),
    read('renderer/browser.css'),
    read('renderer/browser.js'),
    read('electron/browserPreload.js'),
    read('electron/chatViewController.js'),
    read('electron/main.js'),
    read('electron/paths.js')
  ].join('\n');
  for (const obsolete of [
    'agentSidebar', 'agent-sidebar', 'railToggle', 'conversationIndex',
    'syncVisibleConversations', 'setConversationWorkspace', 'setLeftInset',
    'discoverVisibleConversations', 'collapseNativeSidebar', 'conversation:index-changed'
  ]) {
    assert.equal(combined.includes(obsolete), false, obsolete);
  }
  assert.equal(fs.existsSync(path.join(root, 'electron/services/conversationIndexStore.js')), false);
});

test('embedded ChatGPT view uses the full available width', () => {
  const controller = read('electron/chatViewController.js');
  /* ★ 保留的原意图（第 23 轮「删掉左侧会话栏之后，内嵌视图默认占满宽度、
   *   不留任何永久左侧留白」）。
   *   左侧确实没有回来：x 仍是字面量 0。变的是新增的**右侧**技能/提示词抽屉
   *   会按宽度右缩视图 —— 于是字面量从 Math.max(0, width) 变成
   *   Math.max(0, width - rightMargin)，而 rightMargin 默认取自 0。
   *   等价契约 = 左偏移恒为 0 **且** 右缩量默认为 0（没开抽屉时就是满宽）。 */
  const resize = controller.match(/resize\(\)\s*\{[\s\S]*?\n  \}/)?.[0] || '';
  assert.ok(resize, '应能截出 resize()');
  assert.match(resize, /x:\s*0,/, '★ 左侧不得有任何偏移（删除会话栏后左边永远贴边）');
  assert.match(resize, /const rightMargin = this\.sidebarWidth \|\| 0;/,
    '★ 右缩量必须默认 0：没打开右侧抽屉时视图就该是满宽');
  assert.match(resize, /width:\s*Math\.max\(0, width - rightMargin\)/,
    '★ 满宽契约：width - rightMargin（rightMargin 默认 0 时即原 Math.max(0, width)）');
  /* 冷启动同样是 0：构造时初始化 sidebarWidth = 0，setSidebarWidth 再把非法值钳到 0。
   * 少了任何一条，都会凭空右缩一块或让视图宽度变成 NaN。 */
  assert.match(controller, /this\.sidebarWidth = 0;/,
    '★ 冷启动必须把抽屉宽度初始化成 0，否则会凭空右缩一块');
  assert.match(controller, /setSidebarWidth\(width\)\s*\{[\s\S]*?Math\.max\(0, Number\(width\) \|\| 0\)/,
    '★ setSidebarWidth 必须把非法值/负值钳成 0，保证「没抽屉 = 满宽」');
});

test('authentication popup returns completed ChatGPT login to the embedded view', () => {
  const controller = read('electron/chatViewController.js');
  assert.match(controller, /did-create-window/);
  assert.match(controller, /bindAuthPopup/);
  assert.match(controller, /isChatGptNavigation/);
  assert.match(controller, /popup\.close\(\)/);
  assert.match(controller, /maximizable:\s*false/);
});
