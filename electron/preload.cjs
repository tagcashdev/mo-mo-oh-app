// electron/preload.cjs
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // --- Galerie principale ---
  getCards: (args) => ipcRenderer.invoke('get-cards', args),
  getDistinctCardTypes: () => ipcRenderer.invoke('get-distinct-card-types'),
  
  // --- Vue détaillée ---
  getPrintingsForCardDetails: (cardId) => ipcRenderer.invoke('get-printings-for-card-details', cardId),
  getCollectionItemsForPrinting: (printingId) => ipcRenderer.invoke('get-collection-items-for-printing', printingId),

  // --- Actions sur une impression spécifique ---
  updatePrintingArtworkLink: (args) => ipcRenderer.invoke('update-printing-artwork-link', args),
  savePrintingCollectionDetails: (args) => ipcRenderer.invoke('save-printing-collection-details', args),
  createCardPrinting: (args) => ipcRenderer.invoke('create-card-printing', args),
  searchSets: (query) => ipcRenderer.invoke('search-sets', query),
  
  // NOUVEAUX HANDLERS POUR L'ÉDITION/SUPPRESSION D'IMPRESSIONS
  getAlternateArtworksForCard: (cardId) => ipcRenderer.invoke('get-alternate-artworks-for-card', cardId),
  updateCardPrinting: (details) => ipcRenderer.invoke('update-card-printing', details),
  deleteCardPrinting: (printingId) => ipcRenderer.invoke('delete-card-printing', printingId),


  // --- Importation ---
  importAllCards: () => ipcRenderer.invoke('import-all-cards'),
  importAllSetsAndPrintings: () => ipcRenderer.invoke("import-all-sets-and-printings"),
  getAllSets: (params) => ipcRenderer.invoke("get-all-sets", params),
  onImportProgress: (callback) => {
    const handler = (_event, value) => callback(value);
    ipcRenderer.on('import-progress', handler);
    return () => ipcRenderer.removeListener('import-progress', handler);
  },

  onSetImportProgress: (callback) => {
    const handler = (_event, value) => callback(value);
    ipcRenderer.on('set-import-progress', handler);
    return () => ipcRenderer.removeListener('set-import-progress', handler);
  }
});

console.log('[Preload] electronAPI exposé sur window.');