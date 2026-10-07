const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readJson, writeJsonAtomic } = require('../electron/services/jsonStore');

test('JSON settings recover from the last valid backup', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'web-mcp-settings-'));
  const file = path.join(directory, 'settings.json');
  try {
    writeJsonAtomic(file, { workspace: 'first' });
    writeJsonAtomic(file, { workspace: 'second' });
    fs.writeFileSync(file, '{ broken json', 'utf8');
    assert.deepEqual(readJson(file, {}), { workspace: 'first' });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
