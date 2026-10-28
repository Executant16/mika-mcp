const fs = require('node:fs/promises');
const path = require('node:path');

async function openMemoryDirectory({ readConfig, openPath }) {
  // Only the authenticated local Runtime chooses this path, never the renderer.
  const result = await readConfig();
  if (result?.ok !== true) throw new Error('Runtime 记忆配置读取失败，已停止打开目录。');
  const root = result?.config?.root;
  if (typeof root !== 'string' || !root.trim() || !path.isAbsolute(root)) {
    throw new Error('Runtime 未返回有效的绝对记忆目录，请确认本地 Runtime 已就绪。');
  }
  let current = path.resolve(root);
  while (true) {
    let stat;
    try { stat = await fs.lstat(current); }
    catch (error) {
      if (error.code === 'ENOENT') throw new Error('本地尚未创建记忆目录。');
      throw error;
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error('记忆路径包含链接或非目录，已停止打开。');
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  const entries = await fs.readdir(root);
  if (!entries.some((name) => !name.startsWith('.') && name !== '__pycache__')) {
    throw new Error('记忆目录为空，暂无可查看的记忆文件。');
  }
  const failure = await openPath(root);
  if (failure) throw new Error(`打开记忆文件夹失败：${failure}`);
  return { opened: true, root };
}

module.exports = { openMemoryDirectory };
