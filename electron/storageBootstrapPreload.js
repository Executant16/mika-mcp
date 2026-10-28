const { contextBridge, ipcRenderer } = require('electron');

function unwrap(result) {
  if (!result || typeof result !== 'object' || typeof result.ok !== 'boolean') {
    throw new Error('启动恢复 IPC 返回格式无效');
  }
  if (!result.ok) {
    throw new Error(typeof result.error === 'string' && result.error ? result.error : '启动恢复操作失败');
  }
  return result.data;
}

function invoke(channel, ...args) {
  return ipcRenderer.invoke(channel, ...args).then(unwrap);
}

function assertDirectoryKind(kind) {
  if (kind !== 'profile' && kind !== 'memory') throw new TypeError('目录类型无效');
}

function assertRecoveryPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('恢复参数无效');
  }
  if (typeof payload.profile !== 'string' || !payload.profile.trim()) {
    throw new TypeError('必须选择已有配置目录');
  }
  if (payload.memory !== null && (typeof payload.memory !== 'string' || !payload.memory.trim())) {
    throw new TypeError('记忆目录必须是有效路径或 null');
  }
  if (typeof payload.allowEmptyMemory !== 'boolean') {
    throw new TypeError('必须明确确认是否允许新建空记忆目录');
  }
  if (payload.memory && payload.allowEmptyMemory) {
    throw new TypeError('现有记忆目录与新建空记忆目录不能同时选择');
  }
  if (!payload.memory && !payload.allowEmptyMemory) {
    throw new TypeError('选择记忆目录或确认允许新建空记忆子目录');
  }
}

contextBridge.exposeInMainWorld('storageBootstrap', {
  status: () => invoke('boot-storage:status'),
  choose: (kind) => {
    assertDirectoryKind(kind);
    return invoke('boot-storage:choose', kind);
  },
  recover: (payload) => {
    assertRecoveryPayload(payload);
    return invoke('boot-storage:recover', {
      profile: payload.profile,
      memory: payload.memory,
      allowEmptyMemory: payload.allowEmptyMemory
    });
  },
  restart: () => invoke('boot-storage:restart'),
  quit: () => invoke('boot-storage:quit'),
  onState: (callback) => {
    if (typeof callback !== 'function') throw new TypeError('状态订阅必须是函数');
    const wrapped = (_event, state) => callback(state);
    ipcRenderer.on('boot-storage:state', wrapped);
    return () => ipcRenderer.removeListener('boot-storage:state', wrapped);
  }
});
