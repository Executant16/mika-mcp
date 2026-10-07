const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { safeFilename, uniquePath } = require('../electron/services/downloadService');

test('attachment names are sanitized and cannot escape the workspace', () => {
  assert.equal(safeFilename('..\\bad:name?.docx'), '.._bad_name_.docx');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'download-service-'));
  const first = uniquePath(root, '..\\report.docx');
  assert.equal(path.dirname(first), root);
  fs.writeFileSync(first, 'one');
  assert.match(path.basename(uniquePath(root, '..\\report.docx')), /\(1\)\.docx$/);
});
