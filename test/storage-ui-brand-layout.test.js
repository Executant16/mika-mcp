const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('recovery page uses the existing application icon instead of a letter placeholder', () => {
  const html = read('renderer/storage-bootstrap.html');
  assert.match(html, /<img class="bootstrap-mark" src="\.\.\/electron\/app-icon\.png" alt="Mika">/);
  assert.ok(fs.existsSync(path.join(__dirname, '../electron/app-icon.png')));
  assert.doesNotMatch(html, /aria-hidden="true">M<\/div>/);
});

test('long page errors shrink without shrinking settings or introducing a hover tooltip', () => {
  const css = read('renderer/browser.css');
  assert.match(css, /\.toolbar-right\{[^}]*flex:1 1 0;min-width:0/);
  assert.match(css, /\.toolbar-right > :not\(\.page-state\)\{flex-shrink:0\}/);
  assert.match(css, /\.page-state\{[^}]*min-width:0;max-width:240px;overflow:hidden/);
  assert.match(css, /\.page-state span\{min-width:0;overflow:hidden;text-overflow:ellipsis/);
  assert.doesNotMatch(read('renderer/browser.js'), /element\.title\s*=/);
  assert.doesNotMatch(read('renderer/browser.html'), /id="pageState"[^>]*title=/);
});
