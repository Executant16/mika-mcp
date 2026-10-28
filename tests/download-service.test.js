const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { safeFilename, uniquePath } = require('../electron/services/downloadService');

test('attachment names are sanitized and cannot escape the workspace', () => {
  assert.equal(safeFilename('..\\bad:name?.docx'), '.._bad_name_.docx');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'download-service-'));
  let sample;
  try {
    const first = uniquePath(root, '..\\report.docx');
    assert.equal(path.dirname(first), root);
    sample = first;
    fs.writeFileSync(first, 'one');
    assert.match(path.basename(uniquePath(root, '..\\report.docx')), /\(1\)\.docx$/);
  } finally {
    // Only remove this fixture's sample and its now-empty directory.
    // Unexpected contents must fail cleanup instead of being deleted recursively.
    if (sample && fs.existsSync(sample)) fs.unlinkSync(sample);
    fs.rmdirSync(root);
  }
});
