/* ═══════════════════════════════════════════════════════════════════════════════
 *  AI ENGINE — Integration Module
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  STATUS:  🟡 PLACEHOLDER — Replace with actual AI model
 *  OWNER:   [AI/ML Team Member]
 *  VERSION: 1.0.0 (Mock Implementation)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  🔌 INTEGRATION GUIDE
 *  ─────────────────────
 *  This module is the ONLY file the AI team needs to modify.
 *  The rest of the platform (server, database, frontend) is complete.
 *
 *  HOW IT WORKS:
 *  1. The server receives a user's natural language query via POST /api/chat
 *  2. It calls processQuery() from THIS module
 *  3. processQuery() should:
 *     a. Parse the natural language → understand intent
 *     b. Generate a SQL query (or use an LLM to generate one)
 *     c. Execute the SQL against the provided dbInstance
 *     d. Format the results into a human-readable response
 *  4. Return the structured result object
 *
 *  INPUT (what you receive):
 *  ┌──────────────────────────────────────────────────────────────────────┐
 *  │  {                                                                  │
 *  │    message:    "how many thefts in Bengaluru this year?",           │
 *  │    language:   "en",           // 'en' | 'kn' (Kannada)            │
 *  │    context:    [...],          // Previous messages in session      │
 *  │    userRole:   "inspector",    // User's role for access control    │
 *  │    dbInstance: <Database>      // better-sqlite3 instance (ready)   │
 *  │  }                                                                  │
 *  └──────────────────────────────────────────────────────────────────────┘
 *
 *  OUTPUT (what you must return):
 *  ┌──────────────────────────────────────────────────────────────────────┐
 *  │  {                                                                  │
 *  │    response:    "There were 42 theft cases in Bengaluru...",        │
 *  │    sql:         "SELECT COUNT(*) FROM fir_records WHERE ...",       │
 *  │    confidence:  0.92,          // 0.0 to 1.0                       │
 *  │    visualType:  "bar",         // bar | pie | table | line | map   │
 *  │    visualData:  { labels, datasets }  // Chart.js compatible       │
 *  │  }                                                                  │
 *  └──────────────────────────────────────────────────────────────────────┘
 *
 *  DATABASE SCHEMA (for reference):
 *  ─────────────────────────────────
 *  fir_records:   fir_id, fir_number, district, police_station, fir_date,
 *                 crime_type, crime_subtype, status, severity,
 *                 victim_name, victim_age, victim_gender,
 *                 location_area, location_lat, location_lng, description
 *
 *  suspects:      suspect_id, name, alias, age, gender, address, district,
 *                 repeat_offender, total_cases, risk_score, modus_operandi
 *
 *  fir_suspects:  id, fir_id, suspect_id, role
 *
 *  TIPS FOR THE AI TEAM:
 *  ─────────────────────
 *  • Use dbInstance.prepare(sql).all() for SELECT queries
 *  • Use dbInstance.prepare(sql).get() for single-row results
 *  • All SQL must be READ-ONLY (no INSERT/UPDATE/DELETE)
 *  • Wrap SQL execution in try/catch to handle bad queries gracefully
 *  • The visualType hint tells the frontend what chart to render
 *  • Return confidence < 0.5 if you're unsure about the query
 *
 * ═══════════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════════
 *  DISTRICT NAME MAPPING — for fuzzy matching user input
 * ═══════════════════════════════════════════════════════════════════════════════ */
const DISTRICT_ALIASES = {
    'bangalore':      'Bengaluru Urban',
    'bengaluru':      'Bengaluru Urban',
    'blr':            'Bengaluru Urban',
    'bengaluru urban': 'Bengaluru Urban',
    'bengaluru rural': 'Bengaluru Rural',
    'mysore':         'Mysuru',
    'mysuru':         'Mysuru',
    'mangalore':      'Mangaluru',
    'mangaluru':      'Mangaluru',
    'hubli':          'Hubballi-Dharwad',
    'hubballi':       'Hubballi-Dharwad',
    'dharwad':        'Dharwad',
    'belgaum':        'Belagavi',
    'belagavi':       'Belagavi',
    'gulbarga':       'Kalaburagi',
    'kalaburagi':     'Kalaburagi',
    'bellary':        'Ballari',
    'ballari':        'Ballari',
    'tumkur':         'Tumakuru',
    'tumakuru':       'Tumakuru',
    'shimoga':        'Shivamogga',
    'shivamogga':     'Shivamogga',
    'davangere':      'Davangere',
    'raichur':        'Raichur',
    'bijapur':        'Vijayapura',
    'vijayapura':     'Vijayapura',
    'hassan':         'Hassan',
    'chitradurga':    'Chitradurga',
    'udupi':          'Udupi',
    'mandya':         'Mandya',
    'coorg':          'Kodagu',
    'kodagu':         'Kodagu',
    'chikmagalur':    'Chikmagalur',
    'chamarajanagar': 'Chamarajanagar',
    'bagalkot':       'Bagalkot',
    'koppal':         'Koppal',
    'gadag':          'Gadag',
    'ramanagara':     'Ramanagara',
    'haveri':         'Haveri',
    'yadgir':         'Yadgir',
    'bidar':          'Bidar',
    'chikkaballapur': 'Chikkaballapur',
    'kolar':          'Kolar',
    'uttara kannada':  'Uttara Kannada',
    'karwar':         'Uttara Kannada'
};

/* ═══════════════════════════════════════════════════════════════════════════════
 *  CRIME TYPE ALIASES — for matching user input to DB values
 * ═══════════════════════════════════════════════════════════════════════════════ */
const CRIME_ALIASES = {
    'murder':           'Murder',
    'homicide':         'Murder',
    'killing':          'Murder',
    'theft':            'Theft',
    'stealing':         'Theft',
    'stolen':           'Theft',
    'robbery':          'Robbery',
    'robbed':           'Robbery',
    'chain snatching':  'Chain Snatching',
    'snatching':        'Chain Snatching',
    'burglary':         'Burglary',
    'break-in':         'Burglary',
    'break in':         'Burglary',
    'cyber':            'Cyber Crime',
    'cyber crime':      'Cyber Crime',
    'online fraud':     'Cyber Crime',
    'hacking':          'Cyber Crime',
    'kidnapping':       'Kidnapping',
    'kidnap':           'Kidnapping',
    'abduction':        'Kidnapping',
    'assault':          'Assault',
    'attack':           'Assault',
    'beating':          'Assault',
    'drugs':            'Drug Trafficking',
    'drug':             'Drug Trafficking',
    'narcotics':        'Drug Trafficking',
    'domestic violence': 'Domestic Violence',
    'domestic':         'Domestic Violence',
    'dowry':            'Domestic Violence',
    'fraud':            'Fraud',
    'cheating':         'Fraud',
    'scam':             'Fraud',
    'vehicle theft':    'Vehicle Theft',
    'car theft':        'Vehicle Theft',
    'bike theft':       'Vehicle Theft',
    'harassment':       'Sexual Harassment',
    'sexual harassment': 'Sexual Harassment',
    'stalking':         'Sexual Harassment',
    'arson':            'Arson',
    'fire':             'Arson',
    'extortion':        'Extortion',
    'blackmail':        'Extortion',
    'forgery':          'Forgery',
    'rioting':          'Rioting',
    'riot':             'Rioting'
};

/* ═══════════════════════════════════════════════════════════════════════════════
 *  HELPER: Detect district name from user message
 * ═══════════════════════════════════════════════════════════════════════════════ */
function detectDistrict(message) {
    const lower = message.toLowerCase();
    for (const [alias, official] of Object.entries(DISTRICT_ALIASES)) {
        if (lower.includes(alias)) return official;
    }
    return null;
}

/* ═══════════════════════════════════════════════════════════════════════════════
 *  HELPER: Detect crime type from user message
 * ═══════════════════════════════════════════════════════════════════════════════ */
function detectCrimeType(message) {
    const lower = message.toLowerCase();
    // Sort by key length descending so "chain snatching" matches before "snatching"
    const sortedAliases = Object.entries(CRIME_ALIASES).sort((a, b) => b[0].length - a[0].length);
    for (const [alias, official] of sortedAliases) {
        if (lower.includes(alias)) return official;
    }
    return null;
}

/* ═══════════════════════════════════════════════════════════════════════════════
 *  HELPER: Detect year from user message
 * ═══════════════════════════════════════════════════════════════════════════════ */
function detectYear(message) {
    const match = message.match(/\b(202[0-9])\b/);
    if (match) return match[1];
    if (message.toLowerCase().includes('this year')) return '2026';
    if (message.toLowerCase().includes('last year')) return '2025';
    return null;
}

/* ═══════════════════════════════════════════════════════════════════════════════
 *  HELPER: Detect suspect name from user message
 * ═══════════════════════════════════════════════════════════════════════════════ */
function detectSuspectName(message) {
    const lower = message.toLowerCase();
    const patterns = [
        /suspect\s+(?:named?\s+)?([a-z]+(?:\s+[a-z]+)?)/i,
        /about\s+([a-z]+(?:\s+[a-z]+)?)\s+suspect/i,
        /find\s+([a-z]+(?:\s+[a-z]+)?)/i,
        /search\s+(?:for\s+)?([a-z]+(?:\s+[a-z]+)?)/i,
        /who\s+is\s+([a-z]+(?:\s+[a-z]+)?)/i,
        /details?\s+(?:of|on|about)\s+([a-z]+(?:\s+[a-z]+)?)/i
    ];

    for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match) {
            const name = match[1].trim();
            // Filter out common non-name words
            const stopWords = ['the', 'a', 'all', 'any', 'crime', 'crimes', 'fir', 'firs', 'case', 'cases', 'data', 'stats'];
            if (!stopWords.includes(name.toLowerCase())) return name;
        }
    }
    return null;
}

/* ═══════════════════════════════════════════════════════════════════════════════
 *  QUERY HANDLERS — Each handles a specific type of user intent
 * ═══════════════════════════════════════════════════════════════════════════════
 *  These are the MOCK implementations. The AI team will replace the entire
 *  processQuery function with their NLP/LLM-powered version.
 * ═══════════════════════════════════════════════════════════════════════════════ */

/** Handle: "how many [crime] in [district]" */
function handleCrimeCount(db, crimeType, district, year) {
    let sql = 'SELECT COUNT(*) as count FROM fir_records WHERE 1=1';
    const params = {};

    if (crimeType) { sql += ' AND crime_type = @crimeType'; params.crimeType = crimeType; }
    if (district)  { sql += ' AND district = @district';     params.district = district; }
    if (year)      { sql += " AND fir_date LIKE @year || '%'"; params.year = year; }

    const result = db.prepare(sql).get(params);
    const count = result.count;

    // Build response text
    let response = `Found **${count}** `;
    response += crimeType ? `${crimeType} case(s)` : 'crime case(s)';
    if (district) response += ` in **${district}**`;
    if (year) response += ` for the year **${year}**`;
    response += '.';

    // Get breakdown if no crime type specified
    let visualData = null;
    let visualType = 'bar';

    if (!crimeType && district) {
        const breakdown = db.prepare(
            'SELECT crime_type, COUNT(*) as count FROM fir_records WHERE district = @district GROUP BY crime_type ORDER BY count DESC'
        ).all({ district });
        visualData = {
            labels: breakdown.map(r => r.crime_type),
            datasets: [{ label: `Crimes in ${district}`, data: breakdown.map(r => r.count) }]
        };
    } else if (crimeType && !district) {
        const breakdown = db.prepare(
            'SELECT district, COUNT(*) as count FROM fir_records WHERE crime_type = @crimeType GROUP BY district ORDER BY count DESC LIMIT 10'
        ).all({ crimeType });
        visualData = {
            labels: breakdown.map(r => r.district),
            datasets: [{ label: `${crimeType} by District`, data: breakdown.map(r => r.count) }]
        };
    }

    return {
        response,
        sql,
        confidence: 0.85,
        visualType,
        visualData
    };
}

/** Handle: "show me suspect [name]" */
function handleSuspectLookup(db, name) {
    const sql = "SELECT * FROM suspects WHERE LOWER(name) LIKE '%' || @name || '%' OR LOWER(alias) LIKE '%' || @name || '%'";
    const results = db.prepare(sql).all({ name: name.toLowerCase() });

    if (results.length === 0) {
        return {
            response: `No suspects found matching "**${name}**". Try searching with a different name or alias.`,
            sql,
            confidence: 0.7,
            visualType: 'table',
            visualData: null
        };
    }

    let response = `Found **${results.length}** suspect(s) matching "**${name}**":\n\n`;
    for (const s of results.slice(0, 5)) {
        response += `• **${s.name}**`;
        if (s.alias) response += ` (alias: ${s.alias})`;
        response += ` — Age: ${s.age}, District: ${s.district}`;
        if (s.repeat_offender) response += ` ⚠️ REPEAT OFFENDER (${s.total_cases} cases)`;
        response += `, Risk Score: ${s.risk_score}/10\n`;
    }
    if (results.length > 5) response += `\n... and ${results.length - 5} more.`;

    return {
        response,
        sql,
        confidence: 0.82,
        visualType: 'table',
        visualData: { rows: results.slice(0, 10) }
    };
}

/** Handle: "crime stats for [district]" */
function handleDistrictStats(db, district) {
    const sql = `
        SELECT 
            COUNT(*) as total_cases,
            SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) as closed,
            SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END) as open_cases,
            SUM(CASE WHEN severity = 'Critical' THEN 1 ELSE 0 END) as critical,
            SUM(CASE WHEN severity = 'High' THEN 1 ELSE 0 END) as high
        FROM fir_records WHERE district = @district
    `;
    const stats = db.prepare(sql).get({ district });

    if (!stats || stats.total_cases === 0) {
        return {
            response: `No crime records found for **${district}**. Please check the district name.`,
            sql,
            confidence: 0.6,
            visualType: null,
            visualData: null
        };
    }

    const solveRate = stats.total_cases > 0
        ? ((stats.closed / stats.total_cases) * 100).toFixed(1)
        : 0;

    const typeBreakdown = db.prepare(
        'SELECT crime_type, COUNT(*) as count FROM fir_records WHERE district = @district GROUP BY crime_type ORDER BY count DESC'
    ).all({ district });

    let response = `📊 **Crime Statistics for ${district}**\n\n`;
    response += `• Total Cases: **${stats.total_cases}**\n`;
    response += `• Open Cases: **${stats.open_cases}**\n`;
    response += `• Closed Cases: **${stats.closed}**\n`;
    response += `• Solve Rate: **${solveRate}%**\n`;
    response += `• Critical Cases: **${stats.critical}**\n`;
    response += `• High Severity: **${stats.high}**\n\n`;
    response += `**Top Crime Types:**\n`;
    for (const t of typeBreakdown.slice(0, 5)) {
        response += `  • ${t.crime_type}: ${t.count}\n`;
    }

    return {
        response,
        sql,
        confidence: 0.9,
        visualType: 'pie',
        visualData: {
            labels: typeBreakdown.map(r => r.crime_type),
            datasets: [{ label: `Crime Types in ${district}`, data: typeBreakdown.map(r => r.count) }]
        }
    };
}

/** Handle: "latest FIRs" / "recent crimes" */
function handleRecentCrimes(db, district, crimeType, limit = 10) {
    let sql = 'SELECT fir_number, district, police_station, fir_date, crime_type, severity, status FROM fir_records WHERE 1=1';
    const params = {};

    if (district)  { sql += ' AND district = @district';     params.district = district; }
    if (crimeType) { sql += ' AND crime_type = @crimeType'; params.crimeType = crimeType; }
    sql += ' ORDER BY fir_date DESC LIMIT @limit';
    params.limit = limit;

    const results = db.prepare(sql).all(params);

    let response = `📋 **Latest ${results.length} FIR Records`;
    if (district) response += ` in ${district}`;
    if (crimeType) response += ` (${crimeType})`;
    response += `:**\n\n`;

    for (const r of results) {
        const severityIcon = r.severity === 'Critical' ? '🔴' : r.severity === 'High' ? '🟠' : r.severity === 'Medium' ? '🟡' : '🟢';
        response += `${severityIcon} **${r.fir_number}** — ${r.crime_type} | ${r.district} | ${r.fir_date} | ${r.status}\n`;
    }

    return {
        response,
        sql,
        confidence: 0.88,
        visualType: 'table',
        visualData: { rows: results }
    };
}

/** Handle: "repeat offenders" / "high risk suspects" */
function handleRepeatOffenders(db, district) {
    let sql = 'SELECT * FROM suspects WHERE repeat_offender = 1';
    const params = {};

    if (district) { sql += ' AND district = @district'; params.district = district; }
    sql += ' ORDER BY risk_score DESC LIMIT 15';

    const results = db.prepare(sql).all(params);

    let response = `⚠️ **Repeat Offenders`;
    if (district) response += ` in ${district}`;
    response += ` (${results.length} found):**\n\n`;

    for (const s of results) {
        response += `• **${s.name}**`;
        if (s.alias) response += ` ("${s.alias}")`;
        response += ` — Risk: ${s.risk_score}/10, Cases: ${s.total_cases}, District: ${s.district}\n`;
    }

    return {
        response,
        sql,
        confidence: 0.87,
        visualType: 'table',
        visualData: { rows: results }
    };
}

/** Handle: "trends" / "monthly" */
function handleTrends(db, district, crimeType) {
    let sql = `
        SELECT 
            SUBSTR(fir_date, 1, 7) as month,
            COUNT(*) as count 
        FROM fir_records WHERE 1=1
    `;
    const params = {};
    if (district)  { sql += ' AND district = @district';     params.district = district; }
    if (crimeType) { sql += ' AND crime_type = @crimeType'; params.crimeType = crimeType; }
    sql += ' GROUP BY month ORDER BY month DESC LIMIT 24';

    const results = db.prepare(sql).all(params);
    results.reverse(); // chronological order

    let response = `📈 **Crime Trends`;
    if (district) response += ` for ${district}`;
    if (crimeType) response += ` (${crimeType})`;
    response += `:**\n\n`;

    for (const r of results) {
        const bar = '█'.repeat(Math.min(r.count, 30));
        response += `${r.month}: ${bar} ${r.count}\n`;
    }

    return {
        response,
        sql,
        confidence: 0.85,
        visualType: 'line',
        visualData: {
            labels: results.map(r => r.month),
            datasets: [{ 
                label: `Crime Trend${district ? ` — ${district}` : ''}`,
                data: results.map(r => r.count)
            }]
        }
    };
}

/** Fallback: default helpful response */
function handleDefault() {
    return {
        response: `I'm the KSP Crime Database Assistant. Here's what I can help you with:\n\n` +
            `📊 **Crime Statistics**\n` +
            `  • "How many thefts in Bengaluru?"\n` +
            `  • "Crime stats for Mysuru"\n` +
            `  • "Total murders in 2024"\n\n` +
            `🔍 **Suspect Lookup**\n` +
            `  • "Show me suspect Rajesh"\n` +
            `  • "Find repeat offenders"\n` +
            `  • "High risk suspects in Mangaluru"\n\n` +
            `📋 **FIR Records**\n` +
            `  • "Latest FIRs"\n` +
            `  • "Recent crimes in Belagavi"\n\n` +
            `📈 **Trends**\n` +
            `  • "Crime trends for Bengaluru"\n` +
            `  • "Monthly trend for theft"\n\n` +
            `Try asking one of these questions!`,
        sql: null,
        confidence: 0.3,
        visualType: null,
        visualData: null
    };
}

/* ═══════════════════════════════════════════════════════════════════════════════
 *  processQuery() — THE MAIN FUNCTION
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  🔴 AI TEAM: Replace this function's BODY with your NLP/LLM logic.
 *     Keep the function signature and return format the same.
 *
 *  Current implementation: keyword-based mock that handles common queries.
 *  This lets the frontend and server work while the AI model is being built.
 *
 * ═══════════════════════════════════════════════════════════════════════════════ */
async function processQuery({ message, language = 'en', context = [], userRole = 'viewer', dbInstance }) {
    try {
        const lower = message.toLowerCase().trim();

        // ── Extract entities from the message ──
        const district  = detectDistrict(message);
        const crimeType = detectCrimeType(message);
        const year      = detectYear(message);
        const suspectName = detectSuspectName(message);

        // ── Route to the appropriate handler based on detected intent ──

        // 1. Suspect lookup
        if (suspectName && (lower.includes('suspect') || lower.includes('find') || lower.includes('search') || lower.includes('who is') || lower.includes('details'))) {
            return handleSuspectLookup(dbInstance, suspectName);
        }

        // 2. Repeat offenders
        if (lower.includes('repeat') || lower.includes('offender') || lower.includes('high risk') || lower.includes('dangerous')) {
            return handleRepeatOffenders(dbInstance, district);
        }

        // 3. Trends
        if (lower.includes('trend') || lower.includes('monthly') || lower.includes('over time') || lower.includes('pattern')) {
            return handleTrends(dbInstance, district, crimeType);
        }

        // 4. Recent / latest FIRs
        if (lower.includes('latest') || lower.includes('recent') || lower.includes('new fir') || lower.includes('last') || lower.includes('newest')) {
            return handleRecentCrimes(dbInstance, district, crimeType);
        }

        // 5. District stats
        if (district && (lower.includes('stat') || lower.includes('overview') || lower.includes('summary') || lower.includes('report'))) {
            return handleDistrictStats(dbInstance, district);
        }

        // 6. Crime count (general queries with crime type or district)
        if (crimeType || district || lower.includes('how many') || lower.includes('count') || lower.includes('total') || lower.includes('number')) {
            return handleCrimeCount(dbInstance, crimeType, district, year);
        }

        // 7. Greetings
        if (lower.match(/^(hi|hello|hey|good morning|good evening|namaste)/)) {
            return {
                response: `Hello! 👋 I'm the KSP Crime Database Assistant. I can help you query crime records, look up suspects, and analyze trends across Karnataka.\n\nWhat would you like to know?`,
                sql: null,
                confidence: 1.0,
                visualType: null,
                visualData: null
            };
        }

        // 8. Default fallback
        return handleDefault();

    } catch (error) {
        console.error('  ✖ AI Engine Error:', error.message);
        return {
            response: `I encountered an error processing your query. Please try rephrasing.\n\nError: ${error.message}`,
            sql: null,
            confidence: 0,
            visualType: null,
            visualData: null
        };
    }
}

/* ═══════════════════════════════════════════════════════════════════════════════
 *  EXPORTS
 * ═══════════════════════════════════════════════════════════════════════════════ */
module.exports = { processQuery };
