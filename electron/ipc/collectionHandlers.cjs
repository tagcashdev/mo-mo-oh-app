/**
 * Enregistre les handlers IPC liés à la gestion de la collection de l'utilisateur.
 * @param {import('electron').IpcMain} ipcMain
 * @param {Function} getDb
 */
function registerCollectionHandlers(ipcMain, getDb) {
  // Récupérer les "lots" de collection pour une impression
  ipcMain.handle('get-collection-items-for-printing', async (event, printingId) => {
    if (!printingId) return [];
    const db = getDb();
    try {
      const stmt = db.prepare('SELECT * FROM UserCollectionItems WHERE card_printing_id = ? ORDER BY collection_status, id');
      return stmt.all(printingId);
    } catch (error) {
      console.error(`[IPC:get-collection-items-for-printing] Erreur pour printingId ${printingId}:`, error);
      return [];
    }
  });

  // Sauvegarder tous les lots d'une impression
  ipcMain.handle('save-printing-collection-details', async (event, { printingId, items }) => {
    if (!printingId || !Array.isArray(items)) {
      return { success: false, message: 'Données invalides.' };
    }
    const db = getDb();
    const saveTransaction = db.transaction(() => {
      const existingItemsStmt = db.prepare('SELECT id FROM UserCollectionItems WHERE card_printing_id = ?');
      const existingIds = new Set(existingItemsStmt.all(printingId).map(item => item.id));
      const itemIdsFromFrontend = new Set();

      for (const item of items) {
        if (item._to_delete) {
          if (item.id > 0) {
            db.prepare('DELETE FROM UserCollectionItems WHERE id = ?').run(item.id);
          }
          continue;
        }

        if (item.id > 0) { // UPDATE
          itemIdsFromFrontend.add(item.id);
          const stmt = db.prepare('UPDATE UserCollectionItems SET collection_status = @collection_status, quantity = @quantity, condition = @condition, storage_location = @storage_location, acquisition_date = @acquisition_date, acquisition_price = @acquisition_price, user_notes = @user_notes WHERE id = @id AND card_printing_id = @card_printing_id');
          stmt.run(item);
        } else { // INSERT
          const stmt = db.prepare('INSERT INTO UserCollectionItems (card_printing_id, collection_status, quantity, condition, storage_location, acquisition_date, acquisition_price, user_notes) VALUES (@card_printing_id, @collection_status, @quantity, @condition, @storage_location, @acquisition_date, @acquisition_price, @user_notes)');
          stmt.run(item);
        }
      }

      existingIds.forEach(id => {
        if (!itemIdsFromFrontend.has(id)) {
          db.prepare('DELETE FROM UserCollectionItems WHERE id = ?').run(id);
        }
      });
    });

    try {
      saveTransaction();
      return { success: true, message: 'Collection sauvegardée avec succès.' };
    } catch (error) {
      console.error(`[IPC:save-printing-collection-details] Erreur pour printingId ${printingId}:`, error);
      return { success: false, message: `Erreur de base de données: ${error.message}` };
    }
  });

  // Mettre à jour rapidement la quantité (+1 / -1)
  ipcMain.handle('update-printing-collection-quantity', async (event, { printingId, status, change }) => {
    if (printingId === undefined || !status || !['Owned', 'Wanted', 'Trade'].includes(status) || ![-1, 1].includes(change)) {
      return { success: false, message: 'Paramètres invalides.', newQuantity: 0 };
    }

    const db = getDb();
    try {
      let newQuantity = 0;
      const existingItem = db.prepare('SELECT id, quantity FROM UserCollectionItems WHERE card_printing_id = ? AND collection_status = ?').get(printingId, status);

      if (existingItem) {
        newQuantity = existingItem.quantity + change;
        if (newQuantity < 0) newQuantity = 0;

        if (newQuantity === 0 && status === 'Owned') {
          db.prepare('DELETE FROM UserCollectionItems WHERE id = ?').run(existingItem.id);
        } else {
          db.prepare('UPDATE UserCollectionItems SET quantity = ? WHERE id = ?').run(newQuantity, existingItem.id);
        }
      } else if (change > 0) {
        newQuantity = 1;
        db.prepare('INSERT INTO UserCollectionItems (card_printing_id, collection_status, quantity, condition) VALUES (?, ?, ?, ?)').run(printingId, status, newQuantity, status === 'Owned' ? 'Near Mint' : null);
      } else {
        return { success: true, newQuantity: 0 };
      }
      
      return { success: true, newQuantity };
    } catch (error) {
      console.error(`Erreur lors de la mise à jour de la quantité pour ${status} (printingId ${printingId}):`, error);
      return { success: false, message: `Erreur base de données: ${error.message}`, newQuantity: 0 };
    }
  });

  // Mettre à jour les détails d'un item spécifique (obsolète si save-printing-collection-details est utilisé, mais gardé)
  ipcMain.handle('update-user-collection-item-details', async (event, { printing_id, status, details }) => {
    const db = getDb();
    try {
      const item = db.prepare('SELECT id FROM UserCollectionItems WHERE card_printing_id = ? AND collection_status = ?').get(printing_id, status);
      if (!item) {
        return { success: false, message: 'Aucun item à mettre à jour. Changez d\'abord la quantité.' };
      }
      
      const stmt = db.prepare('UPDATE UserCollectionItems SET condition = @condition, storage_location = @storage_location, acquisition_date = @acquisition_date, acquisition_price = @acquisition_price, user_notes = @user_notes WHERE id = @itemId');
      const info = stmt.run({ ...details, itemId: item.id });
      
      return { success: info.changes > 0, message: info.changes > 0 ? 'Détails sauvegardés.' : 'Aucune modification détectée.' };
    } catch (error) {
      console.error(`Erreur lors de la mise à jour des détails pour printing_id ${printing_id}:`, error);
      return { success: false, message: error.message };
    }
  });
}

module.exports = { registerCollectionHandlers };
