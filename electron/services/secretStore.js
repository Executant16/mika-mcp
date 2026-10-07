const fs = require('node:fs');
const { safeStorage } = require('electron');
const { secretsFile } = require('../paths');
const { ensureParent } = require('./jsonStore');

class SecretStore {
  _readAll() {
    try {
      const encrypted = fs.readFileSync(secretsFile());
      if (!safeStorage.isEncryptionAvailable()) return {};
      return JSON.parse(safeStorage.decryptString(encrypted));
    } catch {
      return {};
    }
  }

  _writeAll(value) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Windows 安全存储当前不可用，无法保存密钥。');
    }
    ensureParent(secretsFile());
    fs.writeFileSync(secretsFile(), safeStorage.encryptString(JSON.stringify(value)), { mode: 0o600 });
  }

  set(name, value) {
    const text = String(value || '').trim();
    if (!text) {
      this.remove(name);
      return;
    }
    const all = this._readAll();
    all[name] = text;
    this._writeAll(all);
  }

  get(name) {
    return this._readAll()[name] || '';
  }

  remove(name) {
    const all = this._readAll();
    delete all[name];
    this._writeAll(all);
  }

  status() {
    const all = this._readAll();
    return {
      runtimeApiKey: Boolean(all.runtimeApiKey),
      mcpAuthToken: Boolean(all.mcpAuthToken),
      tunnelId: Boolean(all.tunnelId)
    };
  }
}

module.exports = { SecretStore };
