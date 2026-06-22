'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

const DATA_DIR = path.join(os.homedir(), 'Library', 'Application Support', 'Divi5Generator');
const EXPORTS_DIR = path.join(DATA_DIR, 'exports');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(EXPORTS_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'history.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS generations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    brand           TEXT NOT NULL,
    keyword         TEXT NOT NULL,
    sections        TEXT NOT NULL,
    aesthetic       TEXT NOT NULL,
    cta_label       TEXT,
    cta_url         TEXT,
    output_dir      TEXT NOT NULL,
    export_path     TEXT,
    status          TEXT NOT NULL DEFAULT 'running',
    style_check     TEXT,
    spec_check      TEXT,
    validator_errors INTEGER DEFAULT 0,
    validator_warns  INTEGER DEFAULT 0,
    log             TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS output_files (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    generation_id  INTEGER REFERENCES generations(id),
    filename       TEXT NOT NULL,
    filepath       TEXT NOT NULL,
    kind           TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS designer_exports (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    saved_at     TEXT NOT NULL DEFAULT (datetime('now')),
    label        TEXT NOT NULL,
    brand        TEXT NOT NULL,
    filepath     TEXT NOT NULL,
    preset_count INTEGER DEFAULT 0,
    colour_count INTEGER DEFAULT 0
  );
`);

// ─── Saved briefs ────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS saved_briefs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    name       TEXT NOT NULL,
    data       TEXT NOT NULL
  );
`);

// ─── Migrations: add new columns if they don't exist ────────────────────────
const migrations = [
  `ALTER TABLE generations ADD COLUMN import_status TEXT`,
  `ALTER TABLE generations ADD COLUMN preview_url TEXT`,
  `ALTER TABLE generations ADD COLUMN brief_json TEXT`,
  `ALTER TABLE generations ADD COLUMN saved_export_id INTEGER`,
  `ALTER TABLE generations ADD COLUMN what_it_does TEXT`,
  `ALTER TABLE generations ADD COLUMN secondary_keywords TEXT`,
  `ALTER TABLE generations ADD COLUMN has_preview INTEGER DEFAULT 0`,
  `ALTER TABLE generations ADD COLUMN et_template TEXT`,
];
for (const sql of migrations) {
  try { db.exec(sql); } catch (_) {}
}

module.exports = { db, DATA_DIR, EXPORTS_DIR };
