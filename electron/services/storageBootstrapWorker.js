const { parentPort, workerData } = require('node:worker_threads');
const { ProductionStorageService } = require('./productionStorageService');

try {
  const storage = new ProductionStorageService({ ...workerData.options,
    recovery: workerData.action === 'recover',
    onProgress: workerData.action === 'plan' ? () => {} : (progress) => parentPort.postMessage({ type: 'progress', progress }) });
  if (workerData.action === 'plan') parentPort.postMessage({ type: 'plan', plan: storage.plan(workerData.target) });
  else {
    if (workerData.action === 'recover') storage.recover(workerData.choice);
    else if (workerData.action === 'migrate') storage.migratePending();
    else throw new Error('无效的存储后台任务。');
    storage.checkActive();
    parentPort.postMessage({ type: 'result', status: storage.status() });
  }
} catch (error) {
  parentPort.postMessage({ type: 'failure', error: error.message });
}
