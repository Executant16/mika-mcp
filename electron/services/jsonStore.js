const fs = require('node:fs');
const path = require('node:path');

const RETRYABLE_CODES = new Set(['EBUSY', 'EACCES', 'EPERM']);

function ensureParent(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function backupFile(file) {
  return `${file}.bak`;
}

function parseJsonFile(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readJson(file, fallback = {}) {
  try {
    return parseJsonFile(file);
  } catch (primaryError) {
    try {
      return parseJsonFile(backupFile(file));
    } catch {
      return typeof fallback === 'function' ? fallback(primaryError) : fallback;
    }
  }
}

function sleepSync(milliseconds) {
  const start = Date.now();
  while (Date.now() - start < milliseconds) {
    // 同步空循环等待，避免 Atomics.wait 在 Node.js/Electron 主线程抛出 TypeError
  }
}

function retrySync(action, attempts = 5) {
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try {
      return action();
    } catch (error) {
      lastError = error;
      if (!RETRYABLE_CODES.has(error?.code) || index === attempts - 1) throw error;
      sleepSync(25 * (index + 1));
    }
  }
  throw lastError;
}

function clearReadOnly(targetPath) {
  if (process.platform === 'win32' && fs.existsSync(targetPath)) {
    try {
      fs.chmodSync(targetPath, 0o666);
    } catch (_) {}
  }
}

function directWriteJson(file, payload, backup) {
  ensureParent(file);
  clearReadOnly(file);
  clearReadOnly(backup);

  if (fs.existsSync(file)) {
    try {
      parseJsonFile(file);
      retrySync(() => {
        clearReadOnly(backup);
        fs.copyFileSync(file, backup);
      }, 3);
    } catch {
      // 保持上一个完好的备份
    }
  }

  try {
    clearReadOnly(file);
    retrySync(() => {
      fs.writeFileSync(file, payload, 'utf8');
    }, 4);
  } catch (writeErr) {
    // 若直接覆盖遇到 Windows EPERM/EACCES，尝试解绑式重建（先 unlink 再新写，破除 DOS 只读与排他句柄锁）
    clearReadOnly(file);
    try {
      fs.unlinkSync(file);
    } catch (_) {}
    clearReadOnly(file);
    fs.writeFileSync(file, payload, 'utf8');
  }
}

function writeJsonAtomic(file, value) {
  ensureParent(file);
  clearReadOnly(file);
  const backup = backupFile(file);
  clearReadOnly(backup);
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  const isWindows = process.platform === 'win32';

  // 1. 若现有文件存在且为有效 JSON，先安全备份
  if (fs.existsSync(file)) {
    try {
      parseJsonFile(file);
      retrySync(() => fs.copyFileSync(file, backup), 3);
    } catch {
      // 保留上一个完好备份
    }
  }

  // 2. 尝试临时文件原子替换（每次重试均采用全新随机文件名，彻底避免 Windows 句柄冲突与防病毒锁）
  let writtenSuccessfully = false;
  let lastError = null;

  for (let attempt = 0; attempt < 3 && !writtenSuccessfully; attempt += 1) {
    const temporary = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
    try {
      let descriptor;
      try {
        descriptor = isWindows ? fs.openSync(temporary, 'w') : fs.openSync(temporary, 'w', 0o600);
        fs.writeFileSync(descriptor, payload, 'utf8');
        fs.fsyncSync(descriptor);
      } finally {
        if (descriptor !== undefined) {
          try { fs.closeSync(descriptor); } catch (_) {}
        }
      }

      // 将临时文件替换到目标文件前，先清除目标文件只读属性
      clearReadOnly(file);

      try {
        fs.renameSync(temporary, file);
        writtenSuccessfully = true;
      } catch (renameError) {
        clearReadOnly(file);
        // Windows 上若 rename 遇到占用或权限限制 (EPERM/EACCES/EBUSY)，采用 copyFileSync 覆盖（NTFS 兼容性极高）
        if (isWindows && RETRYABLE_CODES.has(renameError?.code)) {
          try {
            fs.copyFileSync(temporary, file);
            writtenSuccessfully = true;
          } catch (copyErr) {
            clearReadOnly(file);
            try { fs.unlinkSync(file); } catch (_) {}
            fs.copyFileSync(temporary, file);
            writtenSuccessfully = true;
          }
        } else {
          throw renameError;
        }
      }
    } catch (err) {
      lastError = err;
      sleepSync(25 * (attempt + 1));
    } finally {
      try {
        if (fs.existsSync(temporary)) {
          clearReadOnly(temporary);
          fs.rmSync(temporary, { force: true });
        }
      } catch (_) {}
    }
  }

  // 3. 若原子写入遇到特殊策略限制，平滑降级为直写目标文件保障用户数据成功持久化
  if (!writtenSuccessfully) {
    try {
      directWriteJson(file, payload, backup);
    } catch (fallbackError) {
      throw fallbackError || lastError;
    }
  }
}

function updateJsonAtomic(file, updater, fallback = {}) {
  const current = readJson(file, fallback);
  const next = updater(current);
  writeJsonAtomic(file, next);
  return next;
}

module.exports = { readJson, writeJsonAtomic, updateJsonAtomic, ensureParent, backupFile };
