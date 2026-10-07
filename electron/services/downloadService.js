const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function safeFilename(value) {
  const cleaned = String(value || 'attachment').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').slice(0, 180);
  return cleaned || 'attachment';
}

function uniquePath(root, filename) {
  const parsed = path.parse(safeFilename(filename));
  let candidate = path.join(root, parsed.base);
  for (let index = 1; fs.existsSync(candidate); index += 1) candidate = path.join(root, `${parsed.name} (${index})${parsed.ext}`);
  return candidate;
}

function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(file);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

class DownloadService {
  constructor({ electronSession, settings, log, onState = () => {} }) {
    this.electronSession = electronSession;
    this.settings = settings;
    this.log = log;
    this.onState = onState;
    this.bound = false;
  }

  bind() {
    if (this.bound) return;
    this.bound = true;
    this.electronSession.on('will-download', (_event, item) => {
      const workspace = String(this.settings.load().workspace || '').trim();
      if (!workspace || !fs.existsSync(workspace)) {
        this.onState({ status: 'interrupted', error: '未选择有效工作区，附件未自动保存。' });
        return;
      }
      const target = uniquePath(path.resolve(workspace), item.getFilename());
      item.setSavePath(target);
      const startedAt = Date.now();
      this.onState({ status: 'progressing', path: target, receivedBytes: 0, totalBytes: item.getTotalBytes() });
      item.on('updated', (_e, state) => this.onState({
        status: state,
        path: target,
        receivedBytes: item.getReceivedBytes(),
        totalBytes: item.getTotalBytes()
      }));
      item.once('done', async (_e, state) => {
        const payload = { status: state, path: target, durationMs: Date.now() - startedAt };
        if (state === 'completed') {
          try {
            const stat = fs.statSync(target);
            payload.size = stat.size;
            payload.sha256 = await sha256(target);
            this.log.info('ChatGPT 附件已自动保存到工作区', payload);
          } catch (error) { payload.error = error.message; }
        }
        this.onState(payload);
      });
    });
  }
}

module.exports = { DownloadService, safeFilename, uniquePath };
