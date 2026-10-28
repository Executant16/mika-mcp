const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../renderer/dropdown.js'), 'utf8');

test('workspace keyboard respects focused buttons while arrows move focus within its list', () => {
  const body = {}, card = {}, manage = {}, remove = {};
  const document = { body, activeElement: card, getElementById: (id) => id === 'dropdownCard' ? card : id === 'manageBtn' ? manage : remove };
  let handler;
  let clicks = 0, closes = 0;
  const items = [0, 1].map(() => ({ classList: { toggle() {} }, scrollIntoView() {},
    focus() { document.activeElement = this; }, click() { clicks++; } }));
  const context = vm.createContext({ document, itemElements: items, highlightedIndex: 0,
    api: { close() { closes++; } }, window: { addEventListener: (_event, callback) => { handler = callback; } } });
  const highlightStart = source.indexOf('function updateHighlight(');
  vm.runInContext(source.slice(highlightStart, source.indexOf('\nfunction selectWorkspaceItem(', highlightStart)), context);
  const start = source.indexOf("window.addEventListener('keydown'");
  vm.runInContext(source.slice(start, source.indexOf('\n\nlet hasRenderedFromPush', start)), context);
  function key(key) { let prevented = false; handler({ key, preventDefault() { prevented = true; } }); return prevented; }
  for (const control of [remove, manage, items[0]]) {
    document.activeElement = control;
    assert.equal(key('Enter'), false, 'focused button receives native Enter');
    assert.equal(clicks, 0);
  }
  document.activeElement = card;
  assert.equal(key('Enter'), true);
  assert.equal(clicks, 1);
  assert.equal(key('ArrowDown'), true);
  assert.equal(document.activeElement, items[1]);
  assert.equal(key('ArrowUp'), true);
  assert.equal(document.activeElement, items[0]);
  document.activeElement = remove;
  assert.equal(key('ArrowDown'), false);
  assert.equal(key('Escape'), true);
  assert.equal(closes, 1);
});

test('workspace card remains scrollable when the native popup is height-limited', () => {
  const css = fs.readFileSync(path.join(__dirname, '../renderer/dropdown.css'), 'utf8');
  assert.match(css, /\.dropdown\s*\{[^}]*max-height:\s*100%;[^}]*overflow-y:\s*auto/);
  assert.match(source, /card\?\.scrollHeight/);
});
