const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { pythonStatus } = require('./environmentService');
const { stateFile, mcpLogFile, resourcesRoot, dataRoot } = require('../paths');
const { readJson, updateJsonAtomic, ensureParent } = require('./jsonStore');
const { rotateLog } = require('./logService');

let sourceFingerprintCache = { signature: '', hash: '' };

function runtimeSourceFiles() {
  const runtimeRoot = path.join(runtimeResourcesRoot(), 'coding-tools-mcp');
  const packageRoot = path.join(runtimeRoot, 'coding_tools_mcp');
  const files = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === '__pycache__') continue;
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(target);
      else if (entry.isFile() && entry.name.endsWith('.py')) files.push(target);
    }
  };
  if (fs.existsSync(packageRoot)) walk(packageRoot);
  const contract = path.join(runtimeRoot, 'schema-contract.json');
  if (fs.existsSync(contract)) files.push(contract);
  return files.sort((a, b) => a.localeCompare(b));
}

function runtimeResourcesRoot() {
  try {
    return resourcesRoot();
  } catch {
    return path.resolve(__dirname, '..', '..', 'resources');
  }
}

function runtimeSourceFingerprint() {
  const runtimeRoot = path.join(runtimeResourcesRoot(), 'coding-tools-mcp');
  const files = runtimeSourceFiles();
  const metadata = files.map((file) => {
    const name = path.relative(runtimeRoot, file).replaceAll('\\', '/');
    try {
      const stat = fs.statSync(file);
      return `${name}:${stat.size}:${stat.mtimeMs}`;
    } catch {
      return `${name}:missing`;
    }
  }).join('|');
  if (sourceFingerprintCache.signature === metadata && sourceFingerprintCache.hash) return sourceFingerprintCache.hash;
  const digest = crypto.createHash('sha256');
  files.forEach((file) => {
    const name = path.relative(runtimeRoot, file).replaceAll('\\', '/');
    digest.update(name);
    try { digest.update(fs.readFileSync(file)); } catch { digest.update('missing'); }
  });
  sourceFingerprintCache = { signature: metadata, hash: digest.digest('hex') };
  return sourceFingerprintCache.hash;
}

function isAlive(pid) {
  if (!Number.isInteger(pid)) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function runtimeFingerprint(settings, sourceFingerprint = runtimeSourceFingerprint(), runtimeRoot = '') {
  return crypto.createHash('sha256').update(JSON.stringify({
    workspace: path.resolve(String(settings.workspace || '')).toLowerCase(),
    authorizedRoots: (settings.authorizedRoots || []).map((item) => path.resolve(String(item)).toLowerCase()).sort(),
    port: Number(settings.mcpPort),
    permissionMode: settings.permissionMode || 'safe',
    toolMode: 'smart',
    runtimeSource: sourceFingerprint,
    runtimeRoot: runtimeRoot ? path.resolve(runtimeRoot).toLowerCase() : ''
  })).digest('hex');
}

function currentRuntimeState(input = {}) {
  const allowed = new Set([
    'manualStop', 'tunnelPid', 'tunnelStartedAt',
    'nativePid', 'nativeFingerprint', 'nativeWorkspace', 'nativePort',
    'nativePermissionMode', 'nativeToolMode', 'nativeCommand', 'startedAt',
    'nativeInstanceId', 'nativeSourceFingerprint', 'nativeRuntimeRoot', 'nativeCleanupPending'
  ]);
  return Object.fromEntries(Object.entries(input).filter(([key]) => allowed.has(key)));
}

class NativeService {
  constructor(log) {
    this.log = log;
  }

  async start(settings, token, progress) {
    const python = await pythonStatus();
    if (!python.installed) {
      throw new Error('未找到 Python 3.11+。正式安装包可内置便携 Python；开发版请先安装 Python 3.11+。');
    }
    const current = readJson(stateFile(), {});
    const sourceFingerprint = runtimeSourceFingerprint();
    const runtimeRoot = path.resolve(dataRoot(), 'runtime-workspace');
    const fingerprint = runtimeFingerprint(settings, sourceFingerprint, runtimeRoot);
    if (isAlive(current.nativePid) && current.nativeFingerprint === fingerprint) {
      this.log.info('便携 MCP 已在目标工作目录运行', { pid: current.nativePid, workspace: settings.workspace });
      return {
        reused: true,
        pid: current.nativePid,
        launchId: String(current.nativeInstanceId || ''),
        sourceFingerprint: String(current.nativeSourceFingerprint || sourceFingerprint)
      };
    }
    if (isAlive(current.nativePid)) {
      this.log.info('检测到便携 MCP 配置已变化，正在静默重建', { from: current.nativeWorkspace || '', to: settings.workspace });
      await this.stop();
    } else if (current.nativePid || (Array.isArray(current.nativeCleanupPending) && current.nativeCleanupPending.length)) {
      await this.stop();
    }

    progress('native-start', 45, `正在使用 ${python.version} 静默启动便携运行时`);
    ensureParent(mcpLogFile());
    rotateLog(mcpLogFile());
    const output = fs.openSync(mcpLogFile(), 'a');
    const launchId = crypto.randomBytes(16).toString('hex');
    const env = {
      ...process.env,
      CODING_TOOLS_MCP_AUTH_MODE: 'bearer',
      CODING_TOOLS_MCP_AUTH_TOKEN: token,
      CODING_TOOLS_MCP_TELEMETRY: 'off',
      CODING_TOOLS_MCP_TOOL_MODE: 'smart',
      CODING_TOOLS_MCP_RUNTIME_ROOT: runtimeRoot,
      CODING_TOOLS_MCP_AUTHORIZED_ROOTS: JSON.stringify(settings.authorizedRoots || []),
      CODING_TOOLS_MCP_LONG_TOOL_HANDOFF_SECONDS: '8',
      CODING_TOOLS_MCP_PROGRESS_REPORT_SECONDS: String(settings.progressReportSeconds || 90),
      CODING_TOOLS_MCP_LAUNCH_ID: launchId,
      CODING_TOOLS_MCP_SOURCE_FINGERPRINT: sourceFingerprint
    };
    const bundledTools = path.join(resourcesRoot(), 'tools');
    const vendoredPython = path.join(resourcesRoot(), 'coding-tools-mcp', 'python_vendor');
    env.PATH = [bundledTools, process.env.PATH || ''].filter(Boolean).join(path.delimiter);
    env.PYTHONPATH = [vendoredPython, path.join(resourcesRoot(), 'coding-tools-mcp'), process.env.PYTHONPATH || ''].filter(Boolean).join(path.delimiter);
    const args = [
      ...python.prefixArgs,
      '-m', 'coding_tools_mcp',
      '--workspace', settings.workspace,
      '--host', '127.0.0.1',
      '--port', String(settings.mcpPort),
      '--permission-mode', settings.permissionMode
    ];
    const command = python.launchCommand || python.command;
    const child = spawn(command, args, {
      detached: false,
      windowsHide: true,
      stdio: ['ignore', output, output],
      env
    });
    await new Promise((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    });
    child.unref();
    fs.closeSync(output);
    updateJsonAtomic(stateFile(), (value) => ({
      ...currentRuntimeState(value),
      nativePid: child.pid,
      nativeFingerprint: fingerprint,
      nativeWorkspace: path.resolve(settings.workspace),
      nativePort: Number(settings.mcpPort),
      nativePermissionMode: settings.permissionMode,
      nativeToolMode: 'smart',
      nativeCommand: command,
      startedAt: new Date().toISOString(),
      nativeInstanceId: launchId,
      nativeSourceFingerprint: sourceFingerprint,
      nativeRuntimeRoot: runtimeRoot
    }));
    this.log.info('便携 MCP 运行时已启动', { pid: child.pid, workspace: settings.workspace, command });
    return { reused: false, pid: child.pid, launchId, sourceFingerprint };
  }

  async stop() {
    const state = readJson(stateFile(), {});
    const alive = isAlive(state.nativePid);
    if (alive) {
      const { run } = require('./commandRunner');
      await run('taskkill.exe', ['/PID', String(state.nativePid), '/T', '/F'], { allowFailure: true });
      for (let index = 0; index < 25 && isAlive(state.nativePid); index += 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (isAlive(state.nativePid)) {
        throw new Error(`Coding Tools MCP 进程 ${state.nativePid} 未能完全退出，已保留运行时状态以避免误判。`);
      }
    }
    const pending = Array.isArray(state.nativeCleanupPending) ? [...state.nativeCleanupPending] : [];
    if (Number.isInteger(state.nativePid) && state.nativePid > 0 && state.nativeRuntimeRoot && state.nativeInstanceId) {
      const request = { root: state.nativeRuntimeRoot, pid: state.nativePid, launchId: state.nativeInstanceId };
      if (!pending.some((item) => item && item.root === request.root && item.pid === request.pid && item.launchId === request.launchId)) pending.push(request);
    }
    // Persist the recovery request before clearing the old process identity.
    updateJsonAtomic(stateFile(), (value) => ({
      ...value,
      nativeCleanupPending: pending,
      nativePid: null,
      nativeFingerprint: '',
      nativeWorkspace: '',
      nativePort: null,
      nativePermissionMode: '',
      nativeInstanceId: '',
      nativeSourceFingerprint: '',
      nativeRuntimeRoot: ''
    }));
    const remaining = await this.cleanupRuntimeRequests(pending);
    updateJsonAtomic(stateFile(), (value) => ({ ...value, nativeCleanupPending: remaining }));
    return alive;
  }

  async cleanupRuntimeRequests(requests) {
    const remaining = [];
    const expectedRoot = path.resolve(dataRoot(), 'runtime-workspace');
    for (const request of requests) {
      try {
        if (!request || typeof request.root !== 'string' || !path.isAbsolute(request.root)
          || path.resolve(request.root).toLowerCase() !== expectedRoot.toLowerCase()
          || !Number.isInteger(request.pid) || request.pid <= 0
          || typeof request.launchId !== 'string' || !/^[a-f0-9]{32}$/.test(request.launchId)) {
          throw new Error('运行时归档请求的路径或实例身份无法确认，已保留请求。');
        }
        if (isAlive(request.pid)) throw new Error('旧进程仍存活，临时目录保持不变。');
        const python = await pythonStatus();
        if (!python.installed) throw new Error('未找到可用于归档的 Python。');
        const { run } = require('./commandRunner');
        const bundle = path.join(runtimeResourcesRoot(), 'coding-tools-mcp');
        const result = await run(python.command, [
          ...(python.prefixArgs || []), '-B', '-m', 'coding_tools_mcp.runtime_cleanup',
          '--root', request.root, '--pid', String(request.pid), '--launch-id', request.launchId
        ], {
          timeoutMs: 10000, allowFailure: true,
          env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1', PYTHONIOENCODING: 'utf-8',
            PYTHONPATH: [path.join(bundle, 'python_vendor'), bundle].join(path.delimiter),
            CODING_TOOLS_MCP_TELEMETRY: 'off' }
        });
        const report = JSON.parse(result.stdout.trim());
        if (result.code !== 0 || report.ok !== true) {
          throw new Error(`运行时归档未完成：${JSON.stringify(report.errors || []).slice(0, 1600)}`);
        }
        if (report.warnings?.length) this.log.warn('运行时归档完成，但存在收尾警告', { request, warnings: report.warnings });
        if (report.archived?.length) this.log.info('已将旧运行时目录移入可恢复归档', { archived: report.archived });
      } catch (error) {
        remaining.push(request);
        this.log.warn('运行时目录归档失败，已保留待重试请求', { request, error: String(error.message || error) });
      }
    }
    return remaining;
  }

  async markWorkspace(settings) {
    updateJsonAtomic(stateFile(), (value) => ({
      ...value,
      nativeFingerprint: runtimeFingerprint(settings, runtimeSourceFingerprint(), path.resolve(dataRoot(), 'runtime-workspace')),
      nativeWorkspace: path.resolve(settings.workspace),
      nativePort: Number(settings.mcpPort),
      nativePermissionMode: settings.permissionMode,
      nativeToolMode: 'smart'
    }));
    return true;
  }

  async status(settings = null) {
    const state = readJson(stateFile(), {});
    if (!isAlive(state.nativePid)) return false;
    return !settings || state.nativeFingerprint === runtimeFingerprint(settings, runtimeSourceFingerprint(), path.resolve(dataRoot(), 'runtime-workspace'));
  }
}

module.exports = { NativeService, isAlive, runtimeFingerprint, runtimeSourceFingerprint, currentRuntimeState };
