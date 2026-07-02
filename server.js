/**
 * 50ka — Simple Express backend
 *
 * Database recommendation: SQLite (via better-sqlite3)
 * — single file, zero configuration, no separate server process,
 *   tiny footprint, and more than enough for a party RSVP list.
 *
 * Run with:  node server.js
 * The site is then served at http://localhost:3000
 */

const express = require('express');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const Database = require('better-sqlite3');
const rateLimit = require('express-rate-limit');

/* ---------- Setup ---------- */
const PORT   = process.env.PORT || 3000;
const DB_DIR = path.join(__dirname, 'db');
const DB_PATH = path.join(DB_DIR, 'responses.db');
const MAX_ANSWER_TEXT_LENGTH = 300;
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 320;
const MAX_PHONE_LENGTH = 80;
const TRACKED_QUESTIONNAIRE_STEP_IDS = new Set([1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 98]);

// Ensure db/ directory exists
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR);

/* ---------- Database ---------- */
const db = new Database(DB_PATH);

function ensureResponseColumns() {
  const columns = db.prepare('PRAGMA table_info(responses)').all();
  const hasColumn = (columnName) => columns.some((column) => column.name === columnName);

  if (!hasColumn('name')) db.exec('ALTER TABLE responses ADD COLUMN name TEXT');
  if (!hasColumn('email')) db.exec('ALTER TABLE responses ADD COLUMN email TEXT');
  if (!hasColumn('phone')) db.exec('ALTER TABLE responses ADD COLUMN phone TEXT');
  if (!hasColumn('answers_json')) db.exec('ALTER TABLE responses ADD COLUMN answers_json TEXT');
}

function normalizeOptionalText(value, maxLength = MAX_ANSWER_TEXT_LENGTH) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function normalizeAnswers(answers) {
  if (!Array.isArray(answers)) return [];

  return answers
    .filter((entry) => (
      entry
      && typeof entry === 'object'
      && Number.isInteger(entry.stepId)
      && TRACKED_QUESTIONNAIRE_STEP_IDS.has(entry.stepId)
    ))
    .map((entry) => ({
      stepId: entry.stepId,
      question: normalizeOptionalText(entry.question, 200) || '',
      answer: normalizeOptionalText(entry.answer, 200) || '',
    }))
    .filter((entry) => entry.question && entry.answer);
}

function getSubmittedContactField(contact, fieldName, directValue) {
  if (contact && typeof contact === 'object' && !Array.isArray(contact)) {
    return contact[fieldName] ?? directValue;
  }

  return directValue;
}

function requireAdminAccess(req, res, next) {
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUsername || !adminPassword) {
    return res.status(503).send('Admin page needs ADMIN_USERNAME and ADMIN_PASSWORD.');
  }

  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme !== 'Basic' || !encoded) {
    res.set('WWW-Authenticate', 'Basic realm="50ka admin"');
    return res.status(401).send('Authentication required.');
  }

  let username = '';
  let password = '';

  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex === -1) {
      throw new Error('Missing separator');
    }
    username = decoded.slice(0, separatorIndex);
    password = decoded.slice(separatorIndex + 1);
  } catch {
    res.set('WWW-Authenticate', 'Basic realm="50ka admin"');
    return res.status(401).send('Invalid credentials.');
  }

  const providedUsername = Buffer.from(username);
  const providedPassword = Buffer.from(password);
  const expectedUsername = Buffer.from(adminUsername);
  const expectedPassword = Buffer.from(adminPassword);

  const isUsernameMatch = providedUsername.length === expectedUsername.length
    && crypto.timingSafeEqual(providedUsername, expectedUsername);
  const isPasswordMatch = providedPassword.length === expectedPassword.length
    && crypto.timingSafeEqual(providedPassword, expectedPassword);

  if (!isUsernameMatch || !isPasswordMatch) {
    res.set('WWW-Authenticate', 'Basic realm="50ka admin"');
    return res.status(401).send('Invalid credentials.');
  }

  return next();
}

// Create table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS responses (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      TEXT    NOT NULL,
    choice       TEXT,
    available    TEXT,
    name         TEXT,
    email        TEXT,
    phone        TEXT,
    answers_json TEXT,
    timestamp    TEXT,
    created_at   TEXT DEFAULT (datetime('now'))
  );

  -- One row per unique user (upsert on arrival)
  CREATE UNIQUE INDEX IF NOT EXISTS idx_user ON responses(user_id);
`);

ensureResponseColumns();

const upsertStmt = db.prepare(`
  INSERT INTO responses (user_id, choice, available, name, email, phone, answers_json, timestamp)
    VALUES (@userId, @choice, @available, @name, @email, @phone, @answersJson, @timestamp)
  ON CONFLICT(user_id) DO UPDATE SET
    choice       = excluded.choice,
    available    = excluded.available,
    name         = excluded.name,
    email        = excluded.email,
    phone        = excluded.phone,
    answers_json = excluded.answers_json,
    timestamp    = excluded.timestamp
`);

/* ---------- Express app ---------- */
const app = express();
app.use(express.json());
// Serve static files (HTML, CSS, JS, images) from project root
app.use(express.static(path.join(__dirname)));

/* Rate limiters */
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // max 20 writes per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const readLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

/* POST /api/response — store / update a visitor's answer */
app.post('/api/response', writeLimiter, (req, res) => {
  const {
    userId,
    choice,
    available,
    answers,
    timestamp,
    contact,
    name,
    email,
    phone,
  } = req.body || {};

  if (!userId || typeof userId !== 'string' || userId.length > 64) {
    return res.status(400).json({ error: 'Invalid userId' });
  }

  const validChoices    = ['left', 'right', 'unknown', 'lenku', 'petra', 'nezadano', null, undefined];
  const validAvailable  = ['ano', 'ne', 'uvidime', null, undefined];

  if (!validChoices.includes(choice))   return res.status(400).json({ error: 'Invalid choice' });
  if (!validAvailable.includes(available)) return res.status(400).json({ error: 'Invalid available value' });

  const choiceMap = {
    left: 'lenku',
    right: 'petra',
    unknown: 'nezadano',
    lenku: 'lenku',
    petra: 'petra',
    nezadano: 'nezadano',
  };
  const normalizedChoice = choiceMap[choice] || null;
  const normalizedAnswers = normalizeAnswers(answers);
  const normalizedName = normalizeOptionalText(getSubmittedContactField(contact, 'name', name), MAX_NAME_LENGTH);
  const normalizedEmail = normalizeOptionalText(getSubmittedContactField(contact, 'email', email), MAX_EMAIL_LENGTH);
  const normalizedPhone = normalizeOptionalText(getSubmittedContactField(contact, 'phone', phone), MAX_PHONE_LENGTH);

  upsertStmt.run({
    userId,
    choice: normalizedChoice || null,
    available: available || null,
    name: normalizedName,
    email: normalizedEmail,
    phone: normalizedPhone,
    answersJson: JSON.stringify(normalizedAnswers),
    timestamp: timestamp || new Date().toISOString(),
  });

  res.json({ ok: true });
});

/* GET /api/responses — read all responses (admin use) */
app.get('/api/responses', readLimiter, (req, res) => {
  const rows = db.prepare(`
    SELECT
      id,
      choice,
      available,
      name,
      email,
      phone,
      answers_json,
      timestamp,
      created_at
    FROM responses
    ORDER BY datetime(timestamp) DESC, datetime(created_at) DESC
  `).all();
  res.json(rows);
});

app.get('/admin', readLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

/* Fallback: serve index.html for any unmatched path */
app.get('*', readLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/* ---------- Start ---------- */
app.listen(PORT, () => {
  console.log(`50ka server running at http://localhost:${PORT}`);
  console.log(`Database at ${DB_PATH}`);
});
