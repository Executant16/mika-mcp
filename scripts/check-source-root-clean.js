const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const junk = [
  '%SystemDrive%',
  'browser.css',
  'chatViewController.js',
  "x[1]).join('",
  '{',
  '{{'
];

const found = junk.filter((relative) => fs.existsSync(path.join(root, relative)));
if (found.length) {
  console.error(`发现源目录中的可疑 Shell 产物：${found.join(', ')}。此脚本不会删除任何内容；请独立核实后再使用可恢复方式清理。`);
  process.exit(1);
}
console.log('source root clean');
