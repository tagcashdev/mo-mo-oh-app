const path = require('path');
const fs = require('fs').promises;
const { app, BrowserWindow } = require('electron');
const fetch = require('node-fetch');

// Fonction pour trouver ou créer un archétype et retourner son ID
function getOrInsertArchetype(db, archetypeName) {
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

// Fonction pour télécharger et sauvegarder une image
async function downloadAndSaveImage(imageUrl, cardName, imageApiId, subfolder = 'artworks_main') {
    if (!imageUrl) return null;

    const userDataPath = app.getPath('userData');
    const imagesDir = path.join(userDataPath, 'card_images');
    const targetDir = path.join(imagesDir, subfolder);
    await fs.mkdir(targetDir, { recursive: true });

    const safeCardName = cardName.replace(/[^a-z0-9_.-]/gi, '_').toLowerCase();
    let extension = '.jpg';
    try {
        const urlPath = new URL(imageUrl).pathname;
        const ext = path.extname(urlPath);
        if (ext) {
            extension = ext;
        }
    } catch (e) {
        console.warn(`URL d'image invalide pour l'extraction de l'extension: ${imageUrl}`);
    }

    const filename = `${safeCardName}_${imageApiId}${extension}`;
    const localPath = path.join(targetDir, filename);
    const relativePath = path.join('card_images', subfolder, filename); // Chemin relatif pour la DB

    try {
        await fs.access(localPath);
        return relativePath; // L'image existe déjà
    } catch (e) {
        // L'image n'existe pas, on la télécharge
    }

    console.log(`Téléchargement de l'image: ${imageUrl} vers ${localPath}`);
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
            console.error(`Échec du téléchargement de ${imageUrl}: ${response.statusText}`);
            return null;
        }
        const buffer = await response.buffer();
        await fs.writeFile(localPath, buffer);
        return relativePath;
    } catch (error) {
        console.error(`Erreur réseau ou lors de l'écriture du fichier ${localPath}:`, error);
        return null;
    }
}

async function importAllCardData(db, browserWindow) {
  const API_URL = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';
  let importedCount = 0;
  let skippedCount = 0;
  let processedCount = 0;
  let totalToProcess = 0;

  function sendProgress(message, progress = null, total = null) {
    if (browserWindow && !browserWindow.isDestroyed()) {
      browserWindow.webContents.send('import-progress', { message, progress, total });
    }
    console.log(message);
  }

  sendProgress('Début de l\'importation des données des cartes...');
  try {
    sendProgress('Récupération des cartes depuis YGOPRODeck API...');
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`Erreur API YGOPRODeck (${response.status}): ${response.statusText}`);
    }

    const json = await response.json();
    if (!json.data || !Array.isArray(json.data)) {
      throw new Error('Format de données API YGOPRODeck inattendu. Le champ "data" est manquant ou n\'est pas un tableau.');
    }

    const cardsFromApi = json.data;
    totalToProcess = cardsFromApi.length;
    sendProgress(`Nombre total de cartes à traiter depuis l'API: ${totalToProcess}`);

    const existingCardIdsStmt = db.prepare("SELECT api_card_id FROM Cards WHERE api_card_id IS NOT NULL");
    const existingApiCardIds = new Set(existingCardIdsStmt.all().map(c => c.api_card_id));
    sendProgress(`${existingApiCardIds.size} cartes déjà présentes dans la base (basé sur api_card_id).`);

    const insertCardStmt = db.prepare(`
      INSERT INTO Cards (
        name, french_name, api_card_id, passcode, card_type, attribute, monster_race,
        level_rank_linkval, atk, def, scale, description_text, main_artwork_path,
        first_release_tcg, first_release_ocg, is_token, is_skill_card
      ) VALUES (
        @name, @french_name, @api_card_id, @passcode, @card_type, @attribute, @monster_race,
        @level_rank_linkval, @atk, @def, @scale, @description_text, @main_artwork_path,
        @first_release_tcg, @first_release_ocg, @is_token, @is_skill_card
      )`);
      
    const insertArchetypeStmt = db.prepare("INSERT OR IGNORE INTO CardArchetypes (card_id, archetype_id) VALUES (?, ?)");
    
    const insertArtworkStmt = db.prepare(`
      INSERT OR IGNORE INTO AlternateArtworks (
        card_id, artwork_name, artwork_image_path, release_order
      ) VALUES (
        @card_id, @artwork_name, @artwork_image_path, @release_order
      )`);

    db.exec("BEGIN");
    for (const card of cardsFromApi) {
        processedCount++;
        if (processedCount % 100 === 0 || processedCount === totalToProcess) {
            sendProgress(`Traitement: ${card.name} (${processedCount}/${totalToProcess})`, processedCount, totalToProcess);
        }

        if (existingApiCardIds.has(card.id)) {
            skippedCount++;
            continue;
        }

        let mainArtworkPath = null;
        if (card.card_images && card.card_images.length > 0) {
            mainArtworkPath = await downloadAndSaveImage(card.card_images[0].image_url, card.name, card.card_images[0].id, 'artworks_main');
        }

        const cardData = {
            name: card.name,
            french_name: card.fname || null,
            api_card_id: card.id,
            passcode: String(card.id).slice(0, 8),
            card_type: card.type,
            attribute: card.attribute || null,
            monster_race: card.race || null,
            level_rank_linkval: card.level || card.linkval || null,
            atk: typeof card.atk === 'number' ? card.atk : null,
            def: typeof card.def === 'number' ? card.def : null,
            scale: card.scale || null,
            description_text: card.desc,
            main_artwork_path: mainArtworkPath,
            first_release_tcg: card.misc_info?.[0]?.tcg_date || null,
            first_release_ocg: card.misc_info?.[0]?.ocg_date || null,
            is_token: card.type?.toLowerCase().includes('token') ? 1 : 0,
            is_skill_card: card.type?.toLowerCase().includes('skill card') ? 1 : 0
        };

        let cardDbId;
        try {
            const info = insertCardStmt.run(cardData);
            cardDbId = info.lastInsertRowid;
            importedCount++;

            if (card.archetype) {
                const archetypeId = getOrInsertArchetype(db, card.archetype);
                if (archetypeId && cardDbId) {
                    insertArchetypeStmt.run(cardDbId, archetypeId);
                }
            }
            
            if (card.card_images && card.card_images.length > 1) {
                for (let i = 0; i < card.card_images.length; i++) {
                    const artwork = card.card_images[i];
                    const artworkPath = await downloadAndSaveImage(artwork.image_url, card.name, artwork.id, i === 0 ? 'artworks_main' : 'artworks_alternates');
                    if (artworkPath && cardDbId) {
                        insertArtworkStmt.run({
                            card_id: cardDbId,
                            artwork_name: `Artwork API ID ${artwork.id}` + (i === 0 ? ' (Principal)' : ''),
                            artwork_image_path: artworkPath,
                            release_order: i
                        });
                    }
                }
            }

        } catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                sendProgress(`Avertissement: Conflit UNIQUE pour la carte "${card.name}" (API ID: ${card.id}). Probablement déjà importée. Sautée.`);
                skippedCount++;
                importedCount--; // On décrémente car l'import a échoué
            } else {
                console.error(`Erreur DB pour ${card.name} (API ID: ${card.id}):`, error);
            }
        }
    }
    db.exec("COMMIT");

    sendProgress(`Importation terminée. ${importedCount} nouvelles cartes importées. ${skippedCount} cartes existantes/échouées sautées. ${processedCount} cartes traitées.`);
  } catch (error) {
    if (db.inTransaction) {
      db.exec("ROLLBACK");
    }
    console.error('Erreur majeure lors de l\'importation des données:', error);
    sendProgress(`Erreur critique d'importation: ${error.message || error}`);
  }
}

module.exports = { importAllCardData, downloadAndSaveImage, getOrInsertArchetype };