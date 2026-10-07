const { spawn } = require('node:child_process');

function run(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const { timeoutMs = 0, onOutput, allowFailure, ...spawnOptions } = options;
    const child = spawn(command, args, {
      windowsHide: true,
      shell: false,
      ...spawnOptions
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      onOutput?.('stdout', text);
    });
    child.stderr?.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      onOutput?.('stderr', text);
    });
    let timeout;
    if (timeoutMs > 0) {
      timeout = setTimeout(() => {
        child.kill();
        reject(Object.assign(new Error(`命令执行超时（${timeoutMs} ms）`), { code: -1, stdout, stderr, timedOut: true }));
      }, timeoutMs);
      timeout.unref?.();
    }
    child.on('error', reject);
    child.on('close', (code) => {
      if (timeout) clearTimeout(timeout);
      const result = { code: code ?? -1, stdout, stderr };
      if (code === 0 || allowFailure) resolve(result);
      else reject(Object.assign(new Error(stderr.trim() || stdout.trim() || `${command} 执行失败（${code}）`), result));
    });
  });
}

module.exports = { run };
