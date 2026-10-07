const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('healthApi', {
  getData: () => ipcRenderer.invoke('service-health:get-data'),
  onData: (listener) => {
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on('service-health:data', wrapped);
    return () => ipcRenderer.removeListener('service-health:data', wrapped);
  },
  startService: () => ipcRenderer.invoke('service-health:start'),
  restartService: () => ipcRenderer.invoke('service-health:restart'),
  openSettings: (page) => ipcRenderer.invoke('service-health:open-settings', page),
  close: () => ipcRenderer.invoke('service-health:close'),
  updateHeight: (height) => ipcRenderer.invoke('service-health:height', height)
});
