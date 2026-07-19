const initSqlJs = require('sql.js');
const path = require('path');
const os = require('os');

const DB_PATH = process.env.X_ZOHO_CATALYST_LISTEN_PORT
    ? path.join(os.tmpdir(), 'ksp_crime.db')
    : path.join(__dirname, 'ksp_crime.db');

let dbInstance = null;

class DbWrapper {
    constructor(db) {
        this.db = db;
    }

    _formatSql(sql) {
        // Convert @param to $param
        return sql.replace(/@(\w+)/g, '$$$1');
    }

    _formatParams(params) {
        if (params === undefined || params === null) return {};
        if (typeof params !== 'object') return [params];
        if (Array.isArray(params)) return params;
        
        const formatted = {};
        for (const [key, value] of Object.entries(params)) {
            const newKey = key.startsWith('$') || key.startsWith(':') ? key : '$' + key;
            formatted[newKey] = value;
        }
        return formatted;
    }

    prepare(sql) {
        const formattedSql = this._formatSql(sql);
        const self = this;
        
        return {
            all: (params) => {
                const stmt = self.db.prepare(formattedSql);
                try {
                    stmt.bind(self._formatParams(params));
                    const results = [];
                    while (stmt.step()) {
                        results.push(stmt.getAsObject());
                    }
                    return results;
                } finally {
                    stmt.free();
                }
            },
            get: (params) => {
                const stmt = self.db.prepare(formattedSql);
                try {
                    stmt.bind(self._formatParams(params));
                    if (stmt.step()) {
                        return stmt.getAsObject();
                    }
                    return undefined;
                } finally {
                    stmt.free();
                }
            },
            run: (params) => {
                const stmt = self.db.prepare(formattedSql);
                try {
                    stmt.run(self._formatParams(params));
                    return { changes: self.db.getRowsModified() };
                } finally {
                    stmt.free();
                }
            }
        };
    }

    exec(sql) {
        this.db.exec(sql);
    }

    pragma(str) {
        this.db.exec(`PRAGMA ${str}`);
    }

    transaction(fn) {
        return (...args) => {
            this.exec('BEGIN TRANSACTION');
            try {
                const result = fn(...args);
                this.exec('COMMIT');
                return result;
            } catch (err) {
                this.exec('ROLLBACK');
                throw err;
            }
        };
    }

    close() {
        this.db.close();
    }
}

function getDb() {
    if (!dbInstance) {
        throw new Error('Database not initialized. Call initializeDb() first.');
    }
    return dbInstance;
}

async function initializeDb() {
    if (dbInstance) {
        return dbInstance;
    }

    const SQL = await initSqlJs();
    // Use an in-memory database as requested, DB_PATH is kept for env consistency
    const db = new SQL.Database();
    dbInstance = new DbWrapper(db);

    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');

    dbInstance.exec(`
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
        );

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
        );

        CREATE TABLE IF NOT EXISTS fir_suspects (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            fir_id      TEXT NOT NULL,
            suspect_id  TEXT NOT NULL,
            role        TEXT DEFAULT 'Accused',
            FOREIGN KEY (fir_id) REFERENCES fir_records(fir_id),
            FOREIGN KEY (suspect_id) REFERENCES suspects(suspect_id)
        );

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
        );

        CREATE TABLE IF NOT EXISTS users (
            user_id     TEXT PRIMARY KEY,
            username    TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role        TEXT NOT NULL DEFAULT 'viewer',
            full_name   TEXT,
            district    TEXT,
            created_at  TEXT DEFAULT (datetime('now'))
        );

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
    return dbInstance;
}

function closeDb() {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
        console.log('  ✔ Database connection closed');
    }
}

module.exports = { getDb, initializeDb, closeDb };
