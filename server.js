/* ═══════════════════════════════════════════════════════════════════════════════
 *  KSP CRIME DATABASE — Express Server
 * ═══════════════════════════════════════════════════════════════════════════════
 *  Main server file. Provides REST API endpoints for:
 *    • Authentication (session-based)
 *    • Chat / Conversational AI
 *    • Dashboard statistics
 *    • Suspect management & network analysis
 *    • FIR record retrieval
 *    • Export functionality
 *
 *  Run:  node server.js
 *  Dev:  npm run dev (with nodemon)
 * ═══════════════════════════════════════════════════════════════════════════════ */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getDb, initializeDb } = require('./database');
const { processQuery } = require('./ai-engine');

const app = express();
const PORT = process.env.X_ZOHO_CATALYST_LISTEN_PORT || process.env.PORT || 3000;

/* ═══════════════════════════════════════════════════════════════════════════════
 *  MIDDLEWARE
 * ═══════════════════════════════════════════════════════════════════════════════ */
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ── Request logger ───────────────────────────────────────────────────────── */
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`  [${timestamp}] ${req.method} ${req.url}`);
    next();
});

/* ═══════════════════════════════════════════════════════════════════════════════
 *  SESSION STORE (in-memory for prototype)
 * ═══════════════════════════════════════════════════════════════════════════════
 *  Maps session tokens → user objects.
 *  In production, replace with Redis or JWT tokens.
 * ═══════════════════════════════════════════════════════════════════════════════ */
const sessions = new Map();

/** Simple hash function — must match the one in seed-data.js */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return 'hash_' + Math.abs(hash).toString(16);
}

/** Auth middleware — extracts user from session token */
function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token || !sessions.has(token)) {
        return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }
    req.user = sessions.get(token);
    next();
}

/* ═══════════════════════════════════════════════════════════════════════════════
 *  AUTH ROUTES
 * ═══════════════════════════════════════════════════════════════════════════════ */

/** POST /api/auth/login — Authenticate and return session token */
app.post('/api/auth/login', (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required.' });
        }

        const db = getDb();
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

        if (!user || user.password_hash !== simpleHash(password)) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // Create session
        const token = uuidv4();
        const sessionData = {
            user_id: user.user_id,
            username: user.username,
            role: user.role,
            full_name: user.full_name,
            district: user.district
        };
        sessions.set(token, sessionData);

        console.log(`  ✔ Login: ${user.username} (${user.role})`);

        res.json({
            success: true,
            token,
            user: sessionData
        });
    } catch (error) {
        console.error('  ✖ Login error:', error.message);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

/** GET /api/auth/me — Get current user from session */
app.get('/api/auth/me', authMiddleware, (req, res) => {
    res.json({ user: req.user });
});

/** POST /api/auth/logout — Destroy session */
app.post('/api/auth/logout', authMiddleware, (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    sessions.delete(token);
    res.json({ success: true, message: 'Logged out.' });
});

/* ═══════════════════════════════════════════════════════════════════════════════
 *  CHAT ROUTES — Conversational AI
 * ═══════════════════════════════════════════════════════════════════════════════ */

/** POST /api/chat — Main chat endpoint, calls AI engine */
app.post('/api/chat', authMiddleware, async (req, res) => {
    try {
        const { message, sessionId, language = 'en' } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message is required.' });
        }

        const db = getDb();
        const chatSessionId = sessionId || uuidv4();

        // Get conversation context (last 5 messages in this session)
        const context = db.prepare(
            'SELECT user_message, ai_response FROM conversations WHERE session_id = ? ORDER BY timestamp DESC LIMIT 5'
        ).all(chatSessionId).reverse();

        // ── Call the AI Engine ──
        const result = await processQuery({
            message: message.trim(),
            language,
            context,
            userRole: req.user.role,
            dbInstance: db
        });

        // Save conversation to database
        db.prepare(`
            INSERT INTO conversations (session_id, user_role, user_message, ai_response, sql_generated, confidence, language)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            chatSessionId,
            req.user.role,
            message.trim(),
            result.response,
            result.sql,
            result.confidence,
            language
        );

        res.json({
            sessionId: chatSessionId,
            message: result.response,
            sql: result.sql,
            confidence: result.confidence,
            visualType: result.visualType,
            visualData: result.visualData,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('  ✖ Chat error:', error.message);
        res.status(500).json({ error: 'Failed to process your query. Please try again.' });
    }
});

/** GET /api/chat/history/:sessionId — Get conversation history */
app.get('/api/chat/history/:sessionId', authMiddleware, (req, res) => {
    try {
        const db = getDb();
        const history = db.prepare(
            'SELECT user_message, ai_response, sql_generated, confidence, language, timestamp FROM conversations WHERE session_id = ? ORDER BY timestamp ASC'
        ).all(req.params.sessionId);

        res.json({ sessionId: req.params.sessionId, history });
    } catch (error) {
        console.error('  ✖ History error:', error.message);
        res.status(500).json({ error: 'Failed to retrieve chat history.' });
    }
});

/* ═══════════════════════════════════════════════════════════════════════════════
 *  STATS ROUTES — Dashboard Data
 * ═══════════════════════════════════════════════════════════════════════════════ */

/** GET /api/stats/overview — High-level dashboard stats */
app.get('/api/stats/overview', authMiddleware, (req, res) => {
    try {
        const db = getDb();

        const totalFIRs = db.prepare('SELECT COUNT(*) as count FROM fir_records').get().count;
        const totalSuspects = db.prepare('SELECT COUNT(*) as count FROM suspects').get().count;
        const totalDistricts = db.prepare('SELECT COUNT(DISTINCT district) as count FROM fir_records').get().count;
        const closedCases = db.prepare("SELECT COUNT(*) as count FROM fir_records WHERE status = 'Closed'").get().count;
        const openCases = db.prepare("SELECT COUNT(*) as count FROM fir_records WHERE status = 'Open'").get().count;
        const criticalCases = db.prepare("SELECT COUNT(*) as count FROM fir_records WHERE severity = 'Critical'").get().count;
        const repeatOffenders = db.prepare('SELECT COUNT(*) as count FROM suspects WHERE repeat_offender = 1').get().count;
        const solveRate = totalFIRs > 0 ? ((closedCases / totalFIRs) * 100).toFixed(1) : 0;

        // Recent activity (last 5)
        const recentFIRs = db.prepare(
            'SELECT fir_number, district, crime_type, fir_date, severity FROM fir_records ORDER BY fir_date DESC LIMIT 5'
        ).all();

        res.json({
            totalFIRs,
            totalSuspects,
            totalDistricts,
            openCases,
            closedCases,
            criticalCases,
            repeatOffenders,
            solveRate: parseFloat(solveRate),
            recentFIRs
        });
    } catch (error) {
        console.error('  ✖ Stats overview error:', error.message);
        res.status(500).json({ error: 'Failed to load overview stats.' });
    }
});

/** GET /api/stats/by-district — Crime count per district */
app.get('/api/stats/by-district', authMiddleware, (req, res) => {
    try {
        const db = getDb();
        const stats = db.prepare(
            'SELECT district, COUNT(*) as total_cases, SUM(CASE WHEN status = \'Closed\' THEN 1 ELSE 0 END) as closed FROM fir_records GROUP BY district ORDER BY total_cases DESC'
        ).all();

        res.json({ stats });
    } catch (error) {
        console.error('  ✖ District stats error:', error.message);
        res.status(500).json({ error: 'Failed to load district stats.' });
    }
});

/** GET /api/stats/by-type — Crime count per type */
app.get('/api/stats/by-type', authMiddleware, (req, res) => {
    try {
        const db = getDb();
        const stats = db.prepare(
            'SELECT crime_type, COUNT(*) as count FROM fir_records GROUP BY crime_type ORDER BY count DESC'
        ).all();

        res.json({ stats });
    } catch (error) {
        console.error('  ✖ Type stats error:', error.message);
        res.status(500).json({ error: 'Failed to load crime type stats.' });
    }
});

/** GET /api/stats/trends — Monthly crime trends */
app.get('/api/stats/trends', authMiddleware, (req, res) => {
    try {
        const db = getDb();
        const { district, crime_type, months = 24 } = req.query;

        let sql = 'SELECT SUBSTR(fir_date, 1, 7) as month, COUNT(*) as count FROM fir_records WHERE 1=1';
        const params = {};

        if (district)   { sql += ' AND district = @district';     params.district = district; }
        if (crime_type) { sql += ' AND crime_type = @crime_type'; params.crime_type = crime_type; }
        sql += ' GROUP BY month ORDER BY month DESC LIMIT @months';
        params.months = parseInt(months);

        const trends = db.prepare(sql).all(params);
        trends.reverse(); // chronological

        res.json({ trends });
    } catch (error) {
        console.error('  ✖ Trends error:', error.message);
        res.status(500).json({ error: 'Failed to load trends.' });
    }
});

/* ═══════════════════════════════════════════════════════════════════════════════
 *  SUSPECT ROUTES
 * ═══════════════════════════════════════════════════════════════════════════════ */

/** GET /api/suspects/:id — Get suspect details */
app.get('/api/suspects/:id', authMiddleware, (req, res) => {
    try {
        const db = getDb();
        const suspect = db.prepare('SELECT * FROM suspects WHERE suspect_id = ?').get(req.params.id);

        if (!suspect) {
            return res.status(404).json({ error: 'Suspect not found.' });
        }

        // Get associated FIRs
        const linkedFIRs = db.prepare(`
            SELECT fr.fir_number, fr.crime_type, fr.district, fr.fir_date, fr.status, fs.role
            FROM fir_suspects fs
            JOIN fir_records fr ON fs.fir_id = fr.fir_id
            WHERE fs.suspect_id = ?
            ORDER BY fr.fir_date DESC
        `).all(req.params.id);

        res.json({ suspect, linkedFIRs });
    } catch (error) {
        console.error('  ✖ Suspect detail error:', error.message);
        res.status(500).json({ error: 'Failed to load suspect details.' });
    }
});

/** GET /api/suspects/:id/network — Get connected suspects (for network graph) */
app.get('/api/suspects/:id/network', authMiddleware, (req, res) => {
    try {
        const db = getDb();

        // Find all FIRs this suspect is linked to
        const firIds = db.prepare(
            'SELECT fir_id FROM fir_suspects WHERE suspect_id = ?'
        ).all(req.params.id).map(r => r.fir_id);

        if (firIds.length === 0) {
            return res.json({ nodes: [], edges: [] });
        }

        // Find all other suspects linked to those same FIRs
        const placeholders = firIds.map(() => '?').join(',');
        const connected = db.prepare(`
            SELECT DISTINCT s.suspect_id, s.name, s.alias, s.risk_score, s.repeat_offender, s.district,
                   fs.fir_id, fs.role
            FROM fir_suspects fs
            JOIN suspects s ON fs.suspect_id = s.suspect_id
            WHERE fs.fir_id IN (${placeholders})
        `).all(...firIds);

        // Build nodes and edges for network graph
        const nodesMap = new Map();
        const edges = [];

        for (const c of connected) {
            if (!nodesMap.has(c.suspect_id)) {
                nodesMap.set(c.suspect_id, {
                    id: c.suspect_id,
                    name: c.name,
                    alias: c.alias,
                    riskScore: c.risk_score,
                    isRepeat: c.repeat_offender === 1,
                    district: c.district,
                    isCentral: c.suspect_id === req.params.id
                });
            }

            // Create edges between the queried suspect and connected ones
            if (c.suspect_id !== req.params.id) {
                edges.push({
                    from: req.params.id,
                    to: c.suspect_id,
                    firId: c.fir_id,
                    role: c.role
                });
            }
        }

        res.json({
            nodes: Array.from(nodesMap.values()),
            edges
        });
    } catch (error) {
        console.error('  ✖ Network error:', error.message);
        res.status(500).json({ error: 'Failed to build suspect network.' });
    }
});

/* ═══════════════════════════════════════════════════════════════════════════════
 *  FIR ROUTES
 * ═══════════════════════════════════════════════════════════════════════════════ */

/** GET /api/fir/:id — Get FIR details with linked suspects */
app.get('/api/fir/:id', authMiddleware, (req, res) => {
    try {
        const db = getDb();
        const fir = db.prepare('SELECT * FROM fir_records WHERE fir_id = ?').get(req.params.id);

        if (!fir) {
            return res.status(404).json({ error: 'FIR not found.' });
        }

        // Get linked suspects
        const linkedSuspects = db.prepare(`
            SELECT s.suspect_id, s.name, s.alias, s.age, s.gender, s.risk_score, s.repeat_offender, fs.role
            FROM fir_suspects fs
            JOIN suspects s ON fs.suspect_id = s.suspect_id
            WHERE fs.fir_id = ?
        `).all(req.params.id);

        res.json({ fir, linkedSuspects });
    } catch (error) {
        console.error('  ✖ FIR detail error:', error.message);
        res.status(500).json({ error: 'Failed to load FIR details.' });
    }
});

/* ═══════════════════════════════════════════════════════════════════════════════
 *  EXPORT ROUTES
 * ═══════════════════════════════════════════════════════════════════════════════ */

/** GET /api/export/pdf/:sessionId — Get chat history data for export */
app.get('/api/export/pdf/:sessionId', authMiddleware, (req, res) => {
    try {
        const db = getDb();
        const history = db.prepare(
            'SELECT user_message, ai_response, sql_generated, confidence, timestamp FROM conversations WHERE session_id = ? ORDER BY timestamp ASC'
        ).all(req.params.sessionId);

        if (history.length === 0) {
            return res.status(404).json({ error: 'No conversation found for this session.' });
        }

        // Return structured data for frontend to render/export
        res.json({
            sessionId: req.params.sessionId,
            exportDate: new Date().toISOString(),
            totalMessages: history.length,
            conversation: history.map((h, i) => ({
                turn: i + 1,
                question: h.user_message,
                answer: h.ai_response,
                sql: h.sql_generated,
                confidence: h.confidence,
                time: h.timestamp
            }))
        });
    } catch (error) {
        console.error('  ✖ Export error:', error.message);
        res.status(500).json({ error: 'Failed to export conversation.' });
    }
});

/* ═══════════════════════════════════════════════════════════════════════════════
 *  CATCH-ALL — Serve frontend for any unmatched route (SPA support)
 * ═══════════════════════════════════════════════════════════════════════════════ */
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ═══════════════════════════════════════════════════════════════════════════════
 *  SERVER START
 * ═══════════════════════════════════════════════════════════════════════════════ */
async function startServer() {
    try {
        // Initialize database
        console.log('\n╔═══════════════════════════════════════════════════════════╗');
        console.log('║   KSP Crime Database — Conversational AI Platform       ║');
        console.log('╚═══════════════════════════════════════════════════════════╝\n');

        console.log('  ⟳ Initializing database...');
        await initializeDb();

        // Verify data exists
        const db = getDb();
        let firCount = 0;
        try {
            firCount = db.prepare('SELECT COUNT(*) as c FROM fir_records').get().c;
        } catch (e) {
            console.log('  ⚠ Database tables not initialized.');
        }

        if (firCount === 0) {
            console.log('  ⚠ No data found. Seeding database automatically...');
            try {
                const { seed } = require('./seed-data');
                await seed();
                const newDb = getDb();
                const newCount = newDb.prepare('SELECT COUNT(*) as c FROM fir_records').get().c;
                console.log(`  ✔ Database seeded successfully: ${newCount} FIR records`);
            } catch (err) {
                console.error('  ✖ Auto-seeding failed:', err.message);
                console.error(err.stack);
            }
        } else {
            console.log(`  ✔ Database loaded: ${firCount} FIR records`);
        }

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`  ✔ Server running on http://0.0.0.0:${PORT}`);
        });
    } catch (e) {
        // Fallback server to show the error on Catalyst
        const fallbackApp = express();
        fallbackApp.all('*', (req, res) => {
            res.status(200).send(`Startup Error: ${e.message}\n\nStack:\n${e.stack}`);
        });
        fallbackApp.listen(PORT, '0.0.0.0', () => {
            console.log(`Fallback error server running on port ${PORT}`);
        });
    }
}

startServer();

