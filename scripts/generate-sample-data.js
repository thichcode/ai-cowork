const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const sqlite3 = require('sqlite3').verbose();

const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// CSV
const csvRows = ['service,status', 'backup,ok', 'db,warning', 'cache,ok'];
fs.writeFileSync(path.join(dataDir, 'backup-readiness.csv'), csvRows.join('\n'));

// Excel
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('Metrics');
sheet.addRow(['service', 'latencyMs']);
sheet.addRow(['api', 120]);
sheet.addRow(['db', 210]);
workbook.xlsx.writeFile(path.join(dataDir, 'service-metrics.xlsx'));

// SQLite
const dbPath = path.join(dataDir, 'infra.db');
const db = new sqlite3.Database(dbPath);
db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS backups (id INTEGER PRIMARY KEY, status TEXT, node TEXT)');
  const stmt = db.prepare('INSERT INTO backups (status, node) VALUES (?, ?)');
  ['ok', 'warning', 'ok'].forEach((status, idx) => { stmt.run(status, `node-${idx + 1}`); });
  stmt.finalize();
});
db.close();

console.log('Sample data generated in ./data');