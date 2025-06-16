const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const { initDatabase, getDb } = require('./database.cjs');
const { importAllCardData } = require('./dataImporter.cjs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}
app.whenReady().then(() => {
  console.log('[Main] Chemin userData:', app.getPath('userData'));

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

  initDatabase();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// --- HANDLERS IPC ---

// Importation...
ipcMain.handle('import-all-cards', async () => {
  if (!mainWindow) {
    console.error('La fenêtre principale n\'est pas disponible pour envoyer les messages de progression.');
    return { success: false, message: 'Fenêtre principale non disponible.' };
  }
  try {
    await importAllCardData(mainWindow); // Passer la référence de la fenêtre
    return { success: true, message: 'Importation terminée (vérifiez les logs pour les détails).' };
  } catch (error) {
    console.error('Échec de l\'appel à importAllCardData:', error);
    return { success: false, message: `Erreur d'importation: ${error.message}` };
  }
});
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
ipcMain.handle('update-printing-artwork-link', async (event, { printingId, targetAlternateArtworkId }) => {
  if (printingId === undefined) { // Vérifier printingId
    return { success: false, message: 'ID de l\'impression manquant.' };
  }
  const db = getDb();
  try {
    // Si targetAlternateArtworkId est null, on lie à l'artwork principal (artwork_variant_id = NULL).
    // Si targetAlternateArtworkId est un ID, on lie à cet artwork alternatif.
    // On met aussi image_path_override à NULL car on définit un artwork de référence.
    const stmt = db.prepare(`
      UPDATE CardPrintings 
      SET 
        artwork_variant_id = ?
      WHERE id = ?
    `);
    
    const info = stmt.run(targetAlternateArtworkId, printingId);
    
    if (info.changes > 0) {
      console.log(`[update-printing-artwork-link] Impression ID ${printingId} liée à l'artwork_variant_id: ${targetAlternateArtworkId}`);
      return { success: true, message: `Impression mise à jour.` };
    } else {
      console.log(`[update-printing-artwork-link] Aucune mise à jour pour l'impression ID ${printingId} (peut-être déjà correcte ou ID non trouvé).`);
      return { success: false, message: "Aucune mise à jour effectuée (impression non trouvée ou déjà correcte)." };
    }
  } catch (error) {
    console.error(`Erreur lors de la liaison de l'impression ID ${printingId}:`, error);
    return { success: false, message: `Erreur base de données: ${error.message}` };
  }
});


// Handler pour la galerie principale (liste d'artworks uniques)
ipcMain.handle('get-cards', async (event, { page = 1, limit = 20, cardType = null, searchTerm = null }) => {
  const db = getDb();
  try {
    const offset = (page - 1) * limit;
    
    let paramsForWhere = []; 
    let whereClauses = [];

    // Définition de noFiltersActive
    const noFiltersActive = (!cardType || cardType === '') && (!searchTerm || searchTerm.trim() === '');

    // Construction de la clause WHERE pour les filtres (s'applique aux données de la carte 'c' dans FilteredCards)
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
          fc.id as card_id, 
          fc.name, fc.french_name, fc.card_type, fc.attribute, fc.monster_race,
          fc.level_rank_linkval, fc.atk, fc.def, fc.scale, fc.description_text,
          fc.main_artwork_path as artwork_path,
          'main_' || fc.id || '_0' as unique_artwork_display_id, 
          (SELECT COALESCE(SUM(uci.quantity), 0)
            FROM CardPrintings cp_uci
            LEFT JOIN UserCollectionItems uci ON cp_uci.id = uci.card_printing_id AND uci.collection_status = 'Owned'
            WHERE cp_uci.card_id = fc.id
            and cp_uci.artwork_variant_id is NULL
          ) as owned_count,
          (SELECT COALESCE(SUM(uci.quantity), 0)
            FROM CardPrintings cp_uci
            LEFT JOIN UserCollectionItems uci ON cp_uci.id = uci.card_printing_id AND uci.collection_status = 'Wanted'
            WHERE cp_uci.card_id = fc.id
            and cp_uci.artwork_variant_id is NULL
          ) as wanted_count,
          (SELECT COALESCE(SUM(uci.quantity), 0)
            FROM CardPrintings cp_uci
            LEFT JOIN UserCollectionItems uci ON cp_uci.id = uci.card_printing_id AND uci.collection_status = 'Trade'
            WHERE cp_uci.card_id = fc.id
            and cp_uci.artwork_variant_id is NULL
          ) as trade_count,
          NULL as alternate_artwork_db_id 
        FROM FilteredCards fc
        WHERE fc.main_artwork_path IS NOT NULL AND fc.main_artwork_path != ''
        
        UNION 

        SELECT 
          fc.id as card_id, 
          fc.name, fc.french_name, fc.card_type, fc.attribute, fc.monster_race,
          fc.level_rank_linkval, fc.atk, fc.def, fc.scale, fc.description_text,
          aa.artwork_image_path as artwork_path,
          'alt_' || fc.id || '_' || aa.id as unique_artwork_display_id,
          (SELECT COALESCE(SUM(uci.quantity), 0)
            FROM CardPrintings cp_uci
            LEFT JOIN UserCollectionItems uci ON cp_uci.id = uci.card_printing_id AND uci.collection_status = 'Owned'
            WHERE cp_uci.card_id = fc.id
            and cp_uci.artwork_variant_id = aa.id
          ) as owned_count,
          (SELECT COALESCE(SUM(uci.quantity), 0)
            FROM CardPrintings cp_uci
            LEFT JOIN UserCollectionItems uci ON cp_uci.id = uci.card_printing_id AND uci.collection_status = 'Wanted'
            WHERE cp_uci.card_id = fc.id
            and cp_uci.artwork_variant_id = aa.id
          ) as wanted_count,
          (SELECT COALESCE(SUM(uci.quantity), 0)
            FROM CardPrintings cp_uci
            LEFT JOIN UserCollectionItems uci ON cp_uci.id = uci.card_printing_id AND uci.collection_status = 'Trade'
            WHERE cp_uci.card_id = fc.id
            and cp_uci.artwork_variant_id = aa.id
          ) as trade_count,
          aa.id as alternate_artwork_db_id
        FROM AlternateArtworks aa
        JOIN FilteredCards fc ON aa.card_id = fc.id
        WHERE aa.artwork_image_path IS NOT NULL AND aa.artwork_image_path != ''
        and aa.release_order > 0
      )
    `;

    console.log('[get-cards] Filtres reçus:', { page, limit, cardType, searchTerm });
    console.log('[get-cards] whereSqlForFilteredCards:', whereSqlForFilteredCards);
    console.log('[get-cards] paramsForWhere:', JSON.stringify(paramsForWhere));
    
    const totalResultStmt = db.prepare(`${artworksCte} SELECT COUNT(*) as count FROM UniqueArtworks ua`); // ua alias ici
    const totalResult = totalResultStmt.get(...paramsForWhere); 
    const totalItems = totalResult.count;
    const totalPages = Math.ceil(totalItems / limit) || 1;
    console.log(`[get-cards] Total items (artworks uniques) trouvés: ${totalItems}, Total pages: ${totalPages}`);


    // Clause ORDER BY standardisée (s'applique aux champs de UniqueArtworks, alias 'ua')
    // La variable noFiltersActive est utilisée ici pour l'ordre spécial des Dieux, mais vous avez demandé à le retirer.
    // Donc, on utilise la même clause ORDER BY pour tous les cas.
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
    
    // console.log('[get-cards] SQL Query (formaté):', sql.replace(/\s\s+/g, ' '));
    // console.log('[get-cards] Params for Data Query:', JSON.stringify(finalParamsForData));

    const stmt = db.prepare(sql);
    const artworks = stmt.all(...finalParamsForData); 

    // console.log(`[get-cards] Artworks récupérés pour la page ${page}: ${artworks.length}`);

    return {
      cards: artworks, 
      totalPages: totalPages,
      currentPage: page,
      totalCards: totalItems
    };
  } catch (error) {
    console.error('Erreur lors de la récupération des artworks de cartes:', error); // Cette erreur sera maintenant plus précise
    return { cards: [], totalPages: 1, currentPage: 1, totalCards: 0 };
  }
});
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

// Handler pour récupérer toutes les impressions d'une carte pour la vue détaillée
// Cette version ne renvoie plus les détails de collection, car ils sont récupérés séparément
ipcMain.handle('get-printings-for-card-details', async (event, cardId) => {
  if (!cardId) {
    console.error('[get-printings-for-card-details] Erreur: card_id non fourni.');
    return [];
  }

  const db = getDb();
  try {
    const sql = `
      SELECT
          cp.id as printing_id, c.card_type as card_type,
          c.id as card_id, c.name as card_name,
          s.set_name, s.set_code, cp.rarity, cp.edition, cp.language, cp.card_number_in_set,
          cp.artwork_variant_id as alternate_artwork_db_id, 
          COALESCE(
            cp.image_path_override, 
            (SELECT aa.artwork_image_path 
             FROM AlternateArtworks aa 
             WHERE aa.card_id = c.id AND aa.id = cp.artwork_variant_id
             LIMIT 1), 
            c.main_artwork_path
          ) as artwork_path,
          (SELECT COALESCE(SUM(uci.quantity), 0) FROM UserCollectionItems uci WHERE uci.card_printing_id = cp.id AND uci.collection_status = 'Owned') as owned_count_for_this_printing,
          (SELECT COALESCE(SUM(uci.quantity), 0) FROM UserCollectionItems uci WHERE uci.card_printing_id = cp.id AND uci.collection_status = 'Wanted') as wanted_count_for_this_printing,
          (SELECT COALESCE(SUM(uci.quantity), 0) FROM UserCollectionItems uci WHERE uci.card_printing_id = cp.id AND uci.collection_status = 'Trade') as trade_count_for_this_printing
      FROM CardPrintings cp
      JOIN Cards c ON cp.card_id = c.id
      JOIN Sets s ON cp.set_id = s.id
      LEFT JOIN UserCollectionItems uci ON uci.card_printing_id = cp.id AND uci.collection_status = 'Owned'
      WHERE cp.card_id = ?
      ORDER BY
          s.release_date_tcg_na DESC, 
          s.release_date_ocg DESC,
          s.set_name ASC,
          cp.card_number_in_set ASC,
          cp.rarity ASC;
    `;

    // console.log(`[get-printings-for-card-details] Exécution SQL pour card_id: ${cardId}`);
    const stmt = db.prepare(sql);
    const printings = stmt.all(cardId);
    // console.log(`[get-printings-for-card-details] Impressions trouvées: ${printings.length}`);

    return printings.map(p => ({
        ...p,
        // Assurer que owned_count_for_this_printing est bien un nombre
        owned_count_for_this_printing: p.owned_count_for_this_printing || 0 
    }));

  } catch (error) {
    console.error(`[get-printings-for-card-details] Erreur lors de la récupération des impressions pour card_id ${cardId}:`, error);
    return []; // Retourner un tableau vide en cas d'erreur
  }
});
// NOUVEAU Handler pour récupérer les "lots" de collection pour une impression donnée
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
ipcMain.handle('create-card-printing', async (event, printingData) => {
  const { card_id, set_code, set_name, card_number_in_set, rarity, language, edition, artwork_variant_id } = printingData;
  if (!card_id || !set_code || !card_number_in_set || !rarity) {
    return { success: false, message: 'Données manquantes pour créer l\'impression.' };
  }

  const db = getDb();
  try {
    // Étape 1 : Trouver ou créer le Set
    let setId;
    const existingSet = db.prepare('SELECT id FROM Sets WHERE set_code = ?').get(set_code);
    if (existingSet) {
      setId = existingSet.id;
    } else {
      // Créer le set s'il n'existe pas. set_name est requis.
      if (!set_name) return { success: false, message: 'Le nom du set est requis pour créer un nouveau set.' };
      const info = db.prepare('INSERT INTO Sets (set_name, set_code) VALUES (?, ?)').run(set_name, set_code);
      setId = info.lastInsertRowid;
    }

    // Étape 2 : Insérer la nouvelle impression dans CardPrintings
    const stmt = db.prepare(`
      INSERT INTO CardPrintings (
        card_id, set_id, card_number_in_set, rarity, language, edition, artwork_variant_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
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
// NOUVEAU Handler pour sauvegarder tous les lots d'une impression
ipcMain.handle('save-printing-collection-details', async (event, { printingId, items }) => {
    if (!printingId || !Array.isArray(items)) {
        console.error(`[IPC:save-printing-collection-details] Erreur pour printingId ${printingId}:`);
        for (const item of items) {
           console.error(`[IPC:save-printing-collection-details] Erreur pour item.delete ${item._to_delete}:`);
        };
        return { success: false, message: 'Données invalides.' };
    }
    const db = getDb();

    // Démarrer une transaction pour assurer l'atomicité des opérations
    const saveTransaction = db.transaction(() => {
        // Obtenir les IDs existants dans la DB pour cette impression
        const existingItemsStmt = db.prepare('SELECT id FROM UserCollectionItems WHERE card_printing_id = ?');
        const existingIds = new Set(existingItemsStmt.all(printingId).map(item => item.id));
        const itemIdsFromFrontend = new Set();

        // Parcourir les items envoyés par le frontend
        for (const item of items) {
            if (item._to_delete && item.id > 0) { // Si l'item est marqué pour suppression et a un ID de DB valide
                db.prepare('DELETE FROM UserCollectionItems WHERE id = ?').run(item.id);
                continue; // Passer à l'item suivant
            }

            if (item._to_delete) continue; // Ignorer les nouveaux items marqués pour suppression

            if (item.id > 0) { // C'est un item existant -> UPDATE
                itemIdsFromFrontend.add(item.id);
                const stmt = db.prepare(`
                    UPDATE UserCollectionItems 
                    SET 
                        collection_status = @collection_status,
                        quantity = @quantity,
                        condition = @condition,
                        storage_location = @storage_location,
                        acquisition_date = @acquisition_date,
                        acquisition_price = @acquisition_price,
                        user_notes = @user_notes
                    WHERE id = @id AND card_printing_id = @card_printing_id
                `);
                stmt.run(item);
            } else { // C'est un nouvel item (ID temporaire négatif) -> INSERT
                const stmt = db.prepare(`
                    INSERT INTO UserCollectionItems (
                        card_printing_id, collection_status, quantity, condition, storage_location, 
                        acquisition_date, acquisition_price, user_notes
                    ) VALUES (
                        @card_printing_id, @collection_status, @quantity, @condition, @storage_location,
                        @acquisition_date, @acquisition_price, @user_notes
                    )
                `);
                stmt.run(item);
            }
        }

        // Supprimer les items qui étaient dans la DB mais ont été retirés de l'UI
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
ipcMain.handle('update-printing-collection-quantity', async (event, { printingId, status, change }) => {
  if (printingId === undefined || !status || !['Owned', 'Wanted', 'Trade'].includes(status) || ![-1, 1].includes(change)) {
    console.error('[update-printing-collection-quantity] Paramètres invalides:', { printingId, status, change });
    return { success: false, message: 'Paramètres invalides.', newQuantity: 0 };
  }

  const db = getDb();
  try {
    let newQuantity = 0;
    // Vérifier si une entrée existe déjà pour ce printingId et ce statut
    const existingItemStmt = db.prepare(
      'SELECT id, quantity FROM UserCollectionItems WHERE card_printing_id = ? AND collection_status = ?'
    );
    const existingItem = existingItemStmt.get(printingId, status);

    if (existingItem) {
      newQuantity = existingItem.quantity + change;
      if (newQuantity < 0) newQuantity = 0; // Ne pas aller en dessous de 0

      if (newQuantity === 0 && status === 'Owned') { // Option: supprimer si la quantité Owned tombe à 0
        const deleteStmt = db.prepare('DELETE FROM UserCollectionItems WHERE id = ?');
        deleteStmt.run(existingItem.id);
        console.log(`[update-printing-collection-quantity] Entrée supprimée pour printingId: ${printingId}, status: ${status}`);
      } else {
        const updateStmt = db.prepare('UPDATE UserCollectionItems SET quantity = ? WHERE id = ?');
        updateStmt.run(newQuantity, existingItem.id);
        console.log(`[update-printing-collection-quantity] Quantité mise à jour pour printingId: ${printingId}, status: ${status} à ${newQuantity}`);
      }
    } else if (change > 0) { // Si l'entrée n'existe pas, on la crée seulement si on incrémente
      newQuantity = 1;
      const insertStmt = db.prepare(
        'INSERT INTO UserCollectionItems (card_printing_id, collection_status, quantity, condition) VALUES (?, ?, ?, ?)'
      );
      // Mettre une condition par défaut ou la récupérer/demander si nécessaire pour 'Owned'
      insertStmt.run(printingId, status, newQuantity, status === 'Owned' ? 'Near Mint' : null);
      console.log(`[update-printing-collection-quantity] Nouvelle entrée créée pour printingId: ${printingId}, status: ${status}, quantité: ${newQuantity}`);
    } else {
      // Tentative de décrémenter un item non existant ou un statut non 'Owned' qui est à 0
      console.log(`[update-printing-collection-quantity] Aucune action pour décrémenter un item non existant/nul pour printingId: ${printingId}, status: ${status}`);
      return { success: true, newQuantity: 0 }; // Retourne 0 car l'item n'existe pas ou est déjà à 0
    }
    
    // Recalculer le owned_count global pour l'artwork parent si le statut 'Owned' a été modifié
    if (status === 'Owned') {
        const cardIdStmt = db.prepare('SELECT card_id FROM CardPrintings WHERE id = ?');
        const card = cardIdStmt.get(printingId);
        if (card) {
            // Logique pour informer le frontend de rafraîchir le owned_count global de l'artwork si nécessaire
            // Cela est déjà géré par onCollectionUpdated dans App.jsx qui re-fetch la liste principale
        }
    }

    return { success: true, newQuantity };

  } catch (error) {
    console.error(`Erreur lors de la mise à jour de la quantité pour ${status} (printingId ${printingId}):`, error);
    return { success: false, message: `Erreur base de données: ${error.message}`, newQuantity: 0 };
  }
});
// Handler pour mettre à jour les détails d'un item de collection
ipcMain.handle('update-user-collection-item-details', async (event, { printing_id, status, details }) => {
  const db = getDb();
  try {
    // Vérifier si l'entrée existe. On ne peut éditer que si la quantité est > 0.
    const item = db.prepare('SELECT id FROM UserCollectionItems WHERE card_printing_id = ? AND collection_status = ?').get(printing_id, status);
    if (!item) {
      return { success: false, message: 'Aucun item à mettre à jour. Changez d\'abord la quantité.' };
    }
    
    const stmt = db.prepare(`
      UPDATE UserCollectionItems
      SET 
        condition = @condition,
        storage_location = @storage_location,
        acquisition_date = @acquisition_date,
        acquisition_price = @acquisition_price,
        user_notes = @user_notes
      WHERE id = @itemId
    `);
    
    const info = stmt.run({ ...details, itemId: item.id });
    
    return { success: info.changes > 0, message: info.changes > 0 ? 'Détails sauvegardés.' : 'Aucune modification détectée.' };
  } catch (error) {
    console.error(`Erreur lors de la mise à jour des détails pour printing_id ${printing_id}:`, error);
    return { success: false, message: error.message };
  }
});


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


// NOUVEAU: Mettre à jour les détails d'une impression
ipcMain.handle('update-card-printing', async (event, details) => {
  const { printing_id, set_id, card_number_in_set, rarity, language, edition, alternate_artwork_id } = details;
  if (!printing_id || !set_id || !card_number_in_set || !rarity) {
    return { success: false, message: 'Données de mise à jour de l\'impression incomplètes.' };
  }
  const db = getDb();
  try {
    const stmt = db.prepare(`
      UPDATE CardPrintings
      SET
        set_id = ?,
        card_number_in_set = ?,
        rarity = ?,
        language = ?,
        edition = ?,
        alternate_artwork_id = ?
      WHERE id = ?
    `);
    const info = stmt.run(set_id, card_number_in_set, rarity, language, edition, alternate_artwork_id, printing_id);
    return { success: info.changes > 0, message: 'Impression mise à jour avec succès.' };
  } catch (error) {
    console.error(`[IPC:update-card-printing] Erreur pour printing_id ${printing_id}:`, error);
    return { success: false, message: `Erreur de base de données: ${error.message}` };
  }
});

// NOUVEAU: Supprimer une impression
ipcMain.handle('delete-card-printing', async (event, printingId) => {
  if (!printingId) {
    return { success: false, message: 'ID de l\'impression manquant.' };
  }
  const db = getDb();
  try {
    // La contrainte ON DELETE CASCADE sur la table UserCollectionItems
    // devrait automatiquement supprimer tous les lots de collection associés.
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
