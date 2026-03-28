const sqlite3 = require('sqlite3').verbose();

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

module.exports = {
  queryDatabase,
};