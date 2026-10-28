const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const { ProductionStorageService } = require('./productionStorageService');

let productionStorage;
function getProductionStorage() { return productionStorage; }
// Both normal startup and recovery use this fixed identity outside movable profiles.
// Electron holds its Windows lockfile open until exit, even after setPath changes.
function acquireProductionLock(app, options) {
  const original = app.getPath('userData');
  const lockRoot = path.join(path.dirname(options.locatorFile), 'instance-lock');
  checkOrdinaryAncestors(lockRoot);
  fs.mkdirSync(lockRoot, { recursive: true });
  checkOrdinaryAncestors(lockRoot);
  app.setPath('userData', lockRoot);
  try { return app.requestSingleInstanceLock(); }
  finally { app.setPath('userData', original); }
}
function productionStorageOptions(app, env = process.env) {
  return {
    defaultRoot: app.getPath('userData'),
    locatorFile: path.join(app.getPath('appData'), 'Mika', 'storage', 'production.json'),
    legacyMemoryRoot: env.CODING_TOOLS_MCP_MEMORY_ROOT || path.join(env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Mika', 'memory-v1'),
    forbiddenRoots: [app.getAppPath(), path.dirname(app.getPath('exe'))]
  };
}

function canonicalKey(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isWithin(candidate, parent) {
  const relative = path.relative(canonicalKey(parent), canonicalKey(candidate));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function checkOrdinaryAncestors(target) {
  let current = path.resolve(target);
  while (true) {
    try {
      const stat = fs.lstatSync(current);
      // Node reports Windows directory junctions as symbolic links too.
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`路径包含链接或非目录：${current}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

function configureDataDirectories(app, { env = process.env } = {}) {
  const originalUserData = app.getPath('userData');
  if (app.isPackaged) {
    const options = productionStorageOptions(app, env);
    if (!acquireProductionLock(app, options)) throw new Error('正式版已有实例运行，已取消数据目录初始化。');
    productionStorage = new ProductionStorageService(options);
    return productionStorage.configure(app, env);
  }

  try {
    const repository = fs.realpathSync(app.getAppPath());
    const developmentBase = env.MIKA_DEVELOPMENT_DATA_ROOT ?? path.join(path.dirname(repository), 'Mika-Data', 'development');
    if (!path.isAbsolute(developmentBase)) throw new Error('MIKA_DEVELOPMENT_DATA_ROOT 必须是绝对路径。');
    const repositoryId = crypto.createHash('sha256').update(canonicalKey(repository)).digest('hex').slice(0, 16);
    const userData = path.resolve(developmentBase, repositoryId, 'profile');
    if (process.platform === 'win32' && path.parse(userData).root.toLowerCase() === 'c:\\') {
      throw new Error('开发数据不得写入 C 盘，请将源码或 MIKA_DEVELOPMENT_DATA_ROOT 放到其他盘。');
    }
    let originalCanonical = path.resolve(originalUserData);
    try { originalCanonical = fs.realpathSync(originalCanonical); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (isWithin(userData, repository) || isWithin(userData, originalCanonical) || isWithin(originalCanonical, userData)) {
      throw new Error('开发数据目录不得位于源码仓库内，也不得与原用户数据目录重叠。');
    }
    checkOrdinaryAncestors(userData);
    const temp = path.join(userData, 'tmp');
    const crashDumps = path.join(userData, 'crash-dumps');
    for (const directory of [temp, crashDumps]) {
      checkOrdinaryAncestors(directory);
      fs.mkdirSync(directory, { recursive: true });
      checkOrdinaryAncestors(directory);
    }
    fs.mkdirSync(userData, { recursive: true });
    checkOrdinaryAncestors(userData);
    const probe = path.join(userData, `.write-probe-${crypto.randomUUID()}`);
    const descriptor = fs.openSync(probe, 'wx', 0o600);
    try { fs.closeSync(descriptor); } finally { fs.unlinkSync(probe); }
    const memoryRoot = path.join(userData, 'memory-v1');
    app.setPath('userData', userData);
    app.setPath('sessionData', userData);
    app.setPath('temp', temp);
    app.setPath('crashDumps', crashDumps);
    // NativeService inherits this value; do not inherit production memory in dev.
    env.CODING_TOOLS_MCP_MEMORY_ROOT = memoryRoot;
    env.TEMP = temp;
    env.TMP = temp;
    env.TMPDIR = temp;
    return { channel: 'development', repositoryId, userData, sessionData: userData, memoryRoot, temp, crashDumps, changed: true };
  } catch (cause) {
    throw new Error(`开发版数据目录初始化失败，已停止启动，不会回退到正式数据目录：${cause.message}`, { cause });
  }
}

module.exports = { configureDataDirectories, getProductionStorage, productionStorageOptions, acquireProductionLock };
