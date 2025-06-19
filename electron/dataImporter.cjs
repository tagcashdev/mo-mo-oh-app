// electron/dataImporter.cjs ou electron/dataImporter.js
const fetch = require('node-fetch');
const { getDb } = require('./database.cjs'); 
const path = require('path');
const fs = require('fs').promises; // Pour les opérations de fichiers asynchrones
const { app } = require('electron'); // 'app' est nécessaire pour app.getPath('userData')

const YGOPRODECK_API_URL = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';
// const RUSHDUEL_API_URL = 'https://db.ygoprodeck.com/api/v7/cardinfo.php?type=Rush%20Duel'; // Si vous voulez les importer séparément

// --- Fonctions d'aide pour la base de données ---

/**
 * Trouve ou crée un archétype et retourne son ID.
 * @param {import('better-sqlite3').Database} db - L'instance de la base de données.
 * @param {string} archetypeName - Le nom de l'archétype.
 * @returns {number|null} L'ID de l'archétype ou null en cas d'erreur.
 */
function findOrCreateArchetype(db, archetypeName) {
  if (!archetypeName || archetypeName.trim() === '') {
    return null;
  }
  try {
    let stmt = db.prepare('SELECT id FROM Archetypes WHERE name = ?');
    let result = stmt.get(archetypeName);
    if (result) {
      return result.id;
    } else {
      stmt = db.prepare('INSERT INTO Archetypes (name) VALUES (?)');
      const info = stmt.run(archetypeName);
      return info.lastInsertRowid;
    }
  } catch (error) {
    console.error(`Erreur lors de la recherche/création de l'archétype ${archetypeName}:`, error);
    return null;
  }
}

/**
 * Trouve ou crée un set et retourne son ID.
 * @param {import('better-sqlite3').Database} db - L'instance de la base de données.
 * @param {object} setInfo - Informations sur le set depuis l'API (set_name, set_code).
 * @returns {number|null} L'ID du set ou null en cas d'erreur.
 */
function findOrCreateSet(db, setInfo) {
  if (!setInfo || !setInfo.set_name || !setInfo.set_code) {
    console.warn('Informations de set incomplètes:', setInfo);
    return null;
  }
  try {
    let stmt = db.prepare('SELECT id FROM Sets WHERE set_code = ?');
    let result = stmt.get(setInfo.set_code);
    if (result) {
      return result.id;
    } else {
      stmt = db.prepare('INSERT INTO Sets (set_name, set_code, set_type) VALUES (?, ?, ?)');
      const info = stmt.run(setInfo.set_name, setInfo.set_code, setInfo.set_type || 'Unknown');
      return info.lastInsertRowid;
    }
  } catch (error) {
    console.error(`Erreur lors de la recherche/création du set ${setInfo.set_name} (${setInfo.set_code}):`, error);
    return null;
  }
}

/**
 * Gère le téléchargement et la sauvegarde d'une image.
 * @param {string} imageUrl - URL de l'image.
 * @param {string} cardName - Nom de la carte (pour nommer le fichier).
 * @param {string | number} imageApiId - ID de l'image venant de l'API (pour l'unicité).
 * @param {string} subfolder - Sous-dossier ('artworks_main', 'artworks_alternates', 'artworks_small').
 * @returns {Promise<string|null>} Chemin local relatif de l'image sauvegardée (depuis userData) ou null.
 */
async function downloadAndSaveImage(imageUrl, cardName, imageApiId, subfolder = 'artworks_main') {
  if (!imageUrl) return null;

  const baseImagesDir = path.join(app.getPath('userData'), 'card_images');
  const targetDir = path.join(baseImagesDir, subfolder);
  await fs.mkdir(targetDir, { recursive: true });

  const safeCardName = cardName.replace(/[^a-z0-9_.-]/gi, '_').toLowerCase();
  let extension = '.jpg'; // Extension par défaut
  try {
    const urlPath = new URL(imageUrl).pathname;
    const extFromUrl = path.extname(urlPath);
    if (extFromUrl) {
      extension = extFromUrl;
    }
  } catch (e) {
    console.warn(`URL d'image invalide pour l'extraction de l'extension: ${imageUrl}`);
  }

  const localImageName = `${safeCardName}_${imageApiId}${extension}`;
  const localImagePath = path.join(targetDir, localImageName);
  const relativeImagePath = path.join('card_images', subfolder, localImageName); // Chemin relatif pour la DB

  try {
    await fs.access(localImagePath);
    // console.log(`Image déjà existante: ${localImagePath}`);
    return relativeImagePath;
  } catch (error) {
    // L'image n'existe pas, la télécharger
    console.log(`Téléchargement de l'image: ${imageUrl} vers ${localImagePath}`);
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          console.error(`Échec du téléchargement de ${imageUrl}: ${response.statusText}`);
          return null;
        }
        const buffer = await response.buffer();
        await fs.writeFile(localImagePath, buffer);
        return relativeImagePath;
    } catch (fetchError) {
        console.error(`Erreur réseau ou lors de l'écriture du fichier ${localImagePath}:`, fetchError);
        return null;
    }
  }
}

/**
 * Fonction principale pour importer toutes les données des cartes.
 * @param {import('electron').BrowserWindow | null} mainWindow - La fenêtre principale pour envoyer des messages de progression.
 */
async function importAllCardData(mainWindow) {
  const db = getDb();
  let newCardsImportedCount = 0;
  let existingCardsSkippedCount = 0;
  let cardsProcessedCount = 0;
  let totalCardsToFetch = 0;

  function sendProgress(message, progress = null, total = null) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('import-progress', { message, progress, total });
    }
    console.log(message); // Toujours logger en console
  }

  sendProgress('Début de l\'importation des données des cartes...');

  try {
    sendProgress('Récupération des cartes depuis YGOPRODeck API...');
    const apiResponse = await fetch(YGOPRODECK_API_URL);
    if (!apiResponse.ok) {
      throw new Error(`Erreur API YGOPRODeck (${apiResponse.status}): ${apiResponse.statusText}`);
    }
    const apiResult = await apiResponse.json();

    if (!apiResult.data || !Array.isArray(apiResult.data)) {
        throw new Error('Format de données API YGOPRODeck inattendu. Le champ "data" est manquant ou n\'est pas un tableau.');
    }
    const cardsFromApi = apiResult.data;
    totalCardsToFetch = cardsFromApi.length;
    sendProgress(`Nombre total de cartes à traiter depuis l'API: ${totalCardsToFetch}`);

    const existingApiCardIdsStmt = db.prepare('SELECT api_card_id FROM Cards WHERE api_card_id IS NOT NULL');
    const existingApiCardIds = new Set(existingApiCardIdsStmt.all().map(row => row.api_card_id));
    sendProgress(`${existingApiCardIds.size} cartes déjà présentes dans la base (basé sur api_card_id).`);

    // Préparation des requêtes
    const insertCardStmt = db.prepare( /* ... voir le script SQL complet précédent ... */ `
      INSERT INTO Cards (
        name, french_name, api_card_id, passcode, card_type, attribute, monster_race,
        level_rank_linkval, atk, def, scale, description_text, main_artwork_path,
        first_release_tcg, first_release_ocg, is_token, is_skill_card
        -- card_comment, search_comment, effect_type_user_notes, is_collectible_only, is_anime_manga_exclusive (champs manuels)
      ) VALUES (
        @name, @french_name, @api_card_id, @passcode, @card_type, @attribute, @monster_race,
        @level_rank_linkval, @atk, @def, @scale, @description_text, @main_artwork_path,
        @first_release_tcg, @first_release_ocg, @is_token, @is_skill_card
      )`);
    const insertCardArchetypeStmt = db.prepare('INSERT OR IGNORE INTO CardArchetypes (card_id, archetype_id) VALUES (?, ?)');
    const insertCardPrintingStmt = db.prepare(`
      INSERT OR IGNORE INTO CardPrintings (
        card_id, set_id, card_number_in_set, rarity, language, current_price_nm_eur
        -- edition, artwork_variant_id, errata_version, passcode_override, image_path_override, cardmarket_url, tcgplayer_url, current_price_nm_usd (plus de détails à ajouter)
      ) VALUES (
        @card_id, @set_id, @card_number_in_set, @rarity, @language, @current_price_nm_eur
      )`);
    const insertAlternateArtworkStmt = db.prepare(`
      INSERT OR IGNORE INTO AlternateArtworks (
        card_id, artwork_name, artwork_image_path, release_order
      ) VALUES (
        @card_id, @artwork_name, @artwork_image_path, @release_order
      )`);

    db.exec('BEGIN');

    for (const cardData of cardsFromApi) {
      cardsProcessedCount++;
      if (cardsProcessedCount % 100 === 0 || cardsProcessedCount === totalCardsToFetch) {
        sendProgress(`Traitement: ${cardData.name} (${cardsProcessedCount}/${totalCardsToFetch})`, cardsProcessedCount, totalCardsToFetch);
      }

      if (existingApiCardIds.has(cardData.id)) {
        existingCardsSkippedCount++;
        continue;
      }

      let mainArtworkLocalPath = null;
      if (cardData.card_images && cardData.card_images.length > 0) {
        mainArtworkLocalPath = await downloadAndSaveImage(cardData.card_images[0].image_url, cardData.name, cardData.card_images[0].id, 'artworks_main');
      }

      // Mapping des données API vers la table Cards
      const cardToInsert = {
        name: cardData.name,
        french_name: cardData.fname || null,
        api_card_id: cardData.id,
        passcode: String(cardData.id).slice(0, 8), // L'API ne fournit pas toujours un passcode distinct de l'ID. À ajuster.
        card_type: cardData.type,
        attribute: cardData.attribute || null,
        monster_race: cardData.race || null,
        level_rank_linkval: cardData.level || cardData.linkval || null,
        atk: (typeof cardData.atk === 'number') ? cardData.atk : null,
        def: (typeof cardData.def === 'number') ? cardData.def : null,
        scale: cardData.scale || null,
        description_text: cardData.desc,
        main_artwork_path: mainArtworkLocalPath,
        first_release_tcg: cardData.misc_info?.[0]?.tcg_date || null,
        first_release_ocg: cardData.misc_info?.[0]?.ocg_date || null,
        is_token: cardData.type?.toLowerCase().includes('token') ? 1 : 0,
        is_skill_card: cardData.type?.toLowerCase().includes('skill card') ? 1 : 0,
      };

      let newCardDbId;
      try {
        const cardInsertInfo = insertCardStmt.run(cardToInsert);
        newCardDbId = cardInsertInfo.lastInsertRowid;
        newCardsImportedCount++;

        // Archétype
        if (cardData.archetype) {
          const archetypeId = findOrCreateArchetype(db, cardData.archetype);
          if (archetypeId && newCardDbId) {
            insertCardArchetypeStmt.run(newCardDbId, archetypeId);
          }
        }

        // Impressions (Card Sets)
        /*
        if (cardData.card_sets && Array.isArray(cardData.card_sets)) {
          for (const setPrint of cardData.card_sets) {
            const setId = findOrCreateSet(db, { set_name: setPrint.set_name, set_code: setPrint.set_code });
            if (setId && newCardDbId) {
              insertCardPrintingStmt.run({
                card_id: newCardDbId,
                set_id: setId,
                card_number_in_set: setPrint.set_code, // L'API YGOProDeck utilise set_code pour le numéro dans le set.
                rarity: setPrint.set_rarity,
                language: 'EN', // L'API principale est en anglais.
                current_price_nm_eur: parseFloat(setPrint.set_price) || null // L'API fournit set_price
              });
            }
          }
        }
        */

        // Artworks Alternatifs (le premier est déjà main_artwork_path)
        if (cardData.card_images && cardData.card_images.length > 1) {
          for (let i = 0; i < cardData.card_images.length; i++) { // Boucle sur tous pour les insérer dans AlternateArtworks
            const imgData = cardData.card_images[i];
            const artworkLocalPath = await downloadAndSaveImage(imgData.image_url, cardData.name, imgData.id, (i===0 ? 'artworks_main' : 'artworks_alternates') );
            if (artworkLocalPath && newCardDbId) {
                 // Si c'est l'artwork principal, on pourrait l'ignorer ici si on le gère que dans Cards.main_artwork_path
                 // Ou alors on les stocke tous dans AlternateArtworks et Cards.main_artwork_path pointe vers l'un d'eux.
                 // Pour l'instant, insérons tous les artworks pour référence.
                insertAlternateArtworkStmt.run({
                    card_id: newCardDbId,
                    artwork_name: `Artwork API ID ${imgData.id}` + (i === 0 ? ' (Principal)' : ''), // Nom plus descriptif
                    artwork_image_path: artworkLocalPath,
                    release_order: i // Ordre tel que fourni par l'API
                });
            }
          }
        }

      } catch (dbError) {
        if (dbError.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          sendProgress(`Avertissement: Conflit UNIQUE pour la carte "${cardData.name}" (API ID: ${cardData.id}). Probablement déjà importée via une autre logique ou nom similaire. Sautée.`);
          existingCardsSkippedCount++;
          newCardsImportedCount--; // Décrémenter car l'insertion a échoué
        } else {
          console.error(`Erreur DB pour ${cardData.name} (API ID: ${cardData.id}):`, dbError);
          // Optionnel: db.exec('ROLLBACK'); throw dbError; // Arrêter toute l'importation
        }
      }
    }

    db.exec('COMMIT');
    sendProgress(`Importation terminée. ${newCardsImportedCount} nouvelles cartes importées. ${existingCardsSkippedCount} cartes existantes/échouées sautées. ${cardsProcessedCount} cartes traitées.`);

  } catch (error) {
    if (db.inTransaction) db.exec('ROLLBACK');
    console.error('Erreur majeure lors de l\'importation des données:', error);
    sendProgress(`Erreur critique d'importation: ${error.message || error}`);
  }
}

module.exports = { importAllCardData };