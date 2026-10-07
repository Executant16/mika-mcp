const fs = require('node:fs');
const { EventEmitter } = require('node:events');
const { logFile } = require('../paths');
const { ensureParent } = require('./jsonStore');

const MAX_LOG_BYTES = 10 * 1024 * 1024;
const MAX_LOG_FILES = 5;

function clearFileReadOnly(targetPath) {
  if (process.platform === 'win32' && fs.existsSync(targetPath)) {
    try {
      fs.chmodSync(targetPath, 0o666);
    } catch (_) {}
  }
}

function rotateLog(file, maxBytes = MAX_LOG_BYTES, maxFiles = MAX_LOG_FILES) {
  try {
    clearFileReadOnly(file);
    if (!fs.existsSync(file) || fs.statSync(file).size < maxBytes) return false;
    for (let index = maxFiles - 1; index >= 1; index -= 1) {
      const source = `${file}.${index}`;
      const target = `${file}.${index + 1}`;
      clearFileReadOnly(source);
      clearFileReadOnly(target);
      if (fs.existsSync(source)) fs.renameSync(source, target);
    }
    clearFileReadOnly(file);
    clearFileReadOnly(`${file}.1`);
    fs.renameSync(file, `${file}.1`);
    return true;
  } catch {
    return false;
  }
}

class LogService extends EventEmitter {
  constructor() {
    super();
    this.buffer = [];
  }

  write(level, message, meta = {}) {
    const safeMeta = { ...meta };
    for (const key of Object.keys(safeMeta)) {
      if (/key|token|authorization|secret/i.test(key)) safeMeta[key] = '[已隐藏]';
    }
    const event = {
      time: new Date().toISOString(),
      level,
      message: String(message),
      meta: safeMeta
    };
    this.buffer.push(event);
    if (this.buffer.length > 1000) this.buffer.shift();

    // 写入本地磁盘（非阻塞容错：即使日志文件被外部杀毒软件锁定或标记只读，绝不抛崩核心业务操作）
    try {
      const file = logFile();
      ensureParent(file);
      clearFileReadOnly(file);
      rotateLog(file);
      clearFileReadOnly(file);
      fs.appendFileSync(file, `${JSON.stringify(event)}\n`, 'utf8');
    } catch (diskErr) {
      // 保持内存缓冲有效并向界面广播事件
    }

    this.emit('entry', event);
    return event;
  }

  info(message, meta) { return this.write('info', message, meta); }
  warn(message, meta) { return this.write('warn', message, meta); }
  error(message, meta) { return this.write('error', message, meta); }

  read(limit = 300) {
    if (this.buffer.length) return this.buffer.slice(-limit);
    try {
      return fs.readFileSync(logFile(), 'utf8').trim().split(/\r?\n/).filter(Boolean)
        .slice(-Math.max(limit * 3, limit))
        .map((line) => {
          try { return JSON.parse(line); } catch { return null; }
        })
        .filter(Boolean)
        .slice(-limit);
    } catch {
      return [];
    }
  }

  clear() {
    this.buffer = [];
    try {
      const file = logFile();
      ensureParent(file);
      clearFileReadOnly(file);
      fs.writeFileSync(file, '', 'utf8');
    } catch (_) {}
  }
}

module.exports = { LogService, rotateLog, MAX_LOG_BYTES, MAX_LOG_FILES };
