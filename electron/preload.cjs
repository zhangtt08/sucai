const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  search: (params) => ipcRenderer.invoke('search', params),
  download: (item, destDir, taskId) => ipcRenderer.invoke('download', { item, destDir, taskId }),
  onDownloadProgress: (cb) => {
    const h = (_e, d) => cb(d);
    ipcRenderer.on('download-progress', h);
    return () => ipcRenderer.removeListener('download-progress', h);
  },
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (s) => ipcRenderer.invoke('save-settings', s),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getPlugins: () => ipcRenderer.invoke('get-plugins'),
  openInFolder: (fp) => ipcRenderer.invoke('open-in-folder', fp),
});
