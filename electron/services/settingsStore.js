const crypto = require('node:crypto');
const { settingsFile } = require('../paths');
const { readJson, writeJsonAtomic } = require('./jsonStore');
const { DEFAULTS, normalize } = require('./config');

function sanitizeForDisk(data) {
  if (!data || typeof data !== 'object') return data;
  const clone = { ...data };
  // 通道 ID 属核心敏感连接凭据，必须 100% 经由 Windows DPAPI 加密保存于 SecretStore，绝不落盘到明文 settings.json
  delete clone.tunnelId;
  return clone;
}

class SettingsStore {
  constructor() {
    this._cached = null;
    this._startupResetDone = false;
  }

  load(forceReload = false) {
    if (!this._cached || forceReload) {
      const data = normalize(readJson(settingsFile(), {}));
      if (!this._startupResetDone) {
        // 应用冷启动加载时，敏感操作保护自动锁上（防误触安全闭环）
        data.developerMode = false;
        this._startupResetDone = true;
        try { writeJsonAtomic(settingsFile(), sanitizeForDisk(data)); } catch (_) {}
      }
      this._cached = data;
    }
    return this._cached;
  }

  save(patch) {
    const next = normalize({ ...this.load(), ...patch });
    this._cached = next;
    try {
      writeJsonAtomic(settingsFile(), sanitizeForDisk(next));
    } catch (err) {
      console.warn('保存配置至 settings.json 遇到外部文件系统锁定，已保留内存配置生效：', err?.message || err);
    }
    return next;
  }

  ensureAuthToken() {
    const current = this.load();
    if (!current.authTokenId) {
      current.authTokenId = crypto.randomBytes(16).toString('hex');
      this._cached = current;
      try {
        writeJsonAtomic(settingsFile(), current);
      } catch (err) {
        console.warn('保存 authTokenId 遇到外部文件系统锁定，已保留内存有效状态：', err?.message || err);
      }
    }
    return current.authTokenId;
  }
}

module.exports = { SettingsStore, DEFAULTS, normalize };
