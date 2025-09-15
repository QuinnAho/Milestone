const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script is running');

try {
  const listeners = {
    ai: null,
    console: null,
  };

  contextBridge.exposeInMainWorld('aidash', {
    initRepo: (path) => ipcRenderer.invoke('repo:init', path),
    createTask: (path, payload) => ipcRenderer.invoke('task:create', path, payload),
    switchTask: (path, idPath) => ipcRenderer.invoke('task:switch', path, idPath),
    changeTaskStatus: (path, taskId, status) => ipcRenderer.invoke('task:changeStatus', path, taskId, status),
    getBoard: (path) => ipcRenderer.invoke('board:get', path),
    getStatus: (path) => ipcRenderer.invoke('status:get', path),
    runProvider: (path, payload) => ipcRenderer.invoke('run:provider', path, payload),
    runProviderStreaming: (path, payload) => ipcRenderer.invoke('run:provider:streaming', path, payload),
    runQA: (path, scripts) => ipcRenderer.invoke('run:qa', path, scripts),
    openFolder: () => ipcRenderer.invoke('dialog:open-folder'),
    onAIOutput: (callback) => {
      if (listeners.ai) ipcRenderer.removeListener('ai:output', listeners.ai);
      listeners.ai = (_event, data) => callback(data);
      ipcRenderer.on('ai:output', listeners.ai);
    },
    removeAIOutputListener: () => {
      if (listeners.ai) ipcRenderer.removeListener('ai:output', listeners.ai);
      listeners.ai = null;
    },
    onConsoleOutput: (callback) => {
      if (listeners.console) ipcRenderer.removeListener('console:output', listeners.console);
      listeners.console = (_event, data) => callback(data);
      ipcRenderer.on('console:output', listeners.console);
    },
    removeConsoleOutputListener: () => {
      if (listeners.console) ipcRenderer.removeListener('console:output', listeners.console);
      listeners.console = null;
    },
    startProviderInteractive: (path, payload) => ipcRenderer.invoke('run:provider:interactive:start', path, payload),
    startProviderExternal: (path, payload) => ipcRenderer.invoke('run:provider:external', path, payload),
    procWrite: (sessionId, data) => ipcRenderer.invoke('proc:write', sessionId, data),
    procKill: (sessionId) => ipcRenderer.invoke('proc:kill', sessionId)
  });
  console.log('Successfully exposed aidash API');
} catch (error) {
  console.error('Failed to expose aidash API:', error);
}
