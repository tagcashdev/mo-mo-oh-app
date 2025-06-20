const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

const { initDatabase, getDb } = require('./database.cjs');
const { initializeIpcHandlers } = require('./ipc/index.cjs'); // <- NOUVELLE LIGNE

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const loadURL = isDev
    ? 'http://localhost:5173' // Le port par défaut de Vite
    : `file://${path.join(__dirname, '../dist/index.html')}`;

  mainWindow.loadURL(loadURL);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  console.log('[Main] Chemin userData:', app.getPath('userData'));

  // Enregistrement du protocole custom pour les images locales
  protocol.registerFileProtocol('appimg', (request, callback) => {
    try {
      const url = request.url.substr('appimg://'.length).replace(/\\/g, '/');
      const imagePath = path.join(app.getPath('userData'), url);
      require('fs').access(imagePath, require('fs').constants.F_OK, (err) => {
        if (err) {
          callback({ error: -6 }); // File not found
        } else {
          callback({ path: imagePath });
        }
      });
    } catch (error) {
      console.error('[appimg] Erreur:', error, request.url);
      callback({ error: -2 }); // Generic error
    }
  });

  // Initialisation de la base de données
  initDatabase();

  // Création de la fenêtre principale
  createWindow();

  // Initialisation de tous les handlers IPC
  initializeIpcHandlers(ipcMain, getDb, mainWindow); // <- NOUVELLE LIGNE

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});