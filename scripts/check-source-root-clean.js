const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const transient = path.join(root, '%SystemDrive%');
if (fs.existsSync(transient)) {
  fs.rmSync(transient, { recursive: true, force: true });
  console.log('cleaned transient %SystemDrive% artifact from older MCP runtime');
}

const junk = [
  'browser.css',
  'chatViewController.js',
  "x[1]).join('",
  '{',
  '{{'
];

const found = junk.filter((relative) => fs.existsSync(path.join(root, relative)));
if (found.length) {
  console.error(`Unexpected shell-artifact files in source root: ${found.join(', ')}`);
  process.exit(1);
}
console.log('source root clean');
