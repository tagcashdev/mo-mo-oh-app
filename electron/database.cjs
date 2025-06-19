// electron/database.js
const path = require('path');
const fs = require('fs');
const { app } = require('electron'); // Assurez-vous que 'app' est importé
const Database = require('better-sqlite3');

const dbPath = path.join(app.getPath('userData'), 'momooh_database.sqlite3');
let db;

function initDatabase() {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath, { verbose: console.log });
  console.log(`Base de données initialisée à : ${dbPath}`);
  createSchema();
}

function createSchema() {
  const createTablesStmt = `
    -- Table: Cards
    CREATE TABLE IF NOT EXISTS Cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      french_name TEXT,
      api_card_id INTEGER UNIQUE,
      passcode TEXT,
      card_type TEXT NOT NULL,
      attribute TEXT,
      monster_race TEXT,
      level_rank_linkval INTEGER,
      atk INTEGER,
      def INTEGER,
      scale INTEGER,
      description_text TEXT NOT NULL,
      skill_activation_condition TEXT,
      main_artwork_path TEXT,
      first_release_tcg TEXT,
      first_release_ocg TEXT,
      first_release_speed_duel TEXT,
      first_release_rush_duel TEXT,
      card_comment TEXT,
      search_comment TEXT,
      effect_type_user_notes TEXT,
      is_token INTEGER DEFAULT 0,
      is_skill_card INTEGER DEFAULT 0,
      is_collectible_only INTEGER DEFAULT 0,
      is_anime_manga_exclusive INTEGER DEFAULT 0
    );

    -- Table: Archetypes
    CREATE TABLE IF NOT EXISTS Archetypes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    -- Table: CardArchetypes (Junction Table)
    CREATE TABLE IF NOT EXISTS CardArchetypes (
      card_id INTEGER NOT NULL,
      archetype_id INTEGER NOT NULL,
      PRIMARY KEY (card_id, archetype_id),
      FOREIGN KEY (card_id) REFERENCES Cards(id) ON DELETE CASCADE,
      FOREIGN KEY (archetype_id) REFERENCES Archetypes(id) ON DELETE CASCADE
    );

    -- Table: Subtypes
    CREATE TABLE IF NOT EXISTS Subtypes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applies_to TEXT -- 'Monster', 'Spell', 'Trap'
    );

    -- Table: CardSubtypes (Junction Table)
    CREATE TABLE IF NOT EXISTS CardSubtypes (
      card_id INTEGER NOT NULL,
      subtype_id INTEGER NOT NULL,
      PRIMARY KEY (card_id, subtype_id),
      FOREIGN KEY (card_id) REFERENCES Cards(id) ON DELETE CASCADE,
      FOREIGN KEY (subtype_id) REFERENCES Subtypes(id) ON DELETE CASCADE
    );

    -- Table: Sets
    CREATE TABLE IF NOT EXISTS Sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      set_name TEXT NOT NULL,
      set_code TEXT NOT NULL,
      release_date_tcg_na TEXT,
      release_date_tcg_eu TEXT,
      release_date_ocg TEXT,
      release_date_speed_duel_tcg TEXT,
      release_date_rush_duel_ocg TEXT,
      total_cards INTEGER,
      set_type TEXT
    );

    -- Table: CardPrintings
    CREATE TABLE IF NOT EXISTS CardPrintings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      set_id INTEGER NOT NULL,
      card_number_in_set TEXT NOT NULL,
      rarity TEXT NOT NULL,
      edition TEXT,
      language TEXT NOT NULL,
      artwork_variant_id TEXT,
      errata_version INTEGER DEFAULT 0,
      passcode_override TEXT,
      image_path_override TEXT,
      cardmarket_url TEXT,
      tcgplayer_url TEXT,
      current_price_nm_eur REAL,
      current_price_nm_usd REAL,
      UNIQUE (set_id, card_number_in_set, language, rarity, edition, artwork_variant_id, errata_version), -- Clé d'unicité pour une impression spécifique
      FOREIGN KEY (card_id) REFERENCES Cards(id) ON DELETE CASCADE,
      FOREIGN KEY (set_id) REFERENCES Sets(id) ON DELETE CASCADE
    );

    -- Table: AlternateArtworks
    CREATE TABLE IF NOT EXISTS AlternateArtworks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      artwork_name TEXT NOT NULL,
      artwork_image_path TEXT NOT NULL,
      release_order INTEGER,
      UNIQUE (card_id, artwork_name),
      FOREIGN KEY (card_id) REFERENCES Cards(id) ON DELETE CASCADE
    );

    -- Table: CardErrata
    CREATE TABLE IF NOT EXISTS CardErrata (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      errata_version_number INTEGER NOT NULL,
      errata_date_tcg TEXT,
      errata_date_ocg TEXT,
      errata_type TEXT,
      previous_text TEXT,
      new_text TEXT NOT NULL,
      notes TEXT,
      UNIQUE (card_id, errata_version_number),
      FOREIGN KEY (card_id) REFERENCES Cards(id) ON DELETE CASCADE
    );

    -- Table: Characters
    CREATE TABLE IF NOT EXISTS Characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      series TEXT
    );

    -- Table: CardCharacterUsage (Junction Table)
    CREATE TABLE IF NOT EXISTS CardCharacterUsage (
      card_id INTEGER NOT NULL,
      character_id INTEGER NOT NULL,
      usage_notes TEXT,
      PRIMARY KEY (card_id, character_id),
      FOREIGN KEY (card_id) REFERENCES Cards(id) ON DELETE CASCADE,
      FOREIGN KEY (character_id) REFERENCES Characters(id) ON DELETE CASCADE
    );

    -- Table: Banlists
    CREATE TABLE IF NOT EXISTS Banlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      format TEXT NOT NULL,
      region TEXT,
      effective_date TEXT NOT NULL,
      source_url TEXT,
      UNIQUE (format, region, effective_date)
    );

    -- Table: BanlistCards (Junction Table)
    CREATE TABLE IF NOT EXISTS BanlistCards (
      banlist_id INTEGER NOT NULL,
      card_id INTEGER NOT NULL,
      status TEXT NOT NULL, -- Forbidden, Limited, Semi-Limited, etc.
      PRIMARY KEY (banlist_id, card_id),
      FOREIGN KEY (banlist_id) REFERENCES Banlists(id) ON DELETE CASCADE,
      FOREIGN KEY (card_id) REFERENCES Cards(id) ON DELETE CASCADE
    );

    -- Table: UserCollectionItems
    CREATE TABLE IF NOT EXISTS UserCollectionItems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_printing_id INTEGER NOT NULL,
      collection_status TEXT NOT NULL, -- 'Owned', 'Wanted', 'Trade'
      quantity INTEGER NOT NULL DEFAULT 1,
      condition TEXT, -- 'Near Mint', 'Played', etc.
      storage_location TEXT,
      acquisition_date TEXT,
      acquisition_price REAL,
      user_notes TEXT,
      FOREIGN KEY (card_printing_id) REFERENCES CardPrintings(id) ON DELETE CASCADE
    );
  `;

  try {
    db.exec(createTablesStmt);
    console.log('Schéma de base de données vérifié/créé avec succès.');

    // Création des index (peut être fait ici ou dans une fonction séparée)
    createIndexes();

  } catch (error) {
    console.error('Erreur lors de la création du schéma de base de données:', error);
  }
}

function createIndexes() {
  const indexStatements = [
    // Indexes for Cards table
    'CREATE INDEX IF NOT EXISTS idx_cards_name ON Cards (name);',
    'CREATE INDEX IF NOT EXISTS idx_cards_french_name ON Cards (french_name);',
    'CREATE INDEX IF NOT EXISTS idx_cards_api_card_id ON Cards (api_card_id);',
    'CREATE INDEX IF NOT EXISTS idx_cards_card_type ON Cards (card_type);',
    'CREATE INDEX IF NOT EXISTS idx_cards_attribute ON Cards (attribute);',
    'CREATE INDEX IF NOT EXISTS idx_cards_monster_race ON Cards (monster_race);',
    'CREATE INDEX IF NOT EXISTS idx_cards_level_rank_linkval ON Cards (level_rank_linkval);',
    'CREATE INDEX IF NOT EXISTS idx_cards_atk ON Cards (atk);',
    'CREATE INDEX IF NOT EXISTS idx_cards_def ON Cards (def);',
    'CREATE INDEX IF NOT EXISTS idx_cards_scale ON Cards (scale);',

    // Indexes for Archetypes table
    'CREATE INDEX IF NOT EXISTS idx_archetypes_name ON Archetypes (name);',

    // Indexes for CardArchetypes table
    'CREATE INDEX IF NOT EXISTS idx_cardarchetypes_card_id ON CardArchetypes (card_id);',
    'CREATE INDEX IF NOT EXISTS idx_cardarchetypes_archetype_id ON CardArchetypes (archetype_id);',

    // Indexes for Subtypes table
    'CREATE INDEX IF NOT EXISTS idx_subtypes_name ON Subtypes (name);',

    // Indexes for CardSubtypes table
    'CREATE INDEX IF NOT EXISTS idx_cardsubtypes_card_id ON CardSubtypes (card_id);',
    'CREATE INDEX IF NOT EXISTS idx_cardsubtypes_subtype_id ON CardSubtypes (subtype_id);',

    // Indexes for Sets table
    'CREATE INDEX IF NOT EXISTS idx_sets_set_code ON Sets (set_code);',
    'CREATE INDEX IF NOT EXISTS idx_sets_set_name ON Sets (set_name);',

    // Indexes for CardPrintings table
    'CREATE INDEX IF NOT EXISTS idx_cardprintings_card_id ON CardPrintings (card_id);',
    'CREATE INDEX IF NOT EXISTS idx_cardprintings_set_id ON CardPrintings (set_id);',
    'CREATE INDEX IF NOT EXISTS idx_cardprintings_card_number_in_set ON CardPrintings (card_number_in_set);',
    'CREATE INDEX IF NOT EXISTS idx_cardprintings_language ON CardPrintings (language);',
    'CREATE INDEX IF NOT EXISTS idx_cardprintings_rarity ON CardPrintings (rarity);',

    // Indexes for AlternateArtworks table
    'CREATE INDEX IF NOT EXISTS idx_alternateartworks_card_id ON AlternateArtworks (card_id);',

    // Indexes for CardErrata table
    'CREATE INDEX IF NOT EXISTS idx_carderrata_card_id ON CardErrata (card_id);',

    // Indexes for Characters table
    'CREATE INDEX IF NOT EXISTS idx_characters_name ON Characters (name);',
    'CREATE INDEX IF NOT EXISTS idx_characters_series ON Characters (series);',

    // Indexes for CardCharacterUsage table
    'CREATE INDEX IF NOT EXISTS idx_cardcharacterusage_card_id ON CardCharacterUsage (card_id);',
    'CREATE INDEX IF NOT EXISTS idx_cardcharacterusage_character_id ON CardCharacterUsage (character_id);',

    // Indexes for Banlists table
    'CREATE INDEX IF NOT EXISTS idx_banlists_format_region_date ON Banlists (format, region, effective_date);',

    // Indexes for BanlistCards table
    'CREATE INDEX IF NOT EXISTS idx_banlistcards_banlist_id ON BanlistCards (banlist_id);',
    'CREATE INDEX IF NOT EXISTS idx_banlistcards_card_id ON BanlistCards (card_id);',

    // Indexes for UserCollectionItems table
    'CREATE INDEX IF NOT EXISTS idx_usercollection_card_printing_id ON UserCollectionItems (card_printing_id);',
    'CREATE INDEX IF NOT EXISTS idx_usercollection_collection_status ON UserCollectionItems (collection_status);',
    'CREATE INDEX IF NOT EXISTS idx_usercollection_storage_location ON UserCollectionItems (storage_location);'
  ];

  try {
    indexStatements.forEach(stmt => db.exec(stmt));
    console.log('Index de base de données vérifiés/créés avec succès.');
  } catch (error) {
    console.error('Erreur lors de la création des index:', error);
  }
}


function getDb() {
  if (!db) {
    initDatabase(); // S'assurer que la DB est initialisée si elle ne l'est pas encore
  }
  return db;
}

module.exports = { getDb, initDatabase }; // initDatabase est exporté pour être appelé depuis main.js