// db.js — Lapisan SQLite (node:sqlite bawaan Node.js 22.5+, tanpa npm install).
const path = require('path');

let DatabaseSync;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} catch {
  console.error('');
  console.error('GAGAL: modul node:sqlite tidak tersedia.');
  console.error('Butuh Node.js versi 22.5 atau lebih baru. Cek dengan: node --version');
  console.error('');
  process.exit(1);
}

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.db');
const db = new DatabaseSync(DB_PATH);

db.exec(`
CREATE TABLE IF NOT EXISTS admin (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS proxies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  fail_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  last_test_ok INTEGER,
  last_test_at TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
`);

// Migrasi ringan untuk DB lama: tambah kolom source bila belum ada.
try {
  db.exec(`ALTER TABLE proxies ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'`);
} catch { /* kolom sudah ada */ }

module.exports = { db, DB_PATH };