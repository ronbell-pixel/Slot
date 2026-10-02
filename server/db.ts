import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const dbPath =
  process.env.DATABASE_PATH ??
  (process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'slots.db')
    : path.resolve('data/slots.db'));

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id              INTEGER PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE COLLATE NOCASE,
    avatar          TEXT NOT NULL,
    color           TEXT NOT NULL,
    balance         INTEGER NOT NULL,
    free_spins      INTEGER NOT NULL DEFAULT 0,
    free_spin_bet   INTEGER NOT NULL DEFAULT 0,
    free_spin_total INTEGER NOT NULL DEFAULT 0,
    last_bonus_at   INTEGER NOT NULL,
    created_at      INTEGER NOT NULL,
    last_seen       INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS spins (
    id            INTEGER PRIMARY KEY,
    player_id     INTEGER NOT NULL REFERENCES players(id),
    theme         TEXT NOT NULL,
    bet           INTEGER NOT NULL,
    paid          INTEGER NOT NULL,   -- credits deducted (0 on a free spin)
    win           INTEGER NOT NULL,   -- line + scatter win
    jackpot_tier  TEXT,
    jackpot_win   INTEGER NOT NULL DEFAULT 0,
    free_spin     INTEGER NOT NULL,
    scatters      INTEGER NOT NULL,
    grid          TEXT NOT NULL,
    balance_after INTEGER NOT NULL,
    created_at    INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS spins_player ON spins(player_id, id);

  CREATE TABLE IF NOT EXISTS jackpots (
    player_id INTEGER NOT NULL REFERENCES players(id),
    tier      TEXT NOT NULL,
    value     REAL NOT NULL,
    PRIMARY KEY (player_id, tier)
  );

  CREATE TABLE IF NOT EXISTS jackpot_wins (
    id         INTEGER PRIMARY KEY,
    player_id  INTEGER NOT NULL REFERENCES players(id),
    tier       TEXT NOT NULL,
    amount     INTEGER NOT NULL,
    theme      TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

console.log(`Database: ${dbPath}`);
