// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

// 在渲染进程中暴露 API
contextBridge.exposeInMainWorld('electronAPI', {
  generateFlowchart: (prompt, isVertical) => ipcRenderer.invoke('generate-flowchart', { prompt, isVertical }),
  logError: (message, error) => ipcRenderer.send('log-error', { message, error }),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  toggleDevTools: () => ipcRenderer.invoke('toggle-devtools'),
  isDevToolsOpened: () => ipcRenderer.invoke('is-devtools-opened'),
  getExampleText: () => ipcRenderer.invoke('get-example-text'),
});
