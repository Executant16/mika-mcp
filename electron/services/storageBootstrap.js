const fs = require('node:fs');
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const { ProductionStorageService } = require('./productionStorageService');
const { productionStorageOptions, acquireProductionLock } = require('./dataDirectoryService');

function inspectBootstrap(app, env = process.env) {
  if (!app.isPackaged) return { needed: false };
  const options = productionStorageOptions(app, env);
  let storage;
  try {
    storage = new ProductionStorageService(options);
    if (storage.state.pending) return { needed: true, mode: 'progress', options, currentRoot: storage.status().currentRoot };
    storage.checkActive();
    return { needed: false };
  } catch (error) {
    return { needed: true, mode: 'recovery', options, currentRoot: storage ? storage.status().currentRoot : '', error: error.message };
  }
}

function shouldBootstrap() {
  return inspectBootstrap(require('electron').app).needed;
}

async function runBootstrap(electron = require('electron')) {
  const { app, BrowserWindow, dialog, ipcMain } = electron;
  const initial = inspectBootstrap(app);
  if (!initial.needed) throw new Error('启动恢复状态已变化，请重新启动 Mika。');
  // Do not lock the default profile: restoring default must rename that directory.
  if (!acquireProductionLock(app, initial.options)) { app.quit(); return; }
  // The recovery window must never open a Session in the real source/target.
  const scratchParent = path.join(app.getPath('appData'), 'Mika', 'storage-ui-runtime');
  let ancestor = scratchParent;
  for (;;) {
    if (fs.existsSync(ancestor)) {
      const stat = fs.lstatSync(ancestor);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('启动窗口临时路径包含链接或非目录。');
    }
    const parent = path.dirname(ancestor);
    if (parent === ancestor) break;
    ancestor = parent;
  }
  fs.mkdirSync(scratchParent, { recursive: true });
  const scratch = fs.mkdtempSync(path.join(scratchParent, 'session-'));
  app.setPath('userData', scratch); app.setPath('sessionData', scratch);
  app.setPath('temp', scratch); app.setPath('crashDumps', scratch);
  process.env.TEMP = process.env.TMP = process.env.TMPDIR = scratch;
  await app.whenReady();
  let window;
  let busy = false;
  let worker;
  let complete = false;
  let state = { mode: initial.mode, currentRoot: initial.currentRoot,
    locatorFile: initial.options.locatorFile, error: initial.error || '', progress: { phase: 'inventory', files: 0, bytes: 0 } };
  app.on('second-instance', () => { if (window && !window.isDestroyed()) { window.show(); window.focus(); } });
  const publish = (patch) => {
    state = { ...state, ...patch };
    if (window && !window.isDestroyed()) window.webContents.send('boot-storage:state', state);
  };
  let restartQueued = false;
  const relaunch = () => {
    if (restartQueued) return;
    restartQueued = true;
    app.relaunch(); app.quit();
  };
  const execute = (action, choice) => new Promise((resolve, reject) => {
    busy = true;
    publish({ mode: 'progress', error: '', progress: { phase: 'inventory', files: 0, bytes: 0 } });
    worker = new Worker(path.join(__dirname, 'storageBootstrapWorker.js'), { workerData: { options: initial.options, action, choice } });
    let received = false;
    worker.on('message', (message) => {
      if (message.type === 'progress' && message.progress.phase !== 'done') publish({ progress: message.progress });
      else if (message.type === 'result') {
        received = true; complete = true;
        publish({ currentRoot: message.status.currentRoot, error: message.status.error || '' });
      } else if (message.type === 'failure') {
        received = true; complete = false;
        publish({ mode: 'recovery', error: message.error });
      }
    });
    worker.once('error', (error) => { complete = false; publish({ mode: 'recovery', error: error.message }); });
    worker.once('exit', (code) => {
      busy = false; worker = null;
      if (!received || code !== 0) {
        complete = false;
        publish({ mode: 'recovery', error: state.error || `迁移线程异常退出（${code}），保留原数据，请重新定位。` });
      }
      if (complete) { publish({ progress: { ...state.progress, phase: 'done' } }); resolve(); }
      else reject(new Error(state.error));
    });
  });
  function handle(channel, action) {
    ipcMain.handle(channel, async (event, ...args) => {
      if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) {
        return { ok: false, error: '已阻止非启动窗口的请求。' };
      }
      try { return { ok: true, data: await action(...args) }; }
      catch (error) { return { ok: false, error: error.message }; }
    });
  }
  handle('boot-storage:status', () => state);
  handle('boot-storage:choose', async (kind) => {
    if (busy || complete) throw new Error('迁移正在进行或已完成，不能重新选择数据。');
    if (!['profile', 'memory'].includes(kind)) throw new Error('无效的目录类型。');
    const selected = await dialog.showOpenDialog(window, { title: kind === 'profile' ? '选择已有 Mika profile' : '选择已有长期记忆目录', properties: ['openDirectory'] });
    return selected.canceled ? null : selected.filePaths[0];
  });
  handle('boot-storage:recover', async (choice) => {
    if (busy || complete || state.mode !== 'recovery') throw new Error('当前不能提交恢复操作。');
    if (!choice || typeof choice !== 'object' || typeof choice.allowEmptyMemory !== 'boolean') throw new Error('恢复选择无效。');
    await execute('recover', { profile: choice.profile, memory: choice.memory, allowEmptyMemory: choice.allowEmptyMemory });
    setTimeout(relaunch, 300);
    return { restarting: true };
  });
  handle('boot-storage:restart', () => {
    if (busy || !complete) throw new Error('校验尚未成功，不能进入主程序。');
    setTimeout(relaunch, 100); return true;
  });
  handle('boot-storage:quit', () => {
    if (busy) throw new Error('正在复制或校验，完成前不能退出；强制退出会保留恢复现场。');
    app.quit(); return true;
  });
  window = new BrowserWindow({ width: 720, height: 640, minWidth: 560, minHeight: 480,
    title: 'Mika 数据目录恢复', show: false,
    icon: path.join(__dirname, '../app-icon.png'),
    webPreferences: { preload: path.join(__dirname, '../storageBootstrapPreload.js'),
      contextIsolation: true, sandbox: true, nodeIntegration: false, partition: 'mika-storage-bootstrap' } });
  window.setMenu(null);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.on('close', (event) => { if (busy) event.preventDefault(); });
  window.on('closed', () => { window = null; app.quit(); });
  await window.loadFile(path.join(__dirname, '../../renderer/storage-bootstrap.html'));
  window.show();
  if (initial.mode === 'progress') {
    try {
      await execute('migrate');
      // Failed migration with a usable source is explicitly shown before continuing.
      if (!state.error) relaunch();
    } catch { /* recovery window now owns the error; no normal stores are loaded */ }
  }
}

module.exports = { inspectBootstrap, shouldBootstrap, runBootstrap };
