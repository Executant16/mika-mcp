const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dropdownApi', {
  getData: () => ipcRenderer.invoke('dropdown:get-data'),
  onData: (listener) => {
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on('dropdown:data', wrapped);
    return () => ipcRenderer.removeListener('dropdown:data', wrapped);
  },
  switchWorkspace: (workspace) => ipcRenderer.invoke('dropdown:switch', workspace),
  removeWorkspace: (workspace) => ipcRenderer.invoke('workspace:remove', workspace),
  openSettings: () => ipcRenderer.invoke('dropdown:manage'),
  close: () => ipcRenderer.invoke('dropdown:close'),
  updateHeight: (height) => ipcRenderer.invoke('dropdown:height', height),
  notifyReady: (height) => ipcRenderer.invoke('dropdown:ready', height)
});
