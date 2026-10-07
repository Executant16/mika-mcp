const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const targets = [
  path.join(ROOT, 'dist', 'win-unpacked'),
  'D:\\Mika MCP'
];

function touchDirectory(dirPath, targetTime) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    try {
      fs.utimesSync(fullPath, targetTime, targetTime);
    } catch (_) {}
    if (entry.isDirectory()) {
      touchDirectory(fullPath, targetTime);
    }
  }
}

const now = new Date();
for (const target of targets) {
  if (fs.existsSync(target)) {
    touchDirectory(target, now);
  }
}
console.log('所有文件的时间戳已成功统一更新为当前时间。');
