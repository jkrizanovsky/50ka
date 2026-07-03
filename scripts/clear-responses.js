const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'db', 'responses.db');

if (!fs.existsSync(dbPath)) {
  console.log(`Database not found at ${dbPath}; nothing to clear.`);
  process.exit(0);
}

const db = new Database(dbPath);
db.pragma('busy_timeout = 5000');

const tables = db.prepare(`
  SELECT name
  FROM sqlite_master
  WHERE type = 'table'
    AND name IN ('responses', 'response_fields')
`).all();

const hasResponses = tables.some((table) => table.name === 'responses');
const hasResponseFields = tables.some((table) => table.name === 'response_fields');
const hasSqliteSequence = db.prepare(`
  SELECT 1
  FROM sqlite_master
  WHERE type = 'table'
    AND name = 'sqlite_sequence'
`).get();

if (!hasResponses && !hasResponseFields) {
  console.log(`No RSVP tables found in ${dbPath}; nothing to clear.`);
  db.close();
  process.exit(0);
}

const counts = {
  responses: hasResponses
    ? db.prepare('SELECT COUNT(*) AS count FROM responses').get().count
    : 0,
  responseFields: hasResponseFields
    ? db.prepare('SELECT COUNT(*) AS count FROM response_fields').get().count
    : 0,
};

const clearTables = db.transaction(() => {
  if (hasResponseFields) db.prepare('DELETE FROM response_fields').run();
  if (hasResponses) db.prepare('DELETE FROM responses').run();
  if (hasSqliteSequence) {
    db.prepare(`
      DELETE FROM sqlite_sequence
      WHERE name IN ('responses', 'response_fields')
    `).run();
  }
});

clearTables();
db.close();

console.log(
  `Cleared ${counts.responses} responses and ${counts.responseFields} response fields from ${dbPath}.`
);
