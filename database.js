/* ═══════════════════════════════════════════════════════════════════════════════
 *  KSP CRIME DATABASE — Database Module
 * ═══════════════════════════════════════════════════════════════════════════════
 *  SQLite database setup using better-sqlite3.
 *  Creates all tables for: FIR records, suspects, conversations, users.
 *  Zero-config — database file is auto-created on first run.
 * ═══════════════════════════════════════════════════════════════════════════════ */

const Database = require('better-sqlite3');
const path = require('path');

/* ── Database file path ───────────────────────────────────────────────────── */
const DB_PATH = path.join(__dirname, 'ksp_crime.db');

/** @type {Database.Database | null} */
let dbInstance = null;

/* ═══════════════════════════════════════════════════════════════════════════════
 *  getDb() — Returns the singleton database instance
 * ═══════════════════════════════════════════════════════════════════════════════
 *  Creates the connection on first call, reuses it afterwards.
 *  WAL mode is enabled for better concurrent read performance.
 * ═══════════════════════════════════════════════════════════════════════════════ */
function getDb() {
    if (!dbInstance) {
        dbInstance = new Database(DB_PATH);
        // Enable WAL mode for better read concurrency
        dbInstance.pragma('journal_mode = WAL');
        // Enable foreign keys
        dbInstance.pragma('foreign_keys = ON');
    }
    return dbInstance;
}

/* ═══════════════════════════════════════════════════════════════════════════════
 *  initializeDb() — Creates all tables if they don't exist
 * ═══════════════════════════════════════════════════════════════════════════════
 *  Safe to call multiple times — uses IF NOT EXISTS.
 *  Tables:
 *    • fir_records    — First Information Reports (core crime data)
 *    • suspects       — Known suspects / persons of interest
 *    • fir_suspects   — Many-to-many link between FIRs and suspects
 *    • conversations  — Chat history for the AI assistant
 *    • users          — Platform users (officers, analysts, admins)
 * ═══════════════════════════════════════════════════════════════════════════════ */
function initializeDb() {
    const db = getDb();

    /* ── FIR Records ──────────────────────────────────────────────────────── */
    db.exec(`
        CREATE TABLE IF NOT EXISTS fir_records (
            fir_id          TEXT PRIMARY KEY,
            fir_number      TEXT UNIQUE,
            district        TEXT NOT NULL,
            police_station  TEXT NOT NULL,
            fir_date        TEXT NOT NULL,
            crime_type      TEXT NOT NULL,
            crime_subtype   TEXT,
            status          TEXT DEFAULT 'Open',
            severity        TEXT DEFAULT 'Medium',
            victim_name     TEXT,
            victim_age      INTEGER,
            victim_gender   TEXT,
            location_area   TEXT,
            location_lat    REAL,
            location_lng    REAL,
            description     TEXT,
            created_at      TEXT DEFAULT (datetime('now'))
        )
    `);

    /* ── Suspects ─────────────────────────────────────────────────────────── */
    db.exec(`
        CREATE TABLE IF NOT EXISTS suspects (
            suspect_id      TEXT PRIMARY KEY,
            name            TEXT NOT NULL,
            alias           TEXT,
            age             INTEGER,
            gender          TEXT,
            address         TEXT,
            district        TEXT,
            repeat_offender INTEGER DEFAULT 0,
            total_cases     INTEGER DEFAULT 0,
            risk_score      REAL DEFAULT 0,
            modus_operandi  TEXT,
            created_at      TEXT DEFAULT (datetime('now'))
        )
    `);

    /* ── FIR ↔ Suspect Link Table ─────────────────────────────────────────── */
    db.exec(`
        CREATE TABLE IF NOT EXISTS fir_suspects (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            fir_id      TEXT NOT NULL,
            suspect_id  TEXT NOT NULL,
            role        TEXT DEFAULT 'Accused',
            FOREIGN KEY (fir_id) REFERENCES fir_records(fir_id),
            FOREIGN KEY (suspect_id) REFERENCES suspects(suspect_id)
        )
    `);

    /* ── Conversations (Chat History) ─────────────────────────────────────── */
    db.exec(`
        CREATE TABLE IF NOT EXISTS conversations (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id      TEXT NOT NULL,
            user_role       TEXT,
            user_message    TEXT,
            ai_response     TEXT,
            sql_generated   TEXT,
            confidence      REAL,
            language        TEXT DEFAULT 'en',
            timestamp       TEXT DEFAULT (datetime('now'))
        )
    `);

    /* ── Users ────────────────────────────────────────────────────────────── */
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            user_id     TEXT PRIMARY KEY,
            username    TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role        TEXT NOT NULL DEFAULT 'viewer',
            full_name   TEXT,
            district    TEXT,
            created_at  TEXT DEFAULT (datetime('now'))
        )
    `);

    /* ── Indexes for query performance ────────────────────────────────────── */
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_fir_district     ON fir_records(district);
        CREATE INDEX IF NOT EXISTS idx_fir_crime_type   ON fir_records(crime_type);
        CREATE INDEX IF NOT EXISTS idx_fir_date         ON fir_records(fir_date);
        CREATE INDEX IF NOT EXISTS idx_fir_status       ON fir_records(status);
        CREATE INDEX IF NOT EXISTS idx_suspect_district  ON suspects(district);
        CREATE INDEX IF NOT EXISTS idx_suspect_repeat    ON suspects(repeat_offender);
        CREATE INDEX IF NOT EXISTS idx_conv_session      ON conversations(session_id);
        CREATE INDEX IF NOT EXISTS idx_fir_suspects_fir  ON fir_suspects(fir_id);
        CREATE INDEX IF NOT EXISTS idx_fir_suspects_sus  ON fir_suspects(suspect_id);
    `);

    console.log('  ✔ Database tables initialized successfully');
    return db;
}

/* ═══════════════════════════════════════════════════════════════════════════════
 *  closeDb() — Gracefully close the database connection
 * ═══════════════════════════════════════════════════════════════════════════════ */
function closeDb() {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
        console.log('  ✔ Database connection closed');
    }
}

module.exports = { getDb, initializeDb, closeDb };
