'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../scripts/check-css-ratchet.js'), 'utf8');
const functionSource = source.match(/function normalizeText\(text\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(functionSource, 'The ratchet must provide message normalization');
const normalizeText = vm.runInNewContext(`(${functionSource})`);

test('CSS ratchet treats LF and Windows CRLF multiline selectors as the same warning', () => {
  const lf = 'Duplicate selector ".skills-hero-card,\n.prompts-hero-card", first used at line 15 (no-duplicate-selectors)';
  const crlf = lf.replace(/\n/g, '\r\n').replace('line 15', 'line 30');
  assert.equal(normalizeText(lf), normalizeText(crlf));
  assert.match(normalizeText(crlf), /first used at line \?/);
  assert.doesNotMatch(normalizeText(crlf), /\r/);
});

test('CSS ratchet still distinguishes different selectors and values after normalization', () => {
  assert.notEqual(normalizeText('Duplicate selector ".first", first used at line 15'),
    normalizeText('Duplicate selector ".second", first used at line 30'));
  assert.notEqual(normalizeText('Disallowed hex color "#fff" (color-no-hex)'),
    normalizeText('Disallowed hex color "#000" (color-no-hex)'));
});
