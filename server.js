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
const Database = require('better-sqlite3');
const rateLimit = require('express-rate-limit');

/* ---------- Setup ---------- */
const PORT   = process.env.PORT || 3000;
const DB_DIR = path.join(__dirname, 'db');
const DB_PATH = path.join(DB_DIR, 'responses.db');

// Ensure db/ directory exists
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR);

/* ---------- Database ---------- */
const db = new Database(DB_PATH);

// Create table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS responses (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   TEXT    NOT NULL,
    choice    TEXT,
    available TEXT,
    timestamp TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- One row per unique user (upsert on arrival)
  CREATE UNIQUE INDEX IF NOT EXISTS idx_user ON responses(user_id);
`);

const upsertStmt = db.prepare(`
  INSERT INTO responses (user_id, choice, available, timestamp)
    VALUES (@userId, @choice, @available, @timestamp)
  ON CONFLICT(user_id) DO UPDATE SET
    choice    = excluded.choice,
    available = excluded.available,
    timestamp = excluded.timestamp
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
  const { userId, choice, available, timestamp } = req.body || {};

  if (!userId || typeof userId !== 'string' || userId.length > 64) {
    return res.status(400).json({ error: 'Invalid userId' });
  }

  const validChoices    = ['left', 'right', 'unknown', 'lenku', 'petra', 'nezadano', null, undefined];
  const validAvailable  = ['ano', 'ne', 'uvidime', null, undefined];

  if (!validChoices.includes(choice))   return res.status(400).json({ error: 'Invalid choice' });
  if (!validAvailable.includes(available)) return res.status(400).json({ error: 'Invalid available value' });

  const normalizedChoice = choice === 'left'
    ? 'lenku'
    : choice === 'right'
      ? 'petra'
      : choice === 'unknown'
        ? 'nezadano'
        : choice;

  upsertStmt.run({
    userId:    userId,
    choice:    normalizedChoice || null,
    available: available || null,
    timestamp: timestamp || new Date().toISOString(),
  });

  res.json({ ok: true });
});

/* GET /api/responses — read all responses (admin use) */
app.get('/api/responses', readLimiter, (req, res) => {
  const rows = db.prepare('SELECT * FROM responses ORDER BY created_at DESC').all();
  res.json(rows);
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
