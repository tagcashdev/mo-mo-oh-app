import require$$0 from "electron";
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var preload$1 = {};
var hasRequiredPreload;
function requirePreload() {
  if (hasRequiredPreload) return preload$1;
  hasRequiredPreload = 1;
  const { contextBridge, ipcRenderer } = require$$0;
  contextBridge.exposeInMainWorld("electronAPI", {
    // --- Galerie principale ---
    getCards: (args) => ipcRenderer.invoke("get-cards", args),
    getDistinctCardTypes: () => ipcRenderer.invoke("get-distinct-card-types"),
    // --- Vue détaillée ---
    getPrintingsForCardDetails: (cardId) => ipcRenderer.invoke("get-printings-for-card-details", cardId),
    getCollectionItemsForPrinting: (printingId) => ipcRenderer.invoke("get-collection-items-for-printing", printingId),
    // --- Actions sur une impression spécifique ---
    updatePrintingArtworkLink: (args) => ipcRenderer.invoke("update-printing-artwork-link", args),
    savePrintingCollectionDetails: (args) => ipcRenderer.invoke("save-printing-collection-details", args),
    createCardPrinting: (args) => ipcRenderer.invoke("create-card-printing", args),
    searchSets: (query) => ipcRenderer.invoke("search-sets", query),
    // NOUVEAUX HANDLERS POUR L'ÉDITION/SUPPRESSION D'IMPRESSIONS
    getAlternateArtworksForCard: (cardId) => ipcRenderer.invoke("get-alternate-artworks-for-card", cardId),
    updateCardPrinting: (details) => ipcRenderer.invoke("update-card-printing", details),
    deleteCardPrinting: (printingId) => ipcRenderer.invoke("delete-card-printing", printingId),
    // --- Importation ---
    importAllCards: () => ipcRenderer.invoke("import-all-cards"),
    onImportProgress: (callback) => {
      const handler = (_event, value) => callback(value);
      ipcRenderer.on("import-progress", handler);
      return () => ipcRenderer.removeListener("import-progress", handler);
    }
  });
  console.log("[Preload] electronAPI exposé sur window.");
  return preload$1;
}
var preloadExports = requirePreload();
const preload = /* @__PURE__ */ getDefaultExportFromCjs(preloadExports);
export {
  preload as default
};
