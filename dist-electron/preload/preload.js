import l from "electron";
function d(t) {
  return t && t.__esModule && Object.prototype.hasOwnProperty.call(t, "default") ? t.default : t;
}
var i = {}, s;
function p() {
  if (s) return i;
  s = 1;
  const { contextBridge: t, ipcRenderer: r } = l;
  return t.exposeInMainWorld("electronAPI", {
    // --- Galerie principale ---
    getCards: (e) => r.invoke("get-cards", e),
    getDistinctCardTypes: () => r.invoke("get-distinct-card-types"),
    // --- Vue détaillée ---
    getPrintingsForCardDetails: (e) => r.invoke("get-printings-for-card-details", e),
    getCollectionItemsForPrinting: (e) => r.invoke("get-collection-items-for-printing", e),
    // --- Actions sur une impression spécifique ---
    updatePrintingArtworkLink: (e) => r.invoke("update-printing-artwork-link", e),
    savePrintingCollectionDetails: (e) => r.invoke("save-printing-collection-details", e),
    createCardPrinting: (e) => r.invoke("create-card-printing", e),
    searchSets: (e) => r.invoke("search-sets", e),
    // NOUVEAUX HANDLERS POUR L'ÉDITION/SUPPRESSION D'IMPRESSIONS
    getAlternateArtworksForCard: (e) => r.invoke("get-alternate-artworks-for-card", e),
    updateCardPrinting: (e) => r.invoke("update-card-printing", e),
    deleteCardPrinting: (e) => r.invoke("delete-card-printing", e),
    // --- Importation ---
    importAllCards: () => r.invoke("import-all-cards"),
    importAllSetsAndPrintings: () => r.invoke("import-all-sets-and-printings"),
    getAllSets: (e) => r.invoke("get-all-sets", e),
    onImportProgress: (e) => {
      const n = (a, o) => e(o);
      return r.on("import-progress", n), () => r.removeListener("import-progress", n);
    },
    onSetImportProgress: (e) => {
      const n = (a, o) => e(o);
      return r.on("set-import-progress", n), () => r.removeListener("set-import-progress", n);
    }
  }), console.log("[Preload] electronAPI exposé sur window."), i;
}
var g = p();
const v = /* @__PURE__ */ d(g);
export {
  v as default
};
