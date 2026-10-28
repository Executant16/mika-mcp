const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '../renderer/styles.css'), 'utf8');
const rule = (selector) => {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, selector);
  return css.slice(start, css.indexOf('}', start) + 1);
};

test('overview action owns its theme colors without gradients, glow or movement', () => {
  const base = rule('.overview-hero-action-btn');
  assert.match(base, /background: var\(--text\) !important/);
  assert.match(base, /color: var\(--bg\) !important/);
  assert.match(base, /box-shadow: none !important/);
  assert.match(base, /transform: none !important/);
  assert.doesNotMatch(base, /linear-gradient|#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(css, /#overviewHeroActionBtn/);
  assert.match(css, /body\[data-theme="dark"\] \.primary-button:not\(:where\(\.overview-hero-action-btn\)\)/);
});

test('overview hover, pressed, focus and disabled states do not cross into global theme styles', () => {
  assert.match(rule('.overview-hero-action-btn:hover:not(:disabled)'), /var\(--text\) 90%, var\(--bg\)/);
  assert.match(rule('.overview-hero-action-btn:active:not(:disabled)'), /var\(--text\) 80%, var\(--bg\)/);
  assert.match(rule('.overview-hero-action-btn:focus-visible'), /outline: 2px solid var\(--blue\)/);
  assert.match(rule('.overview-hero-action-btn:disabled'), /opacity: 0\.45/);
});
