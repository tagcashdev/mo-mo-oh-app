const { BrowserWindow } = require('electron');

/**
 * Enregistre les handlers IPC liés à l'importation massive de données.
 * @param {import('electron').IpcMain} ipcMain
 * @param {Function} getDb
 * @param {import('electron').BrowserWindow} mainWindowRef - Référence à la fenêtre principale
 * @param {Function} importAllCardData - La fonction d'importation depuis dataImporter.cjs
 */
function registerImportHandlers(ipcMain, getDb, mainWindowRef, importAllCardData) {
  // Importer toutes les cartes
  ipcMain.handle('import-all-cards', async () => {
    if (!mainWindowRef) {
      console.error('La fenêtre principale n\'est pas disponible pour envoyer les messages de progression.');
      return { success: false, message: 'Fenêtre principale non disponible.' };
    }
    try {
      await importAllCardData(mainWindowRef); // Passer la référence de la fenêtre
      return { success: true, message: 'Importation terminée (vérifiez les logs pour les détails).' };
    } catch (error) {
      console.error('Échec de l\'appel à importAllCardData:', error);
      return { success: false, message: `Erreur d'importation: ${error.message}` };
    }
  });

  // Importer tous les sets et leurs impressions
  ipcMain.handle("import-all-sets-and-printings", async (event) => {
    const mainWindow = BrowserWindow.getFocusedWindow();
    const db = getDb();

    function sendProgress(message, progress = null, total = null) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("set-import-progress", { message, progress, total });
      }
      console.log(message);
    }

    sendProgress("Démarrage de l'importation des sets et impressions...");

    try {
      sendProgress("Récupération de la liste complète des sets...");
      const response = await fetch('https://db.ygoprodeck.com/api/v7/cardsets.php');
      if (!response.ok) throw new Error('Impossible de récupérer la liste des sets.');
      
      const allApiSets = await response.json();
      const totalApiSets = allApiSets.length;
      sendProgress(`Récupération de la liste complète des sets...`, 0, totalApiSets);

      const findSetStmt = db.prepare("SELECT id FROM Sets WHERE set_code = ? AND set_name = ?");
      const insertSetStmt = db.prepare("INSERT INTO Sets (set_name, set_code, release_date_tcg_na, total_cards, set_type) VALUES (@set_name, @set_code, @tcg_date, @num_of_cards, 'Unknown')");
      
      db.transaction(() => {
        for (const set of allApiSets) {
          const existingSet = findSetStmt.get(set.set_code, set.set_name);
          if (!existingSet) {
            insertSetStmt.run(set);
          }
        }
      })();
      sendProgress("Table 'Sets' mise à jour avec les nouvelles extensions.");

      let setsProcessed = 0;
      const findCardByApiIdStmt = db.prepare("SELECT id FROM Cards WHERE api_card_id = ?");
      const findPrintingStmt = db.prepare("SELECT id FROM CardPrintings WHERE card_id = ? AND set_id = ? AND card_number_in_set = ? AND rarity = ?");
      const insertPrintingStmt = db.prepare("INSERT INTO CardPrintings (card_id, set_id, card_number_in_set, rarity, language) VALUES (?, ?, ?, ?, 'EN')");

      for (const apiSet of allApiSets) {
        setsProcessed++;
        sendProgress(`Traitement : ${apiSet.set_name}`, setsProcessed, totalApiSets);
        
        const setInDb = findSetStmt.get(apiSet.set_code, apiSet.set_name);
        if (!setInDb) continue;

        try {
            const cardsInSetResponse = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?cardset=${encodeURIComponent(apiSet.set_name)}`);
            if (!cardsInSetResponse.ok) {
              sendProgress(`  -> Erreur HTTP ${cardsInSetResponse.status} pour ${apiSet.set_name}, on continue.`);
              continue;
            }
            const cardsData = await cardsInSetResponse.json();

            if (cardsData.data) {
              db.transaction(() => {
                for (const card of cardsData.data) {
                  const cardInDb = findCardByApiIdStmt.get(card.id);
                  if (cardInDb) {
                    const printingInfo = card.card_sets.find(s => s.set_name === apiSet.set_name);
                    if (printingInfo) {
                      const existingPrinting = findPrintingStmt.get(cardInDb.id, setInDb.id, printingInfo.set_code, printingInfo.set_rarity);
                      if (!existingPrinting) {
                        insertPrintingStmt.run(cardInDb.id, setInDb.id, printingInfo.set_code, printingInfo.set_rarity);
                      }
                    }
                  }
                }
              })();
            }
        } catch (fetchError) {
             sendProgress(`  -> Erreur réseau pour ${apiSet.set_name}: ${fetchError.message}, on continue.`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 50)); // Pause pour ne pas surcharger l'API
      }

      sendProgress("Importation de toutes les impressions terminée !");
      return { success: true, message: "Tous les sets et impressions ont été vérifiés et importés." };
    } catch (error) {
      console.error("Erreur majeure lors de l'importation des sets:", error);
      sendProgress(`Erreur critique d'importation : ${error.message}`);
      return { success: false, message: error.message };
    }
  });
}

module.exports = { registerImportHandlers };
