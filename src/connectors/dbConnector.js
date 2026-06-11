const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

function queryDatabase(dbPath, sql) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(err);
    });
    db.all(sql, (err, rows) => {
      db.close();
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function checkTableExists(dbPath, tableName) {
  return new Promise((resolve) => {
    if (!fs.existsSync(dbPath)) {
      return resolve({ exists: false, error: 'Database file not found' });
    }
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return resolve({ exists: false, error: err.message });
    });
    db.all(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [tableName], (err, rows) => {
      db.close();
      if (err) return resolve({ exists: false, error: err.message });
      resolve({ exists: rows.length > 0, tableName, rows: rows });
    });
  });
}

module.exports = {
  queryDatabase,
  checkTableExists,
};