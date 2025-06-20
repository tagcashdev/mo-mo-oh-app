const { importAllCardData } = require('../dataImporter.cjs');
const { registerCardHandlers } = require('./cardHandlers.cjs');
const { registerCollectionHandlers } = require('./collectionHandlers.cjs');
const { registerImportHandlers } = require('./importHandlers.cjs');
const { registerPrintingHandlers } = require('./printingHandlers.cjs');
const { registerSetHandlers } = require('./setHandlers.cjs');

/**
 * Initialise tous les handlers IPC de l'application.
 * @param {import('electron').IpcMain} ipcMain - L'instance ipcMain d'Electron.
 * @param {Function} getDb - La fonction pour obtenir une connexion à la base de données.
 * @param {import('electron').BrowserWindow} mainWindow - La fenêtre principale de l'application.
 */
function initializeIpcHandlers(ipcMain, getDb, mainWindow) {
  // Chaque module de handler enregistre ses propres listeners.
  // On leur passe les dépendances dont ils ont besoin.
  registerCardHandlers(ipcMain, getDb);
  registerPrintingHandlers(ipcMain, getDb);
  registerCollectionHandlers(ipcMain, getDb);
  registerSetHandlers(ipcMain, getDb);
  
  // Le handler d'importation a besoin de dépendances supplémentaires.
  registerImportHandlers(ipcMain, getDb, mainWindow, importAllCardData);
}

module.exports = { initializeIpcHandlers };
