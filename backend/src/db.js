// backend/src/db.js
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

function ensureReservationColumns(db) {
  const cols = db
    .prepare(`PRAGMA table_info(reservations)`)
    .all()
    .map((c) => c.name);

  // ✅ payment_status
  if (!cols.includes("payment_status")) {
    db.prepare(
      `ALTER TABLE reservations ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'pending'`
    ).run();
  }

  // ✅ deposit_amount
  if (!cols.includes("deposit_amount")) {
    db.prepare(
      `ALTER TABLE reservations ADD COLUMN deposit_amount INTEGER NOT NULL DEFAULT 10000`
    ).run();
  }

  // ✅ payment_note
  if (!cols.includes("payment_note")) {
    db.prepare(
      `ALTER TABLE reservations ADD COLUMN payment_note TEXT NOT NULL DEFAULT ''`
    ).run();
  }

  // ✅ payment_updated_at (ALTER no permite datetime('now') como DEFAULT)
  if (!cols.includes("payment_updated_at")) {
    db.prepare(
      `ALTER TABLE reservations ADD COLUMN payment_updated_at TEXT NOT NULL DEFAULT ''`
    ).run();

    db.prepare(
      `UPDATE reservations SET payment_updated_at = datetime('now') WHERE payment_updated_at = ''`
    ).run();
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_reservations_payment_status
    ON reservations(payment_status);
  `);
}

export function initDB(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      user_email TEXT NOT NULL,
      court INTEGER NOT NULL CHECK (court IN (1,2)),
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      duration_min INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,

      payment_status TEXT NOT NULL DEFAULT 'pending',
      deposit_amount INTEGER NOT NULL DEFAULT 10000,
      payment_note TEXT NOT NULL DEFAULT '',
      payment_updated_at TEXT NOT NULL DEFAULT (datetime('now')),

      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(date);
    CREATE INDEX IF NOT EXISTS idx_reservations_court_date ON reservations(court, date);

    -- 🔐 Tokens reset password
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,  -- datetime string
      used_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_prt_user ON password_reset_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_prt_token_hash ON password_reset_tokens(token_hash);
  `);

  ensureReservationColumns(db);

  return db;
}
