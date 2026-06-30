/* ═══════════════════════════════════════════════════════════════════════════════
 *  KSP CRIME DATABASE — Seed Data Generator
 * ═══════════════════════════════════════════════════════════════════════════════
 *  Populates the database with realistic mock data for Karnataka state.
 *  
 *  Generates:
 *    • 500+ FIR records (2022–2026)
 *    • 150+ suspects with Indian names
 *    • FIR ↔ Suspect links with network connections
 *    • 4 demo user accounts
 *    • 31 Karnataka districts with real police stations
 *
 *  Run:  node seed-data.js
 * ═══════════════════════════════════════════════════════════════════════════════ */

const { v4: uuidv4 } = require('uuid');
const { getDb, initializeDb, closeDb } = require('./database');

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║   KSP Crime Database — Seed Data Generator              ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

/* ═══════════════════════════════════════════════════════════════════════════════
 *  REFERENCE DATA — Karnataka Districts, Stations, Names, Crime Types
 * ═══════════════════════════════════════════════════════════════════════════════ */

/* ── All 31 Karnataka Districts with coordinates & police stations ────────── */
const DISTRICTS = [
    { name: 'Bengaluru Urban',   lat: 12.9716, lng: 77.5946, stations: ['Cubbon Park PS', 'Whitefield PS', 'Koramangala PS', 'HSR Layout PS', 'Indiranagar PS', 'Jayanagar PS', 'Marathahalli PS', 'Electronic City PS', 'Yelahanka PS', 'Basavanagudi PS'] },
    { name: 'Bengaluru Rural',   lat: 13.1986, lng: 77.7066, stations: ['Nelamangala PS', 'Devanahalli PS', 'Doddaballapur PS', 'Hosakote PS'] },
    { name: 'Mysuru',            lat: 12.2958, lng: 76.6394, stations: ['Devaraja PS', 'Nazarbad PS', 'Lashkar PS', 'Udayagiri PS', 'Kuvempunagar PS', 'Jayalakshmipuram PS'] },
    { name: 'Dakshina Kannada',  lat: 12.9141, lng: 74.8560, stations: ['Mangaluru North PS', 'Mangaluru South PS', 'Pandeshwar PS', 'Barke PS', 'Kankanady PS', 'Surathkal PS'] },
    { name: 'Dharwad',            lat: 15.4589, lng: 75.0078, stations: ['Dharwad PS', 'Hubballi PS', 'Alnavar PS', 'Keshwapur PS', 'Gokul Road PS', 'Vidyanagar PS'] },
    { name: 'Belagavi',          lat: 15.8497, lng: 74.4977, stations: ['Tilakwadi PS', 'Shahpur PS', 'Market PS', 'Camp PS', 'Udyambag PS'] },
    { name: 'Kalaburagi',        lat: 17.3297, lng: 76.8343, stations: ['Brahmapur PS', 'Chowk PS', 'Maidalgatti PS', 'Jeevan Bhima Nagar PS'] },
    { name: 'Ballari',           lat: 15.1394, lng: 76.9214, stations: ['Ballari Town PS', 'Cowl Bazaar PS', 'Gandhinagar PS'] },
    { name: 'Tumakuru',          lat: 13.3379, lng: 77.1173, stations: ['Tumakuru Town PS', 'SS Puram PS', 'Kyathasandra PS'] },
    { name: 'Shivamogga',        lat: 13.9299, lng: 75.5681, stations: ['Shivamogga Town PS', 'Doddapete PS', 'Sagar PS'] },
    { name: 'Davanagere',        lat: 14.4644, lng: 75.9218, stations: ['Davanagere PS', 'Harihar PS', 'Hadadi PS'] },
    { name: 'Raichur',           lat: 16.2076, lng: 77.3463, stations: ['Raichur PS', 'Manvi PS', 'Sindhanur PS'] },
    { name: 'Vijayapura',        lat: 16.8302, lng: 75.7100, stations: ['Vijayapura Town PS', 'Babaleshwar PS', 'Indi PS'] },
    { name: 'Hassan',            lat: 13.0068, lng: 76.1004, stations: ['Hassan Town PS', 'Arsikere PS', 'Belur PS'] },
    { name: 'Chitradurga',       lat: 14.2226, lng: 76.3987, stations: ['Chitradurga PS', 'Hiriyur PS', 'Challakere PS'] },
    { name: 'Udupi',             lat: 13.3409, lng: 74.7421, stations: ['Udupi Town PS', 'Manipal PS', 'Kundapur PS'] },
    { name: 'Mandya',            lat: 12.5244, lng: 76.8958, stations: ['Mandya Town PS', 'Maddur PS', 'Srirangapatna PS'] },
    { name: 'Kodagu',            lat: 12.4244, lng: 75.7382, stations: ['Madikeri PS', 'Virajpet PS', 'Somwarpet PS'] },
    { name: 'Chikkamagaluru',    lat: 13.3161, lng: 75.7720, stations: ['Chikmagalur Town PS', 'Kadur PS', 'Mudigere PS'] },
    { name: 'Chamarajanagar',    lat: 11.9236, lng: 76.9398, stations: ['Chamarajanagar PS', 'Kollegal PS', 'Gundlupet PS'] },
    { name: 'Bagalkote',          lat: 16.1691, lng: 75.6615, stations: ['Bagalkote PS', 'Badami PS', 'Jamkhandi PS'] },
    { name: 'Koppal',            lat: 15.3507, lng: 76.1547, stations: ['Koppal PS', 'Gangavathi PS', 'Kushtagi PS'] },
    { name: 'Gadag',             lat: 15.4166, lng: 75.6292, stations: ['Gadag PS', 'Nargund PS', 'Ron PS'] },
    { name: 'Ramanagara',        lat: 12.7159, lng: 77.2810, stations: ['Ramanagara PS', 'Channapatna PS', 'Kanakapura PS'] },
    { name: 'Haveri',            lat: 14.7951, lng: 75.3989, stations: ['Haveri PS', 'Ranibennur PS', 'Byadagi PS'] },
    { name: 'Yadgir',            lat: 16.7604, lng: 77.1381, stations: ['Yadgir PS', 'Shorapur PS', 'Shahpur PS'] },
    { name: 'Bidar',             lat: 17.9104, lng: 77.5199, stations: ['Bidar Town PS', 'Basavakalyan PS', 'Bhalki PS'] },
    { name: 'Chikkaballapura',    lat: 13.4355, lng: 77.7315, stations: ['Chikkaballapur PS', 'Sidlaghatta PS', 'Gowribidanur PS'] },
    { name: 'Kolar',             lat: 13.1360, lng: 78.1292, stations: ['Kolar PS', 'KGF PS', 'Mulbagal PS', 'Bangarpet PS'] },
    { name: 'Uttara Kannada',    lat: 14.7937, lng: 74.1297, stations: ['Karwar PS', 'Sirsi PS', 'Honnavar PS', 'Ankola PS'] },
    { name: 'Vijayanagara',      lat: 15.2689, lng: 76.3909, stations: ['Hospet Town PS', 'Hagari Bommanahalli PS', 'Kampli PS', 'Kudligi PS'] }
];

/* ── Crime Types with Subtypes ────────────────────────────────────────────── */
const CRIME_TYPES = [
    { type: 'Murder',              subtypes: ['Premeditated', 'Crime of Passion', 'Gang Related', 'Honor Killing', 'Contract Killing'] },
    { type: 'Theft',               subtypes: ['Pickpocketing', 'Shoplifting', 'House Break-in', 'ATM Theft', 'Metal Theft'] },
    { type: 'Robbery',             subtypes: ['Armed Robbery', 'Street Robbery', 'Bank Robbery', 'Highway Robbery'] },
    { type: 'Chain Snatching',     subtypes: ['Bike-borne', 'On Foot', 'Auto Rickshaw'] },
    { type: 'Burglary',            subtypes: ['Residential', 'Commercial', 'Office Break-in'] },
    { type: 'Cyber Crime',         subtypes: ['Online Fraud', 'Phishing', 'Identity Theft', 'Ransomware', 'Social Media Fraud', 'UPI Fraud'] },
    { type: 'Kidnapping',          subtypes: ['Ransom', 'Child Kidnapping', 'Elopement', 'Human Trafficking'] },
    { type: 'Assault',             subtypes: ['Aggravated', 'Simple', 'Road Rage', 'Mob Violence'] },
    { type: 'Drug Trafficking',    subtypes: ['Ganja', 'Cocaine', 'Synthetic Drugs', 'Prescription Drugs'] },
    { type: 'Domestic Violence',   subtypes: ['Physical Abuse', 'Dowry Harassment', 'Cruelty by Husband'] },
    { type: 'Fraud',               subtypes: ['Financial Fraud', 'Real Estate Fraud', 'Insurance Fraud', 'Cheating', 'Ponzi Scheme'] },
    { type: 'Vehicle Theft',       subtypes: ['Two-Wheeler', 'Four-Wheeler', 'Auto Rickshaw', 'Commercial Vehicle'] },
    { type: 'Sexual Harassment',   subtypes: ['Workplace', 'Public Place', 'Stalking', 'Eve Teasing'] },
    { type: 'Arson',               subtypes: ['Property', 'Vehicle', 'Forest Fire', 'Communal'] },
    { type: 'Extortion',           subtypes: ['Threats', 'Blackmail', 'Protection Money', 'Cyber Extortion'] },
    { type: 'Forgery',             subtypes: ['Document Forgery', 'Currency', 'Cheque Forgery'] },
    { type: 'Rioting',             subtypes: ['Communal', 'Political', 'Student Agitation'] }
];

/* ── Indian Names (Karnataka region) ──────────────────────────────────────── */
const MALE_FIRST_NAMES = [
    'Rajesh', 'Suresh', 'Mahesh', 'Ramesh', 'Venkatesh', 'Srinivas', 'Manjunath',
    'Basavaraj', 'Siddaraju', 'Nagaraj', 'Prakash', 'Santosh', 'Deepak', 'Arun',
    'Vijay', 'Kumar', 'Ganesh', 'Ravi', 'Mohan', 'Sunil', 'Anand', 'Manoj',
    'Naveen', 'Kiran', 'Prasad', 'Harish', 'Girish', 'Dinesh', 'Umesh', 'Mukesh',
    'Ashok', 'Shivaraj', 'Mallikarjun', 'Channappa', 'Basappa', 'Fakeerappa',
    'Irfan', 'Saleem', 'Ahmed', 'Mohammed', 'Ibrahim', 'Yusuf', 'Altaf',
    'Shankar', 'Devendra', 'Jagadish', 'Lokesh', 'Raghavendra', 'Santhosh', 'Bharath'
];

const FEMALE_FIRST_NAMES = [
    'Lakshmi', 'Saraswati', 'Kavitha', 'Priya', 'Anitha', 'Sunitha', 'Manjula',
    'Pushpa', 'Geetha', 'Savithri', 'Rekha', 'Meena', 'Suma', 'Divya', 'Sowmya',
    'Roopa', 'Shilpa', 'Pooja', 'Asha', 'Nandini', 'Bhavya', 'Swathi', 'Pallavi',
    'Rashmi', 'Deepa', 'Latha', 'Padma', 'Vasanthi', 'Jayashree', 'Sharada'
];

const LAST_NAMES = [
    'Gowda', 'Reddy', 'Naidu', 'Shetty', 'Rao', 'Patil', 'Hegde', 'Bhat',
    'Kulkarni', 'Joshi', 'Acharya', 'Nayak', 'Sharma', 'Verma', 'Yadav',
    'Swamy', 'Kumar', 'Singh', 'Patel', 'Desai', 'Hiremath', 'Kamath',
    'Poojary', 'Bangera', 'Shenoy', 'Pai', 'Ballal', 'Kini', 'Devadiga', 'Suvarna'
];

const ALIASES = [
    'Tiger', 'Cheetah', 'Blade', 'Shadow', 'Cobra', 'Fox', 'Bull', 'Jackal',
    'Razor', 'Hawk', 'Wolf', 'Viper', 'Storm', 'Scorpion', 'Panther', 'Dragon',
    'KD', 'Don', 'Raja', 'Rowdy', 'Bullet', 'Cutter', 'Bomber', 'Mechanic'
];

const MODUS_OPERANDI = [
    'Targets isolated residences at night',
    'Uses social engineering for online scams',
    'Bike-borne snatcher operating in crowded areas',
    'Uses duplicate keys for vehicle theft',
    'Operates through a network of street-level dealers',
    'Impersonates officials for financial fraud',
    'Uses sophisticated hacking tools for cyber crimes',
    'Armed robbery with accomplices blocking escape routes',
    'Targets elderly victims at ATM centers',
    'Runs a fake investment scheme',
    'Uses stolen SIM cards for communication',
    'Cross-border smuggling via forest routes',
    'Real estate forgery using fake documents',
    'Extortion through threatening phone calls',
    'Organized chain snatching with bike relay teams',
    'Drug distribution through delivery apps',
    'Pickpocketing at bus stations and railway platforms',
    'Uses chloroform for house burglaries',
    'Social media honey trapping for blackmail',
    'Counterfeit currency distribution network'
];

/* ── Location areas within districts ──────────────────────────────────────── */
const AREAS = [
    'Main Road', 'Market Area', 'Bus Stand', 'Railway Station', 'Hospital Road',
    'College Road', 'Temple Street', 'Ring Road', 'Industrial Area', 'Residential Colony',
    'New Extension', 'Old Town', 'Garden Area', 'Lake Road', 'Highway Junction',
    'Commercial Complex', 'IT Park', 'Slum Area', 'University Campus', 'MG Road'
];

const FIR_STATUSES = ['Open', 'Under Investigation', 'Charge Sheet Filed', 'Closed', 'Referred'];
const SEVERITY_LEVELS = ['Low', 'Medium', 'High', 'Critical'];

/* ═══════════════════════════════════════════════════════════════════════════════
 *  UTILITY FUNCTIONS
 * ═══════════════════════════════════════════════════════════════════════════════ */

/** Pick a random element from an array */
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/** Random integer between min and max (inclusive) */
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

/** Random float between min and max, rounded to decimals */
function randFloat(min, max, decimals = 4) {
    return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

/** Generate a random date string between two years */
function randomDate(startYear, endYear) {
    const year = randInt(startYear, endYear);
    const month = randInt(1, 12);
    const day = randInt(1, 28); // safe for all months
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Generate a FIR number like KA/BLR/2024/001234 */
function generateFIRNumber(district, year, index) {
    const distCode = district.substring(0, 3).toUpperCase();
    return `KA/${distCode}/${year}/${String(index).padStart(4, '0')}`;
}

/** Simple hash (NOT for production — just for demo login) */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit int
    }
    return 'hash_' + Math.abs(hash).toString(16);
}

/* ═══════════════════════════════════════════════════════════════════════════════
 *  GENERATE SUSPECTS (150+)
 * ═══════════════════════════════════════════════════════════════════════════════ */
function generateSuspects() {
    const suspects = [];

    for (let i = 0; i < 160; i++) {
        const isMale = Math.random() > 0.2; // 80% male suspects
        const firstName = isMale ? pick(MALE_FIRST_NAMES) : pick(FEMALE_FIRST_NAMES);
        const lastName = pick(LAST_NAMES);
        const district = pick(DISTRICTS);
        const isRepeat = Math.random() < 0.25; // 25% are repeat offenders
        const totalCases = isRepeat ? randInt(2, 12) : randInt(0, 1);

        suspects.push({
            suspect_id: uuidv4(),
            name: `${firstName} ${lastName}`,
            alias: Math.random() < 0.35 ? `${pick(ALIASES)} ${firstName.substring(0, 3)}` : null,
            age: randInt(18, 55),
            gender: isMale ? 'Male' : 'Female',
            address: `${randInt(1, 500)}, ${pick(AREAS)}, ${district.name}`,
            district: district.name,
            repeat_offender: isRepeat ? 1 : 0,
            total_cases: totalCases,
            risk_score: isRepeat ? randFloat(5.0, 9.5, 1) : randFloat(0.5, 4.9, 1),
            modus_operandi: Math.random() < 0.6 ? pick(MODUS_OPERANDI) : null
        });
    }

    return suspects;
}

/* ═══════════════════════════════════════════════════════════════════════════════
 *  GENERATE FIR RECORDS (500+)
 * ═══════════════════════════════════════════════════════════════════════════════ */
function generateFIRs() {
    const firs = [];
    let firIndex = 1;

    for (let i = 0; i < 520; i++) {
        const district = pick(DISTRICTS);
        const station = pick(district.stations);
        const crimeEntry = pick(CRIME_TYPES);
        const year = randInt(2022, 2026);
        const isMaleVictim = Math.random() > 0.4;
        const victimFirst = isMaleVictim ? pick(MALE_FIRST_NAMES) : pick(FEMALE_FIRST_NAMES);

        // Severity is weighted by crime type
        let severity;
        if (['Murder', 'Kidnapping', 'Drug Trafficking'].includes(crimeEntry.type)) {
            severity = pick(['High', 'Critical']);
        } else if (['Robbery', 'Arson', 'Extortion', 'Sexual Harassment'].includes(crimeEntry.type)) {
            severity = pick(['Medium', 'High', 'Critical']);
        } else {
            severity = pick(SEVERITY_LEVELS);
        }

        // Status weighted — more recent = more likely open
        let status;
        if (year >= 2025) {
            status = pick(['Open', 'Open', 'Under Investigation', 'Under Investigation', 'Charge Sheet Filed']);
        } else {
            status = pick(FIR_STATUSES);
        }

        // Jitter lat/lng around district center
        const lat = district.lat + randFloat(-0.15, 0.15);
        const lng = district.lng + randFloat(-0.15, 0.15);

        firs.push({
            fir_id: uuidv4(),
            fir_number: generateFIRNumber(district.name, year, firIndex++),
            district: district.name,
            police_station: station,
            fir_date: randomDate(year, year),
            crime_type: crimeEntry.type,
            crime_subtype: pick(crimeEntry.subtypes),
            status: status,
            severity: severity,
            victim_name: `${victimFirst} ${pick(LAST_NAMES)}`,
            victim_age: randInt(8, 75),
            victim_gender: isMaleVictim ? 'Male' : 'Female',
            location_area: `${pick(AREAS)}, ${district.name}`,
            location_lat: lat,
            location_lng: lng,
            description: generateDescription(crimeEntry.type, station, district.name)
        });
    }

    return firs;
}

/** Generate a realistic FIR description */
function generateDescription(crimeType, station, district) {
    const descriptions = {
        'Murder': `A body was discovered in the jurisdiction of ${station}, ${district}. Investigation reveals signs of foul play. Forensic team dispatched.`,
        'Theft': `Complainant reported theft of valuables from their premises near ${station}, ${district}. No signs of forced entry observed.`,
        'Robbery': `Armed individuals robbed the complainant near ${station}, ${district}. Cash and jewelry worth several lakhs were taken at knifepoint.`,
        'Chain Snatching': `Bike-borne miscreants snatched a gold chain from the victim while walking near ${station}, ${district}.`,
        'Burglary': `House was broken into during the night hours in ${district}. Electronic items and cash were stolen from the premises.`,
        'Cyber Crime': `Complainant lost money through an online fraud scheme. The fraudster impersonated a bank official and obtained OTP details.`,
        'Kidnapping': `A missing person complaint was filed at ${station}. The victim was last seen near the bus stand in ${district}.`,
        'Assault': `Physical altercation reported near ${station}, ${district}. The victim sustained injuries and was admitted to the district hospital.`,
        'Drug Trafficking': `Narcotics unit conducted a raid in ${district} and seized contraband substances. Multiple suspects detained for questioning.`,
        'Domestic Violence': `Complaint of domestic abuse filed at ${station}. The complainant alleged physical and mental harassment by family members.`,
        'Fraud': `Complainant was cheated of a significant amount through a fake investment scheme operating in ${district}.`,
        'Vehicle Theft': `A vehicle was reported stolen from the parking area near ${station}, ${district}. CCTV footage being analyzed.`,
        'Sexual Harassment': `Complaint of inappropriate behavior filed at ${station}. Investigation initiated under applicable IPC sections.`,
        'Arson': `A fire was deliberately set to property in ${district}. Fire services responded and the area has been secured for investigation.`,
        'Extortion': `Complainant reported receiving threatening calls demanding money. Calls traced to a location in ${district}.`,
        'Forgery': `Fake documents were used to execute a fraudulent property transaction in ${district}. Document verification revealed discrepancies.`,
        'Rioting': `A group disturbance was reported near ${station}, ${district}. Police deployed to maintain law and order.`
    };
    return descriptions[crimeType] || `Crime incident reported at ${station}, ${district}. Investigation is underway.`;
}

/* ═══════════════════════════════════════════════════════════════════════════════
 *  LINK SUSPECTS TO FIRs (with network connections)
 * ═══════════════════════════════════════════════════════════════════════════════ */
function generateFIRSuspectLinks(firs, suspects) {
    const links = [];
    const roles = ['Accused', 'Accused', 'Accused', 'Accomplice', 'Wanted', 'Absconding'];

    // First: randomly assign 1–3 suspects to most FIRs
    for (const fir of firs) {
        const numSuspects = Math.random() < 0.15 ? 0 : randInt(1, 3); // 15% unsolved (no suspect)
        const usedSuspects = new Set();

        for (let i = 0; i < numSuspects; i++) {
            const suspect = pick(suspects);
            if (usedSuspects.has(suspect.suspect_id)) continue;
            usedSuspects.add(suspect.suspect_id);

            links.push({
                fir_id: fir.fir_id,
                suspect_id: suspect.suspect_id,
                role: pick(roles)
            });
        }
    }

    // Second: create "network clusters" — same group of suspects in multiple FIRs
    // This enables the network analysis feature
    const gangSize = 5;
    for (let gang = 0; gang < 8; gang++) {
        // Pick a small gang of suspects
        const gangMembers = [];
        for (let m = 0; m < gangSize; m++) {
            gangMembers.push(pick(suspects));
        }

        // Link them to 3–6 shared FIRs
        const sharedFIRs = randInt(3, 6);
        for (let f = 0; f < sharedFIRs; f++) {
            const fir = pick(firs);
            for (const member of gangMembers) {
                // Check if link already exists
                const exists = links.some(l => l.fir_id === fir.fir_id && l.suspect_id === member.suspect_id);
                if (!exists) {
                    links.push({
                        fir_id: fir.fir_id,
                        suspect_id: member.suspect_id,
                        role: pick(roles)
                    });
                }
            }
        }
    }

    return links;
}

/* ═══════════════════════════════════════════════════════════════════════════════
 *  DEMO USERS
 * ═══════════════════════════════════════════════════════════════════════════════ */
function generateUsers() {
    return [
        {
            user_id: uuidv4(),
            username: 'admin',
            password_hash: simpleHash('admin'),
            role: 'admin',
            full_name: 'System Administrator',
            district: 'All'
        },
        {
            user_id: uuidv4(),
            username: 'sp_blr',
            password_hash: simpleHash('police123'),
            role: 'superintendent',
            full_name: 'SP Bengaluru Urban',
            district: 'Bengaluru Urban'
        },
        {
            user_id: uuidv4(),
            username: 'inspector',
            password_hash: simpleHash('inspect123'),
            role: 'inspector',
            full_name: 'Inspector Ramachandran',
            district: 'Mysuru'
        },
        {
            user_id: uuidv4(),
            username: 'analyst',
            password_hash: simpleHash('data123'),
            role: 'analyst',
            full_name: 'Data Analyst Priya',
            district: 'All'
        }
    ];
}

/* ═══════════════════════════════════════════════════════════════════════════════
 *  MAIN SEED FUNCTION
 * ═══════════════════════════════════════════════════════════════════════════════ */
function seed() {
    const db = initializeDb();

    // Clear existing data
    console.log('  ⟳ Clearing existing data...');
    db.exec('DELETE FROM fir_suspects');
    db.exec('DELETE FROM fir_records');
    db.exec('DELETE FROM suspects');
    db.exec('DELETE FROM conversations');
    db.exec('DELETE FROM users');

    // Generate data
    console.log('  ⟳ Generating suspects...');
    const suspects = generateSuspects();

    console.log('  ⟳ Generating FIR records...');
    const firs = generateFIRs();

    console.log('  ⟳ Linking suspects to FIRs...');
    const links = generateFIRSuspectLinks(firs, suspects);

    console.log('  ⟳ Creating demo users...');
    const users = generateUsers();

    // Insert data using transactions for speed
    console.log('  ⟳ Inserting into database...\n');

    const insertSuspect = db.prepare(`
        INSERT INTO suspects (suspect_id, name, alias, age, gender, address, district, repeat_offender, total_cases, risk_score, modus_operandi)
        VALUES (@suspect_id, @name, @alias, @age, @gender, @address, @district, @repeat_offender, @total_cases, @risk_score, @modus_operandi)
    `);

    const insertFIR = db.prepare(`
        INSERT INTO fir_records (fir_id, fir_number, district, police_station, fir_date, crime_type, crime_subtype, status, severity, victim_name, victim_age, victim_gender, location_area, location_lat, location_lng, description)
        VALUES (@fir_id, @fir_number, @district, @police_station, @fir_date, @crime_type, @crime_subtype, @status, @severity, @victim_name, @victim_age, @victim_gender, @location_area, @location_lat, @location_lng, @description)
    `);

    const insertLink = db.prepare(`
        INSERT INTO fir_suspects (fir_id, suspect_id, role) VALUES (@fir_id, @suspect_id, @role)
    `);

    const insertUser = db.prepare(`
        INSERT INTO users (user_id, username, password_hash, role, full_name, district)
        VALUES (@user_id, @username, @password_hash, @role, @full_name, @district)
    `);

    // Use transaction for bulk inserts (much faster)
    const insertAll = db.transaction(() => {
        for (const s of suspects) insertSuspect.run(s);
        for (const f of firs) insertFIR.run(f);
        for (const l of links) insertLink.run(l);
        for (const u of users) insertUser.run(u);
    });

    insertAll();

    // Print summary
    const firCount = db.prepare('SELECT COUNT(*) as c FROM fir_records').get().c;
    const suspectCount = db.prepare('SELECT COUNT(*) as c FROM suspects').get().c;
    const linkCount = db.prepare('SELECT COUNT(*) as c FROM fir_suspects').get().c;
    const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const districtCount = db.prepare('SELECT COUNT(DISTINCT district) as c FROM fir_records').get().c;

    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║   Seed Complete — Summary                               ║');
    console.log('╠═══════════════════════════════════════════════════════════╣');
    console.log(`║   FIR Records:        ${String(firCount).padStart(6)}                          ║`);
    console.log(`║   Suspects:           ${String(suspectCount).padStart(6)}                          ║`);
    console.log(`║   FIR-Suspect Links:  ${String(linkCount).padStart(6)}                          ║`);
    console.log(`║   Users:              ${String(userCount).padStart(6)}                          ║`);
    console.log(`║   Districts:          ${String(districtCount).padStart(6)}                          ║`);
    console.log('╠═══════════════════════════════════════════════════════════╣');
    console.log('║   Demo Accounts:                                        ║');
    console.log('║     admin    / admin       (Full access)                 ║');
    console.log('║     sp_blr   / police123   (Superintendent)              ║');
    console.log('║     inspector/ inspect123  (Inspector)                   ║');
    console.log('║     analyst  / data123     (Data Analyst)                ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    closeDb();
}

// Run
seed();
