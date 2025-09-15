import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import url from 'url';
import fs from 'fs';
import { fileURLToPath } from 'url';

console.log('Starting main process...');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isDev() {
  return process.env.NODE_ENV !== 'production';
}

let mainWindow;
async function createWindow() {
  console.log('Creating window...');
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('Preload script path:', preloadPath);
  console.log('Preload script exists:', fs.existsSync(preloadPath));

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // Allow for development
      enableRemoteModule: false
    }
  });

  // Open DevTools in development
  if (isDev()) {
    mainWindow.webContents.openDevTools();
  }

  if (isDev()) {
    console.log('Loading development URL...');
    // Vite dev server port must match renderer/vite.config.js
    await mainWindow.loadURL('http://localhost:5173');
  } else {
    console.log('Loading production file...');
    await mainWindow.loadFile(path.join(__dirname, '../renderer/dist/index.html'));
  }
  console.log('Window loaded successfully');
}

app.whenReady().then(createWindow).catch(err => {
  console.error('Failed to create window:', err);
  process.exit(1);
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', async () => { if (BrowserWindow.getAllWindows().length === 0) await createWindow(); });

// Broadcast main-process console to renderer
function attachConsoleForwarding() {
  const levels = ['log', 'info', 'warn', 'error'];
  levels.forEach((level) => {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      try {
        original(...args);
        const payload = {
          level,
          message: args
            .map((a) => {
              if (a instanceof Error) return `${a.name}: ${a.message}`;
              try { return typeof a === 'string' ? a : JSON.stringify(a); } catch { return String(a); }
            })
            .join(' '),
          timestamp: new Date().toISOString()
        };
        if (mainWindow?.webContents) {
          mainWindow.webContents.send('console:output', payload);
        }
      } catch (e) {
        original('Failed to forward console output', e);
      }
    };
  });
}

attachConsoleForwarding();

// Load API module dynamically
let api = null;

async function loadAPI() {
  try {
    console.log('Loading API module...');
    api = await import('../src/engine/api.js');
    console.log('API module loaded successfully');
  } catch (err) {
    console.error('Failed to load API module:', err);
    return false;
  }
  return true;
}

// IPC handlers
ipcMain.handle('repo:init', async (_e, repoPath) => {
  if (!api) await loadAPI();
  return api.initRepo(repoPath);
});
ipcMain.handle('task:create', async (_e, repoPath, payload) => {
  if (!api) await loadAPI();
  return api.createTask(repoPath, payload);
});
ipcMain.handle('task:switch', async (_e, repoPath, idPath) => {
  if (!api) await loadAPI();
  return api.switchTask(repoPath, idPath);
});
ipcMain.handle('board:get', async (_e, repoPath) => {
  if (!api) await loadAPI();
  return api.computeBoardState(repoPath);
});
ipcMain.handle('status:get', async (_e, repoPath) => {
  if (!api) await loadAPI();
  return api.computeProjectStatus(repoPath);
});
ipcMain.handle('run:provider', async (event, repoPath, payload) => {
  if (!api) await loadAPI();
  // Redirect legacy call to interactive provider start for real CLI runs
  return api.startProviderInteractive(repoPath, payload, (output) => {
    event.sender.send('ai:output', output);
  });
});
ipcMain.handle('run:qa', async (_e, repoPath, scripts) => {
  if (!api) await loadAPI();
  return api.runQA(repoPath, scripts);
});
ipcMain.handle('task:changeStatus', async (_e, repoPath, taskId, status) => {
  if (!api) await loadAPI();
  return api.changeTaskStatus(repoPath, taskId, status);
});
ipcMain.handle('run:provider:streaming', async (event, repoPath, payload) => {
  if (!api) await loadAPI();
  return api.runProviderStreaming(repoPath, payload, (output) => {
    event.sender.send('ai:output', output);
  });
});

ipcMain.handle('run:provider:interactive:start', async (event, repoPath, payload) => {
  if (!api) await loadAPI();
  return api.startProviderInteractive(repoPath, payload, (output) => {
    event.sender.send('ai:output', output);
  });
});

ipcMain.handle('proc:write', async (_e, sessionId, data) => {
  if (!api) await loadAPI();
  return api.procWrite(sessionId, data);
});

ipcMain.handle('proc:kill', async (_e, sessionId) => {
  if (!api) await loadAPI();
  return api.procKill(sessionId);
});

ipcMain.handle('run:provider:external', async (_e, repoPath, payload) => {
  if (!api) await loadAPI();
  return api.startProviderExternal(repoPath, payload);
});

// Milestone management handlers
ipcMain.handle('milestone:pack', async (_e, repoPath, payload) => {
  if (!api) await loadAPI();
  return api.packMilestone(repoPath, payload);
});

ipcMain.handle('milestone:getAvailable', async (_e, repoPath) => {
  if (!api) await loadAPI();
  return api.getAvailableMilestones(repoPath);
});

ipcMain.handle('milestone:load', async (_e, repoPath, milestoneName) => {
  if (!api) await loadAPI();
  return api.loadMilestone(repoPath, milestoneName);
});

// Folder picker dialog
ipcMain.handle('dialog:open-folder', async () => {
  console.log('Folder picker dialog requested');
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Repository Folder'
    });

    console.log('Dialog result:', result);

    if (!result.canceled && result.filePaths.length > 0) {
      console.log('Selected folder:', result.filePaths[0]);
      return result.filePaths[0];
    }
    console.log('No folder selected or dialog was canceled');
    return null;
  } catch (error) {
    console.error('Error in folder picker dialog:', error);
    throw error;
  }
});
