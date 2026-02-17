const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { config } = require('./config');

let db;

function initDb() {
  const dbDir = path.dirname(config.databasePath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(config.databasePath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      chat_id INTEGER PRIMARY KEY,
      interval_minutes INTEGER,
      state TEXT NOT NULL DEFAULT 'idle',
      last_smoke_time TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  return db;
}

function getUser(chatId) {
  return db.prepare('SELECT * FROM users WHERE chat_id = ?').get(chatId);
}

function upsertUser(chatId, fields = {}) {
  const user = getUser(chatId);
  if (user) {
    const sets = ['updated_at = datetime(\'now\')'];
    const values = [];
    for (const [key, val] of Object.entries(fields)) {
      sets.push(`${key} = ?`);
      values.push(val);
    }
    values.push(chatId);
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE chat_id = ?`).run(...values);
  } else {
    const cols = ['chat_id', ...Object.keys(fields)];
    const placeholders = cols.map(() => '?');
    const values = [chatId, ...Object.values(fields)];
    db.prepare(`INSERT INTO users (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`).run(...values);
  }
  return getUser(chatId);
}

function setUserState(chatId, state) {
  return upsertUser(chatId, { state });
}

function setSmoked(chatId) {
  return upsertUser(chatId, {
    state: 'smoking_interval',
    last_smoke_time: new Date().toISOString(),
  });
}

function getUsersInState(state) {
  return db.prepare('SELECT * FROM users WHERE state = ?').all(state);
}

module.exports = { initDb, getUser, upsertUser, setUserState, setSmoked, getUsersInState };
