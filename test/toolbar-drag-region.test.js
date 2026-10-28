const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '../renderer/browser.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

test('toolbar prevents text selection and native drag ghosts', () => {
  const rule = css.match(/\.browser-toolbar,\.browser-toolbar \*\{([^}]+)\}/)?.[1];
  assert.match(rule, /user-select:none/);
  assert.match(rule, /-webkit-user-drag:none/);
});

test('stretching toolbar groups leave blank space draggable but actual controls stay interactive', () => {
  assert.match(css, /\.toolbar-main\{[^}]*-webkit-app-region:drag/);
  assert.match(css, /\.toolbar-left,\.toolbar-center,\.toolbar-right\{-webkit-app-region:drag\}/);
  const noDragGroups = [...css.matchAll(/([^{}]+)\{[^{}]*-webkit-app-region:\s*no-drag[^{}]*\}/g)]
    .map((match) => match[1].trim());
  for (const group of noDragGroups) {
    assert.doesNotMatch(group, /(?:^|,)\s*\.toolbar-(?:left|center|right)\s*(?:,|$)/);
  }
  assert.ok(noDragGroups.some((group) => group.split(',').some((selector) => selector.trim() === 'button')));
  assert.ok(noDragGroups.some((group) => group.includes('.health-pill')));
  assert.ok(noDragGroups.some((group) => group.includes('.workspace-trigger')));
  assert.ok(noDragGroups.some((group) => group.includes('.window-control-btn')));
});
