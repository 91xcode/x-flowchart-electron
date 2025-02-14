// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  generateFlowchart: (prompt, isVertical) => ipcRenderer.invoke('generate-flowchart', { prompt, isVertical }),
  logError: (message, error) => ipcRenderer.send('log-error', { message, error }),
});
