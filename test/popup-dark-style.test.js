const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

for (const file of ['dropdown.css', 'health-dropdown.css']) {
  test(`${file}: dark popup uses a fine border without an outer shadow; light styling is preserved`, () => {
    const css = fs.readFileSync(path.join(__dirname, '../renderer', file), 'utf8');
    const dark = css.match(/\[data-theme="dark"\]\s*\{([^}]+)\}/)?.[1];
    const light = css.match(/:root\s*\{([^}]+)\}/)?.[1];
    assert.match(dark, /--shadow:\s*none;/);
    assert.match(dark, /--border-card:\s*rgba\(255, 255, 255, 0\.14\)/);
    assert.match(light, /--shadow:\s*0 /);
    assert.match(css, /box-shadow:\s*var\(--shadow\)/);
  });
}
