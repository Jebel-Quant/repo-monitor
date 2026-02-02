const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  executeCommand: (command, basePath, repos) => ipcRenderer.invoke('execute-command', { command, basePath, repos }),
  executeCommandStreaming: (command, basePath, repos) => ipcRenderer.invoke('execute-command-streaming', { command, basePath, repos }),
  onCommandProgress: (callback) => {
    ipcRenderer.on('command-progress', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('command-progress');
  },
  onCommandResult: (callback) => {
    ipcRenderer.on('command-result', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('command-result');
  },
  getGitInfo: (basePath, repos) => ipcRenderer.invoke('get-git-info', { basePath, repos })
});
