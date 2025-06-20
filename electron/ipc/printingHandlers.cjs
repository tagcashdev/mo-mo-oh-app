/**
 * Enregistre les handlers IPC liés à la gestion des impressions (CardPrintings).
 * @param {import('electron').IpcMain} ipcMain
 * @param {Function} getDb
 */
function registerPrintingHandlers(ipcMain, getDb) {
  // Lier une impression à un artwork
  ipcMain.handle('update-printing-artwork-link', async (event, { printingId, targetAlternateArtworkId }) => {
    if (printingId === undefined) {
      return { success: false, message: 'ID de l\'impression manquant.' };
    }
    const db = getDb();
    try {
      const stmt = db.prepare(`UPDATE CardPrintings SET artwork_variant_id = ? WHERE id = ?`);
      const info = stmt.run(targetAlternateArtworkId, printingId);
      
      if (info.changes > 0) {
        return { success: true, message: `Impression mise à jour.` };
      } else {
        return { success: false, message: "Aucune mise à jour effectuée (impression non trouvée ou déjà correcte)." };
      }
    } catch (error) {
      console.error(`Erreur lors de la liaison de l'impression ID ${printingId}:`, error);
      return { success: false, message: `Erreur base de données: ${error.message}` };
    }
  });

  // Récupérer toutes les impressions pour la vue détaillée d'une carte
  ipcMain.handle('get-printings-for-card-details', async (event, cardId) => {
    if (!cardId) {
      console.error('[get-printings-for-card-details] Erreur: card_id non fourni.');
      return [];
    }

    const db = getDb();
    try {
      const sql = `
        SELECT
            cp.id as printing_id, s.id as set_id, c.card_type as card_type,
            c.id as card_id, c.name as card_name,
            s.set_name, s.set_code, cp.rarity, cp.edition, cp.language, cp.card_number_in_set,
            cp.artwork_variant_id as alternate_artwork_db_id, 
            COALESCE(
              cp.image_path_override, 
              (SELECT aa.artwork_image_path FROM AlternateArtworks aa WHERE aa.card_id = c.id AND aa.id = cp.artwork_variant_id LIMIT 1), 
              c.main_artwork_path
            ) as artwork_path,
            (SELECT COALESCE(SUM(uci.quantity), 0) FROM UserCollectionItems uci WHERE uci.card_printing_id = cp.id AND uci.collection_status = 'Owned') as owned_count_for_this_printing,
            (SELECT COALESCE(SUM(uci.quantity), 0) FROM UserCollectionItems uci WHERE uci.card_printing_id = cp.id AND uci.collection_status = 'Wanted') as wanted_count_for_this_printing,
            (SELECT COALESCE(SUM(uci.quantity), 0) FROM UserCollectionItems uci WHERE uci.card_printing_id = cp.id AND uci.collection_status = 'Trade') as trade_count_for_this_printing
        FROM CardPrintings cp
        JOIN Cards c ON cp.card_id = c.id
        JOIN Sets s ON cp.set_id = s.id
        WHERE cp.card_id = ?
        GROUP BY cp.id
        ORDER BY
            s.release_date_tcg_na DESC, 
            s.release_date_ocg DESC,
            s.set_name ASC,
            cp.card_number_in_set ASC,
            cp.rarity ASC;
      `;
      const stmt = db.prepare(sql);
      const printings = stmt.all(cardId);
      return printings.map(p => ({ ...p, owned_count_for_this_printing: p.owned_count_for_this_printing || 0 }));
    } catch (error) {
      console.error(`[get-printings-for-card-details] Erreur pour card_id ${cardId}:`, error);
      return [];
    }
  });

  // Créer une nouvelle impression
  ipcMain.handle('create-card-printing', async (event, printingData) => {
    const { card_id, set_code, set_name, card_number_in_set, rarity, language, edition, artwork_variant_id } = printingData;
    if (!card_id || !set_code || !card_number_in_set || !rarity) {
      return { success: false, message: 'Données manquantes pour créer l\'impression.' };
    }

    const db = getDb();
    try {
      let setId;
      const existingSet = db.prepare('SELECT id FROM Sets WHERE set_code = ?').get(set_code);
      if (existingSet) {
        setId = existingSet.id;
      } else {
        if (!set_name) return { success: false, message: 'Le nom du set est requis pour créer un nouveau set.' };
        const info = db.prepare('INSERT INTO Sets (set_name, set_code) VALUES (?, ?)').run(set_name, set_code);
        setId = info.lastInsertRowid;
      }

      const stmt = db.prepare(`INSERT INTO CardPrintings (card_id, set_id, card_number_in_set, rarity, language, edition, artwork_variant_id) VALUES (?, ?, ?, ?, ?, ?, ?)`);
      const info = stmt.run(card_id, setId, card_number_in_set, rarity, language, edition, artwork_variant_id);

      return { success: info.changes > 0, message: 'Impression créée avec succès.', newPrintingId: info.lastInsertRowid };
    } catch (error) {
      console.error('[IPC:create-card-printing] Erreur:', error);
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return { success: false, message: 'Cette impression (même set, numéro, rareté, etc.) existe déjà.' };
      }
      return { success: false, message: `Erreur de base de données: ${error.message}` };
    }
  });

  // Mettre à jour les détails d'une impression
  ipcMain.handle('update-card-printing', async (event, details) => {
    const { printing_id, set_id, card_number_in_set, rarity, language, edition } = details;
    if (!printing_id || !set_id || !card_number_in_set || !rarity) {
      return { success: false, message: 'Données de mise à jour de l\'impression incomplètes.' };
    }
    const db = getDb();
    try {
      const stmt = db.prepare(`
        UPDATE CardPrintings
        SET set_id = ?, card_number_in_set = ?, rarity = ?, language = ?, edition = ?
        WHERE id = ?
      `);
      const info = stmt.run(set_id, card_number_in_set, rarity, language, edition, printing_id);
      return { success: info.changes > 0, message: 'Impression mise à jour avec succès.' };
    } catch (error) {
      console.error(`[IPC:update-card-printing] Erreur pour printing_id ${printing_id}:`, error);
      return { success: false, message: `Erreur de base de données: ${error.message}` };
    }
  });

  // Supprimer une impression
  ipcMain.handle('delete-card-printing', async (event, printingId) => {
    if (!printingId) {
      return { success: false, message: 'ID de l\'impression manquant.' };
    }
    const db = getDb();
    try {
      // La contrainte ON DELETE CASCADE s'occupe de UserCollectionItems
      const stmt = db.prepare('DELETE FROM CardPrintings WHERE id = ?');
      const info = stmt.run(printingId);
      if (info.changes > 0) {
        return { success: true, message: 'Impression supprimée avec succès.' };
      } else {
        return { success: false, message: 'Aucune impression trouvée avec cet ID.' };
      }
    } catch (error) {
      console.error(`[IPC:delete-card-printing] Erreur pour printingId ${printingId}:`, error);
      return { success: false, message: `Erreur de base de données: ${error.message}` };
    }
  });
}

module.exports = { registerPrintingHandlers };
