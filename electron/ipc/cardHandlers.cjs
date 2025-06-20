/**
 * Enregistre les handlers IPC liés à la récupération des données de cartes.
 * @param {import('electron').IpcMain} ipcMain
 * @param {Function} getDb
 */
function registerCardHandlers(ipcMain, getDb) {
  // Handler pour récupérer les types de cartes distincts
  ipcMain.handle('get-distinct-card-types', async () => {
    const db = getDb();
    try {
      const stmt = db.prepare('SELECT DISTINCT card_type FROM Cards WHERE card_type IS NOT NULL ORDER BY card_type ASC');
      const types = stmt.all().map(row => row.card_type);
      return types;
    } catch (error) {
      console.error('Erreur lors de la récupération des types de cartes distincts:', error);
      return [];
    }
  });

  // Handler pour la galerie principale (liste d'artworks uniques)
  ipcMain.handle('get-cards', async (event, { page = 1, limit = 20, cardType = null, searchTerm = null }) => {
    const db = getDb();
    try {
      const offset = (page - 1) * limit;
      
      let paramsForWhere = []; 
      let whereClauses = [];

      const noFiltersActive = (!cardType || cardType === '') && (!searchTerm || searchTerm.trim() === '');

      if (cardType && cardType !== '') {
        whereClauses.push('c.card_type = ?');
        paramsForWhere.push(cardType);
      }
      if (searchTerm && searchTerm.trim() !== '') {
        whereClauses.push('(LOWER(c.name) LIKE LOWER(?) OR LOWER(COALESCE(c.french_name, \'\')) LIKE LOWER(?))');
        const likeSearchTerm = `%${searchTerm.trim()}%`;
        paramsForWhere.push(likeSearchTerm, likeSearchTerm);
      }
      const whereSqlForFilteredCards = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      const artworksCte = `
        WITH FilteredCards AS (
          SELECT * FROM Cards c ${whereSqlForFilteredCards}
        ),
        UniqueArtworks AS (
          SELECT 
            fc.id as card_id, fc.name, fc.french_name, fc.card_type, fc.attribute, fc.monster_race,
            fc.level_rank_linkval, fc.atk, fc.def, fc.scale, fc.description_text,
            fc.main_artwork_path as artwork_path,
            'main_' || fc.id || '_0' as unique_artwork_display_id, 
            (SELECT COALESCE(SUM(uci.quantity), 0) FROM CardPrintings cp_uci LEFT JOIN UserCollectionItems uci ON cp_uci.id = uci.card_printing_id AND uci.collection_status = 'Owned' WHERE cp_uci.card_id = fc.id AND cp_uci.artwork_variant_id IS NULL) as owned_count,
            (SELECT COALESCE(SUM(uci.quantity), 0) FROM CardPrintings cp_uci LEFT JOIN UserCollectionItems uci ON cp_uci.id = uci.card_printing_id AND uci.collection_status = 'Wanted' WHERE cp_uci.card_id = fc.id AND cp_uci.artwork_variant_id IS NULL) as wanted_count,
            (SELECT COALESCE(SUM(uci.quantity), 0) FROM CardPrintings cp_uci LEFT JOIN UserCollectionItems uci ON cp_uci.id = uci.card_printing_id AND uci.collection_status = 'Trade' WHERE cp_uci.card_id = fc.id AND cp_uci.artwork_variant_id IS NULL) as trade_count,
            NULL as alternate_artwork_db_id 
          FROM FilteredCards fc
          WHERE fc.main_artwork_path IS NOT NULL AND fc.main_artwork_path != ''
          
          UNION 

          SELECT 
            fc.id as card_id, fc.name, fc.french_name, fc.card_type, fc.attribute, fc.monster_race,
            fc.level_rank_linkval, fc.atk, fc.def, fc.scale, fc.description_text,
            aa.artwork_image_path as artwork_path,
            'alt_' || fc.id || '_' || aa.id as unique_artwork_display_id,
            (SELECT COALESCE(SUM(uci.quantity), 0) FROM CardPrintings cp_uci LEFT JOIN UserCollectionItems uci ON cp_uci.id = uci.card_printing_id AND uci.collection_status = 'Owned' WHERE cp_uci.card_id = fc.id AND cp_uci.artwork_variant_id = aa.id) as owned_count,
            (SELECT COALESCE(SUM(uci.quantity), 0) FROM CardPrintings cp_uci LEFT JOIN UserCollectionItems uci ON cp_uci.id = uci.card_printing_id AND uci.collection_status = 'Wanted' WHERE cp_uci.card_id = fc.id AND cp_uci.artwork_variant_id = aa.id) as wanted_count,
            (SELECT COALESCE(SUM(uci.quantity), 0) FROM CardPrintings cp_uci LEFT JOIN UserCollectionItems uci ON cp_uci.id = uci.card_printing_id AND uci.collection_status = 'Trade' WHERE cp_uci.card_id = fc.id AND cp_uci.artwork_variant_id = aa.id) as trade_count,
            aa.id as alternate_artwork_db_id
          FROM AlternateArtworks aa
          JOIN FilteredCards fc ON aa.card_id = fc.id
          WHERE aa.artwork_image_path IS NOT NULL AND aa.artwork_image_path != '' AND aa.release_order > 0
        )
      `;
      
      const totalResultStmt = db.prepare(`${artworksCte} SELECT COUNT(*) as count FROM UniqueArtworks ua`);
      const totalResult = totalResultStmt.get(...paramsForWhere); 
      const totalItems = totalResult.count;
      const totalPages = Math.ceil(totalItems / limit) || 1;

      const orderBySql = `
        ORDER BY
          CASE ua.card_type 
            WHEN 'Normal Monster' THEN 1 WHEN 'Normal Tuner Monster' THEN 2 WHEN 'Pendulum Normal Monster' THEN 3
            WHEN 'Ritual Monster' THEN 10 WHEN 'Ritual Effect Monster' THEN 11
            WHEN 'Flip Effect Monster' THEN 20 WHEN 'Toon Monster' THEN 21 WHEN 'Spirit Monster' THEN 22 WHEN 'Union Effect Monster' THEN 23 WHEN 'Gemini Monster' THEN 24 WHEN 'Tuner Monster' THEN 25 WHEN 'Pendulum Effect Monster' THEN 26 WHEN 'Pendulum Flip Effect Monster' THEN 27 WHEN 'Pendulum Tuner Effect Monster' THEN 28 WHEN 'Effect Monster' THEN 29
            WHEN 'Fusion Monster' THEN 100 WHEN 'Pendulum Effect Fusion Monster' THEN 101
            WHEN 'Synchro Monster' THEN 110 WHEN 'Synchro Tuner Monster' THEN 111 WHEN 'Synchro Pendulum Effect Monster' THEN 112
            WHEN 'XYZ Monster' THEN 120 WHEN 'XYZ Pendulum Effect Monster' THEN 121
            WHEN 'Link Monster' THEN 130
            WHEN 'Spell Card' THEN 200 WHEN 'Continuous Spell Card' THEN 201 WHEN 'Equip Spell Card' THEN 202 WHEN 'Field Spell Card' THEN 203 WHEN 'Quick-Play Spell Card' THEN 204 WHEN 'Ritual Spell Card' THEN 205
            WHEN 'Trap Card' THEN 300 WHEN 'Continuous Trap Card' THEN 301 WHEN 'Counter Trap Card' THEN 302
            WHEN 'Skill Card' THEN 400 WHEN 'Token' THEN 401
            ELSE 999
          END ASC,
          COALESCE(ua.level_rank_linkval, -1) DESC,
          CASE WHEN ua.atk = -1 THEN 9999 ELSE COALESCE(ua.atk, -2) END DESC, 
          CASE WHEN ua.card_type LIKE '%Link Monster%' THEN 2 WHEN ua.def = -1 THEN 0 WHEN ua.def IS NULL THEN 1 ELSE 1 END ASC,
          CASE WHEN ua.def = -1 THEN 9999 ELSE COALESCE(ua.def, -2) END DESC, 
          ua.name ASC,
          ua.artwork_path ASC 
      `;

      let finalParamsForData = [...paramsForWhere, limit, offset];
      const sql = `${artworksCte} SELECT * FROM UniqueArtworks ua ${orderBySql} LIMIT ? OFFSET ?`;
      
      const stmt = db.prepare(sql);
      const artworks = stmt.all(...finalParamsForData); 

      return {
        cards: artworks, 
        totalPages: totalPages,
        currentPage: page,
        totalCards: totalItems
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des artworks de cartes:', error);
      return { cards: [], totalPages: 1, currentPage: 1, totalCards: 0 };
    }
  });

  // Handler simple pour get-all-cards (gardé pour l'exemple)
  ipcMain.handle('get-all-cards', async () => {
    const db = getDb();
    try {
      const stmt = db.prepare('SELECT * FROM Cards LIMIT 50'); // Exemple
      const cards = stmt.all();
      return cards;
    } catch (error) {
      console.error('Erreur lors de la récupération des cartes:', error);
      return [];
    }
  });

  // Handler pour récupérer les artworks alternatifs
  ipcMain.handle('get-alternate-artworks-for-card', async (event, cardId) => {
    if (!cardId) return [];
    const db = getDb();
    try {
      const stmt = db.prepare('SELECT id, artwork_name FROM AlternateArtworks WHERE card_id = ? ORDER BY release_order, artwork_name');
      return stmt.all(cardId);
    } catch (error) {
      console.error(`[IPC:get-alternate-artworks-for-card] Erreur pour card_id ${cardId}:`, error);
      return [];
    }
  });
}

module.exports = { registerCardHandlers };
