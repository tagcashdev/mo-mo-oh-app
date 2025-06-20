/**
 * Enregistre les handlers IPC liés à la gestion des Sets.
 * @param {import('electron').IpcMain} ipcMain
 * @param {Function} getDb
 */
function registerSetHandlers(ipcMain, getDb) {
  // Rechercher un set par nom ou code
  ipcMain.handle('search-sets', async (event, query) => {
    if (!query) return [];
    const db = getDb();
    try {
      const stmt = db.prepare(`
        SELECT id, set_name, set_code 
        FROM Sets 
        WHERE set_name LIKE ? OR set_code LIKE ? 
        ORDER BY release_date_tcg_na DESC, set_name ASC 
        LIMIT 10
      `);
      return stmt.all(`%${query}%`, `%${query}%`);
    } catch (error) {
      console.error('[IPC:search-sets] Erreur:', error);
      return [];
    }
  });

  // Récupérer tous les sets paginés
  ipcMain.handle("get-all-sets", async (event, { page = 1, limit = 20 } = {}) => {
    const db = getDb();
    try {
      const offset = (page - 1) * limit;
      const totalStmt = db.prepare(`SELECT COUNT(*) as total FROM Sets WHERE set_type <> 'hidden'`);
      const totalResult = totalStmt.get();
      const totalSets = totalResult.total;
      
      const stmt = db.prepare(`
        SELECT 
          s.*, 
          (SELECT COUNT(*) FROM CardPrintings cp WHERE cp.set_id = s.id) as card_count
        FROM Sets s 
        WHERE set_type <> 'hidden'
        ORDER BY s.release_date_tcg_na ASC, s.set_name ASC
        LIMIT ? OFFSET ?
      `);
      const sets = stmt.all(limit, offset);

      return { success: true, data: { sets: sets, total: totalSets } };
    } catch (error) {
      console.error("[get-all-sets] Erreur:", error);
      return { success: false, message: error.message, data: { sets: [], total: 0 } };
    }
  });
}

module.exports = { registerSetHandlers };
