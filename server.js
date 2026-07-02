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
const cors = require('cors');
const path    = require('path');
const fs      = require('fs');
const Database = require('better-sqlite3');
const rateLimit = require('express-rate-limit');

/* ---------- Setup ---------- */
const PORT   = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'db', 'responses.db');
const DB_DIR  = path.dirname(DB_PATH);
const MAX_ANSWER_TEXT_LENGTH = 300;
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 320;
const MAX_PHONE_LENGTH = 80;
const TRACKED_QUESTIONNAIRE_STEP_IDS = new Set([1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 98]);
const FACE_CHOICE_LABEL = 'Koho máš raději?';
const CONTACT_FIELDS = [
  { fieldKey: 'contact-name', label: 'Jméno', sortOrder: 9000 },
  { fieldKey: 'contact-email', label: 'Email', sortOrder: 9001 },
  { fieldKey: 'contact-phone', label: 'Telefon', sortOrder: 9002 },
];

// Ensure db/ directory exists
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

/* ---------- Database ---------- */
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

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

function parseStoredAnswers(value) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? normalizeAnswers(parsed) : [];
  } catch {
    return [];
  }
}

function formatStoredChoice(choice) {
  const map = {
    lenku: 'Lenku',
    petra: 'Petra',
    nezadano: 'Nezadáno',
  };
  return map[choice] || null;
}

function formatStoredAvailability(available) {
  const map = {
    ano: 'Ano',
    ne: 'Ne',
    uvidime: 'Uvidíme',
  };
  return map[available] || null;
}

function buildResponseFields({ choice, available, name, email, phone, answers }) {
  const fields = [];
  const storedChoice = formatStoredChoice(choice);
  const storedAvailability = formatStoredAvailability(available);

  if (storedChoice) {
    fields.push({
      fieldKey: 'face-choice',
      label: FACE_CHOICE_LABEL,
      value: storedChoice,
      sortOrder: 0,
    });
  }

  if (storedAvailability) {
    fields.push({
      fieldKey: 'attendance',
      label: 'Účast 12.9.',
      value: storedAvailability,
      sortOrder: 1,
    });
  }

  answers.forEach((answer) => {
    fields.push({
      fieldKey: `step-${answer.stepId}`,
      label: answer.question,
      value: answer.answer,
      sortOrder: answer.stepId,
    });
  });

  CONTACT_FIELDS.forEach(({ fieldKey, label, sortOrder }) => {
    const fieldValueByKey = {
      'contact-name': name,
      'contact-email': email,
      'contact-phone': phone,
    };
    const fieldValue = fieldValueByKey[fieldKey] || null;
    if (!fieldValue) return;
    fields.push({
      fieldKey,
      label,
      value: fieldValue,
      sortOrder,
    });
  });

  return fields;
}

function getSubmittedContactField(contact, fieldName, directValue) {
  if (contact && typeof contact === 'object' && !Array.isArray(contact)) {
    return contact[fieldName] ?? directValue;
  }

  return directValue;
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

  CREATE TABLE IF NOT EXISTS response_fields (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT    NOT NULL,
    field_key  TEXT    NOT NULL,
    label      TEXT    NOT NULL,
    value      TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, field_key)
  );

  CREATE INDEX IF NOT EXISTS idx_response_fields_user ON response_fields(user_id);
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

const clearResponseFieldsStmt = db.prepare(`
  DELETE FROM response_fields
  WHERE user_id = ?
`);

const insertResponseFieldStmt = db.prepare(`
  INSERT INTO response_fields (user_id, field_key, label, value, sort_order, updated_at)
  VALUES (@userId, @fieldKey, @label, @value, @sortOrder, datetime('now'))
`);

const saveResponseTransaction = db.transaction((responseData, responseFields) => {
  upsertStmt.run(responseData);
  clearResponseFieldsStmt.run(responseData.userId);
  responseFields.forEach((field) => {
    insertResponseFieldStmt.run({
      userId: responseData.userId,
      fieldKey: field.fieldKey,
      label: field.label,
      value: field.value,
      sortOrder: field.sortOrder,
    });
  });
});

function backfillResponseFields() {
  const rows = db.prepare(`
    SELECT user_id, choice, available, name, email, phone, answers_json, timestamp
    FROM responses
  `).all();

  rows.forEach((row) => {
    const existingCount = db.prepare(`
      SELECT COUNT(*) AS count
      FROM response_fields
      WHERE user_id = ?
    `).get(row.user_id)?.count || 0;
    if (existingCount > 0) return;

    const responseData = {
      userId: row.user_id,
      choice: row.choice,
      available: row.available,
      name: row.name,
      email: row.email,
      phone: row.phone,
      answersJson: row.answers_json,
      timestamp: row.timestamp || new Date().toISOString(),
    };
    const responseFields = buildResponseFields({
      choice: row.choice,
      available: row.available,
      name: row.name,
      email: row.email,
      phone: row.phone,
      answers: parseStoredAnswers(row.answers_json),
    });
    saveResponseTransaction(responseData, responseFields);
  });
}

backfillResponseFields();

/* ---------- Express app ---------- */
const app = express();

// Allow requests from GitHub Pages (root domain and any subdirectory path)
app.use(cors({
  origin: /^https:\/\/jkrizanovsky\.github\.io(\/.*)?$/,
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());
// Serve static files (HTML, CSS, JS, images) from project root
app.use(express.static(path.join(__dirname)));

/* Rate limiters */
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Nyní nelze odeslat, zkus to prosím za chvilku znovu.' },
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
  const responseData = {
    userId,
    choice: normalizedChoice || null,
    available: available || null,
    name: normalizedName,
    email: normalizedEmail,
    phone: normalizedPhone,
    answersJson: JSON.stringify(normalizedAnswers),
    timestamp: timestamp || new Date().toISOString(),
  };
  const responseFields = buildResponseFields({
    choice: responseData.choice,
    available: responseData.available,
    name: normalizedName,
    email: normalizedEmail,
    phone: normalizedPhone,
    answers: normalizedAnswers,
  });

  try {
    saveResponseTransaction(responseData, responseFields);
    res.json({ ok: true });
  } catch (error) {
    console.error('Failed to save response:', error);
    res.status(500).json({ error: 'Nepodařilo se uložit odpověď, zkus to prosím znovu.' });
  }
});

/* GET /api/responses — read all responses (admin use) */
app.get('/api/responses', readLimiter, (req, res) => {
  const rows = db.prepare(`
    SELECT
      id,
      user_id,
      choice,
      available,
      name,
      email,
      phone,
      answers_json,
      timestamp,
      created_at
    FROM responses
    ORDER BY LOWER(COALESCE(name, '')) ASC, datetime(created_at) ASC
  `).all();
  const answerFields = db.prepare(`
    SELECT
      user_id,
      field_key,
      label,
      value,
      sort_order
    FROM response_fields
    ORDER BY sort_order ASC, id ASC
  `).all();
  const fieldsByUserId = new Map();

  answerFields.forEach((field) => {
    if (!fieldsByUserId.has(field.user_id)) {
      fieldsByUserId.set(field.user_id, []);
    }
    fieldsByUserId.get(field.user_id).push({
      fieldKey: field.field_key,
      label: field.label,
      value: field.value,
      sortOrder: field.sort_order,
    });
  });

  res.json(rows.map((row) => ({
    ...row,
    answer_fields: fieldsByUserId.get(row.user_id) || [],
  })));
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
