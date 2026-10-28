const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const key = (value) => process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);
function within(child, parent) {
  const relative = path.relative(key(parent), key(child));
  return !relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}
function ordinary(target) {
  let current = path.resolve(target);
  for (;;) {
    try {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`路径包含链接或非目录：${current}`);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = path.dirname(current);
    if (parent === current) return;
    current = parent;
  }
}
function hash(file) {
  const digest = crypto.createHash('sha256');
  const descriptor = fs.openSync(file, 'r');
  const buffer = Buffer.alloc(1024 * 1024);
  try {
    let count;
    while ((count = fs.readSync(descriptor, buffer, 0, buffer.length, null))) digest.update(buffer.subarray(0, count));
  } finally { fs.closeSync(descriptor); }
  return digest.digest('hex');
}
const excluded = new Set(['runtime-state.json', 'runtime-state.json.bak', 'runtime-workspace', 'SingletonLock', 'SingletonSocket', 'SingletonCookie', 'DevToolsActivePort']);

class ProductionStorageService {
  constructor({ defaultRoot, locatorFile, legacyMemoryRoot, forbiddenRoots = [], onProgress = () => {}, recovery = false }) {
    this.defaultRoot = path.resolve(defaultRoot);
    this.locatorFile = path.resolve(locatorFile);
    this.legacyMemoryRoot = path.resolve(legacyMemoryRoot);
    this.forbiddenRoots = forbiddenRoots.map((root) => path.resolve(root));
    this.plans = new Map();
    this.onProgress = onProgress;
    this.state = recovery ? { version: 1, defaultRoot: this.defaultRoot } : this.read();
  }
  read() {
    ordinary(path.dirname(this.locatorFile));
    if (!fs.existsSync(this.locatorFile)) return { version: 1, defaultRoot: this.defaultRoot };
    const stat = fs.lstatSync(this.locatorFile);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('数据目录定位配置不是普通文件。');
    const value = JSON.parse(fs.readFileSync(this.locatorFile, 'utf8'));
    if (value.version !== 1 || key(value.defaultRoot || '') !== key(this.defaultRoot)) throw new Error('数据目录定位配置身份不匹配。');
    for (const root of [value.activeRoot, value.memoryRoot].filter(Boolean)) {
      if (typeof root !== 'string' || !path.isAbsolute(root)) throw new Error('定位配置路径无效。');
    }
    if (Boolean(value.activeRoot) !== Boolean(value.memoryRoot)) throw new Error('数据目录定位配置不完整。');
    if (value.pending) {
      const pending = value.pending;
      if (!/^[a-f0-9-]{36}$/.test(pending.id || '') || !['queued', 'copying'].includes(pending.phase)
        || typeof pending.source !== 'string' || !path.isAbsolute(pending.source)
        || typeof pending.target !== 'string' || !path.isAbsolute(pending.target)
        || (pending.stage && pending.stage !== `${pending.target}.mika-stage-${pending.id}`)
        || (pending.displacedBackup && pending.displacedBackup !== `${pending.target}.before-switch-${pending.id}`)) {
        throw new Error('迁移定位配置无效，已停止启动，不会猜测数据位置。');
      }
    }
    return value;
  }
  write(value) {
    ordinary(path.dirname(this.locatorFile));
    fs.mkdirSync(path.dirname(this.locatorFile), { recursive: true });
    ordinary(path.dirname(this.locatorFile));
    const temporary = `${this.locatorFile}.${crypto.randomUUID()}.tmp`;
    const descriptor = fs.openSync(temporary, 'wx', 0o600);
    try { fs.writeFileSync(descriptor, JSON.stringify(value, null, 2)); fs.fsyncSync(descriptor); }
    finally { fs.closeSync(descriptor); }
    fs.renameSync(temporary, this.locatorFile);
    this.state = value;
  }
  status() {
    return { channel: 'production', currentRoot: this.state.activeRoot || this.defaultRoot,
      defaultRoot: this.defaultRoot, memoryRoot: this.state.memoryRoot || this.legacyMemoryRoot,
      locatorFile: this.locatorFile, error: this.state.error || '', canChange: !this.state.pending };
  }
  inventory({ verify = true, phase = 'inventory' } = {}) {
    const { currentRoot, memoryRoot } = this.status();
    const files = [];
    const directories = [];
    let bytes = 0;
    this.onProgress({ phase, files: 0, bytes: 0 });
    const walk = (root, prefix = '', omitRuntime = false) => {
      ordinary(root);
      if (!fs.existsSync(root)) return;
      const visit = (directory, relative = '') => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
          if (!relative && omitRuntime && excluded.has(entry.name)) continue;
          const source = path.join(directory, entry.name);
          const destination = path.join(prefix, relative, entry.name);
          const stat = fs.lstatSync(source);
          if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile()) || (stat.isFile() && stat.nlink > 1)) {
            throw new Error(`数据包含链接或特殊文件，停止迁移：${source}`);
          }
          if (stat.isDirectory()) { directories.push(destination); visit(source, path.join(relative, entry.name)); }
          else {
            files.push({ source, relative: destination, bytes: stat.size, hash: verify ? hash(source) : undefined });
            bytes += stat.size;
            this.onProgress({ phase, files: files.length, bytes });
          }
        }
      };
      visit(root);
    };
    walk(currentRoot, '', true);
    if (!within(memoryRoot, currentRoot)) {
      if (within(currentRoot, memoryRoot)) throw new Error('记忆根包含用户目录，无法安全迁移。');
      if (fs.existsSync(memoryRoot) && fs.existsSync(path.join(currentRoot, 'memory-v1'))) throw new Error('存在两套记忆目录，需先确认实际来源。');
      directories.push('memory-v1');
      walk(memoryRoot, 'memory-v1');
    } else if (key(memoryRoot) !== key(path.join(currentRoot, 'memory-v1'))) {
      throw new Error('记忆位于非标准 profile 子目录，需先确认迁移方式。');
    }
    files.sort((a, b) => a.relative.localeCompare(b.relative));
    return { files, directories: directories.sort() };
  }
  validateTarget(target) {
    if (typeof target !== 'string' || !path.isAbsolute(target)) throw new Error('请选择绝对数据目录。');
    target = path.resolve(target);
    if (key(target) === key(path.parse(target).root)) throw new Error('不能将磁盘根目录作为数据目录。');
    const { currentRoot, memoryRoot } = this.status();
    const settingsFile = path.join(currentRoot, 'settings.json');
    const settings = fs.existsSync(settingsFile) ? JSON.parse(fs.readFileSync(settingsFile, 'utf8')) : {};
    const workspaces = [settings.workspace, ...(settings.authorizedRoots || [])].filter((root) => typeof root === 'string' && path.isAbsolute(root));
    for (const root of [currentRoot, memoryRoot, path.dirname(this.locatorFile), ...this.forbiddenRoots, ...workspaces]) {
      if (within(target, root) || within(root, target)) throw new Error('新目录与当前数据、记忆、程序或工作区目录重叠。');
    }
    ordinary(target);
    const restoringDefault = key(target) === key(this.defaultRoot);
    if (fs.existsSync(target) && fs.readdirSync(target).length && !restoringDefault) throw new Error('目标目录非空，不能覆盖已有数据。');
    return { target, restoringDefault };
  }
  plan(target = null) {
    if (this.state.pending) throw new Error('已有迁移等待重启完成。');
    const checked = this.validateTarget(target === null ? this.defaultRoot : target);
    const inventory = this.inventory({ verify: false });
    const bytes = inventory.files.reduce((sum, file) => sum + file.bytes, 0);
    let ancestor = checked.target;
    while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
    fs.accessSync(ancestor, fs.constants.W_OK);
    const space = fs.statfsSync(ancestor);
    if (Number(space.bavail) * Number(space.bsize) < bytes + 16 * 1024 * 1024) throw new Error('目标磁盘可用空间不足。');
    const plan = { id: crypto.randomUUID(), source: this.status().currentRoot, ...checked,
      memorySource: this.status().memoryRoot, memoryExisted: fs.existsSync(this.status().memoryRoot),
      bytes, files: inventory.files.length };
    this.plans.clear(); this.plans.set(plan.id, plan);
    return plan;
  }
  planAsync(target = null) {
    // The settings window must remain responsive while enumerating large profiles.
    const { Worker } = require('node:worker_threads');
    return new Promise((resolve, reject) => {
      const worker = new Worker(path.join(__dirname, 'storageBootstrapWorker.js'), { workerData: {
        action: 'plan', target, options: { defaultRoot: this.defaultRoot, locatorFile: this.locatorFile,
          legacyMemoryRoot: this.legacyMemoryRoot, forbiddenRoots: this.forbiddenRoots }
      } });
      let result;
      let failure;
      worker.on('message', (message) => {
        if (message.type === 'plan') result = message.plan;
        if (message.type === 'failure') failure = message.error;
      });
      worker.once('error', reject);
      worker.once('exit', (code) => {
        try {
          if (code !== 0 || !result || failure) throw new Error(failure || `目录检查线程异常退出（${code}）。`);
          if (this.state.pending || key(result.source) !== key(this.status().currentRoot)) throw new Error('检查期间迁移状态已变化，请重新选择目录。');
          this.validateTarget(result.target);
          this.plans.clear(); this.plans.set(result.id, result);
          resolve(result);
        } catch (error) { reject(error); }
      });
    });
  }
  validatePlan(id) {
    const plan = this.plans.get(id);
    if (!plan || key(plan.source) !== key(this.status().currentRoot)) throw new Error('迁移计划已失效，请重新选择目录。');
    this.validateTarget(plan.target);
    return plan;
  }
  queue(id) {
    const plan = this.validatePlan(id);
    this.write({ ...this.state, error: '', pending: { ...plan, phase: 'queued' } });
    this.plans.clear();
  }
  assertStopped() {
    const filename = path.join(this.status().currentRoot, 'runtime-state.json');
    if (!fs.existsSync(filename)) return;
    const state = JSON.parse(fs.readFileSync(filename, 'utf8'));
    for (const pid of [state.nativePid, state.tunnelPid].filter(Number.isInteger)) {
      try { process.kill(pid, 0); }
      catch (error) { if (error.code === 'ESRCH') continue; throw error; }
      throw new Error('仍有旧 Runtime/Tunnel 进程，停止迁移；请先正常退出相关服务。');
    }
  }
  migratePending() {
    const pending = this.state.pending;
    if (!pending) return;
    try {
      if (pending.phase !== 'queued') throw new Error('上次迁移中断，原目录继续有效；保留目标和中间目录供恢复，请检查后重选空目录。');
      if (key(pending.source) !== key(this.status().currentRoot)) throw new Error('迁移来源已变化。');
      if (!fs.existsSync(pending.source)) throw new Error('原数据目录已不可用，未创建空目录代替原数据。');
      if (pending.memoryExisted && (!pending.memorySource || !fs.existsSync(pending.memorySource))) throw new Error('原记忆目录已不可用，未切换至空记忆。');
      this.assertStopped();
      const { target, restoringDefault } = this.validateTarget(pending.target);
      const stage = `${target}.mika-stage-${pending.id}`;
      if (fs.existsSync(stage)) throw new Error('迁移中间目录已存在，请人工检查。');
      const before = this.inventory();
      const bytes = before.files.reduce((sum, item) => sum + item.bytes, 0);
      let ancestor = target;
      while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
      const space = fs.statfsSync(ancestor);
      if (Number(space.bavail) * Number(space.bsize) < bytes + 16 * 1024 * 1024) throw new Error('重启后目标磁盘可用空间不足。');
      this.write({ ...this.state, pending: { ...pending, phase: 'copying', stage } });
      ordinary(path.dirname(stage));
      fs.mkdirSync(path.dirname(stage), { recursive: true });
      fs.mkdirSync(stage, { recursive: false });
      let copiedBytes = 0;
      let copiedFiles = 0;
      this.onProgress({ phase: 'copy', files: 0, bytes: 0, totalFiles: before.files.length, totalBytes: bytes });
      for (const directory of before.directories) fs.mkdirSync(path.join(stage, directory), { recursive: true });
      for (const file of before.files) {
        const output = path.join(stage, file.relative);
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.copyFileSync(file.source, output, fs.constants.COPYFILE_EXCL);
        if (hash(output) !== file.hash) throw new Error('目标文件内容校验失败，未切换数据目录。');
        copiedBytes += file.bytes;
        this.onProgress({ phase: 'copy', files: ++copiedFiles, bytes: copiedBytes, totalFiles: before.files.length, totalBytes: bytes });
      }
      const after = this.inventory({ phase: 'verify' });
      if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('复制期间来源发生变化，未切换目录。');
      for (const directory of ['memory-v1', 'tmp', 'crash-dumps']) {
        ordinary(path.join(stage, directory));
        fs.mkdirSync(path.join(stage, directory), { recursive: true });
      }
      ordinary(target);
      this.onProgress({ phase: 'commit', files: copiedFiles, bytes: copiedBytes, totalFiles: before.files.length, totalBytes: bytes });
      let displacedBackup;
      if (fs.existsSync(target)) {
        if (fs.readdirSync(target).length && !restoringDefault) throw new Error('复制期间目标目录出现其他数据。');
        // Even empty selected directories are preserved, never recursively deleted.
        displacedBackup = `${target}.before-switch-${pending.id}`;
        if (fs.existsSync(displacedBackup)) throw new Error('目标备份位置已存在。');
        this.write({ ...this.state, pending: { ...this.state.pending, displacedBackup } });
        fs.renameSync(target, displacedBackup);
      }
      fs.renameSync(stage, target);
      this.write({ version: 1, defaultRoot: this.defaultRoot, activeRoot: target,
        memoryRoot: path.join(target, 'memory-v1'), previousRoot: pending.source,
        displacedBackup, completedAt: new Date().toISOString(), error: '' });
      this.onProgress({ phase: 'done', files: copiedFiles, bytes: copiedBytes, totalFiles: before.files.length, totalBytes: bytes });
    } catch (error) {
      const interrupted = this.state.pending;
      // If restoring the default displaced the fallback source, put it back only
      // when it is still absent. No unknown/new directory is overwritten.
      if (interrupted?.displacedBackup && !fs.existsSync(interrupted.target) && fs.existsSync(interrupted.displacedBackup)) {
        fs.renameSync(interrupted.displacedBackup, interrupted.target);
      }
      this.write({ ...this.state, pending: undefined, failedMigration: interrupted,
        error: `迁移未完成，继续使用原目录：${error.message}` });
    }
  }
  checkActive() {
    if (this.state.error && (!fs.existsSync(this.status().currentRoot)
      || (this.state.failedMigration?.memoryExisted && !fs.existsSync(this.state.failedMigration.memorySource)))) {
      throw new Error(this.state.error);
    }
    if (!this.state.activeRoot) return;
    const { currentRoot, memoryRoot } = this.status();
    for (const root of [currentRoot, memoryRoot]) {
      ordinary(root);
      if (!fs.existsSync(root)) throw new Error(`已配置的数据目录不可用，不会回退：${root}`);
      fs.accessSync(root, fs.constants.R_OK | fs.constants.W_OK);
    }
    const hasSettings = ['settings.json', 'settings.json.bak'].some((name) => {
      try {
        const filename = path.join(currentRoot, name);
        const stat = fs.lstatSync(filename);
        if (!stat.isFile() || stat.isSymbolicLink()) return false;
        const value = JSON.parse(fs.readFileSync(filename, 'utf8'));
        return value && typeof value === 'object' && Number.isInteger(value.configVersion) && value.configVersion > 0;
      } catch { return false; }
    });
    if (!hasSettings) throw new Error('已选 profile 缺少有效配置，不能将空目录或损坏目录当作原数据。');
  }
  configure(app, env) {
    this.migratePending();
    this.checkActive();
    if (!this.state.activeRoot) return { channel: 'production', userData: this.defaultRoot, changed: false };
    const { currentRoot, memoryRoot } = this.status();
    for (const name of ['tmp', 'crash-dumps']) {
      ordinary(path.join(currentRoot, name));
      fs.mkdirSync(path.join(currentRoot, name), { recursive: true });
    }
    app.setPath('userData', currentRoot); app.setPath('sessionData', currentRoot);
    app.setPath('temp', path.join(currentRoot, 'tmp')); app.setPath('crashDumps', path.join(currentRoot, 'crash-dumps'));
    env.CODING_TOOLS_MCP_MEMORY_ROOT = memoryRoot;
    env.TEMP = env.TMP = env.TMPDIR = path.join(currentRoot, 'tmp');
    return { channel: 'production', userData: currentRoot, memoryRoot, changed: true };
  }
  recover({ profile, memory, allowEmptyMemory = false }) {
    if (typeof profile !== 'string' || !path.isAbsolute(profile)) throw new Error('请选择已有 profile 的绝对路径。');
    profile = path.resolve(profile);
    ordinary(profile);
    if (!fs.existsSync(profile) || key(profile) === key(path.parse(profile).root)) throw new Error('不能使用缺失或空白数据环境。');
    for (const root of [path.dirname(this.locatorFile), ...this.forbiddenRoots]) {
      if (within(profile, root) || within(root, profile)) throw new Error('所选 profile 与程序或定位配置目录重叠。');
    }
    const settingsFile = path.join(profile, 'settings.json');
    if (!fs.existsSync(settingsFile) || fs.lstatSync(settingsFile).isSymbolicLink()) throw new Error('所选目录不是已有的 Mika profile（缺少 settings.json）。');
    const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    if (!settings || typeof settings !== 'object' || !Number.isInteger(settings.configVersion) || settings.configVersion < 1) throw new Error('所选目录缺少有效的 Mika 配置身份。');
    const memoryRoot = memory ? path.resolve(memory) : path.join(profile, 'memory-v1');
    if (memory && !path.isAbsolute(memory)) throw new Error('记忆目录必须是绝对路径。');
    ordinary(memoryRoot);
    if (!fs.existsSync(memoryRoot) && (!allowEmptyMemory || memory || key(memoryRoot) !== key(path.join(profile, 'memory-v1')))) {
      throw new Error('记忆目录不存在，请选回已有记忆目录，或明确确认该 profile 原本没有长期记忆。');
    }
    const explicitlyEmpty = allowEmptyMemory && !memory && fs.existsSync(memoryRoot) && fs.readdirSync(memoryRoot).length === 0;
    if (fs.existsSync(memoryRoot) && !explicitlyEmpty && !fs.existsSync(path.join(memoryRoot, 'config.json')) && !fs.existsSync(path.join(memoryRoot, 'memory.db')) && !fs.existsSync(path.join(memoryRoot, 'system'))) {
      throw new Error('所选记忆目录缺少可识别的记忆数据。');
    }
    this.state = { version: 1, defaultRoot: this.defaultRoot, activeRoot: profile, memoryRoot };
    this.assertStopped();
    this.inventory({ verify: false });
    let recoveryBackup;
    ordinary(path.dirname(this.locatorFile));
    if (fs.existsSync(this.locatorFile)) {
      const stat = fs.lstatSync(this.locatorFile);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('定位文件不是普通文件，不能安全备份。');
      recoveryBackup = `${this.locatorFile}.recovery-backup-${crypto.randomUUID()}`;
      fs.copyFileSync(this.locatorFile, recoveryBackup, fs.constants.COPYFILE_EXCL);
    }
    if (!fs.existsSync(memoryRoot)) fs.mkdirSync(memoryRoot);
    fs.accessSync(profile, fs.constants.R_OK | fs.constants.W_OK);
    fs.accessSync(memoryRoot, fs.constants.R_OK | fs.constants.W_OK);
    this.write({ ...this.state, recoveryBackup, recoveredAt: new Date().toISOString(), error: '' });
    return this.status();
  }
}

module.exports = { ProductionStorageService };
