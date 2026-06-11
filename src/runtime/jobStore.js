const path = require('path');
const fs = require('fs');

let db = null;

function getDb(dbPath) {
  if (db) return db;
  const resolvedPath = dbPath || path.resolve(__dirname, '../../data/jobs.db');
  const SQLite3 = require('sqlite3').verbose();
  db = new SQLite3.Database(resolvedPath);
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS jobs (
      job_id TEXT PRIMARY KEY,
      state TEXT NOT NULL,
      status TEXT NOT NULL,
      request TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS job_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT,
      timestamp TEXT NOT NULL
    )`);
  });
  return db;
}

function saveJob(state) {
  return new Promise((resolve, reject) => {
    const s = state.job;
    const payload = JSON.stringify({
      plans: state.plans,
      tasks: state.tasks,
      messages: state.messages,
      results: state.results,
      knowledge: state.knowledge,
      skills: state.skills,
      proposals: state.proposals,
    });

    const db = getDb();
    const now = new Date().toISOString();
    db.run(
      `INSERT OR REPLACE INTO jobs (job_id, state, status, request, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [s.id, payload, s.status, s.request, s.createdAt || now, now],
      (err) => err ? reject(err) : resolve()
    );
  });
}

function saveEvent(jobId, type, payload = {}) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.run(
      `INSERT INTO job_events (job_id, type, payload, timestamp) VALUES (?, ?, ?, ?)`,
      [jobId, type, JSON.stringify(payload), new Date().toISOString()],
      (err) => err ? reject(err) : resolve()
    );
  });
}

function loadJob(jobId) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.get(`SELECT * FROM jobs WHERE job_id = ?`, [jobId], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      try {
        const parsed = JSON.parse(row.state);
        resolve({
          job: { id: row.job_id, status: row.status, request: row.request, createdAt: row.created_at },
          ...parsed,
        });
      } catch {
        resolve(null);
      }
    });
  });
}

function listJobs(limit = 20) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.all(`SELECT job_id, status, request, created_at, updated_at FROM jobs ORDER BY updated_at DESC LIMIT ?`, [limit], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  saveJob,
  saveEvent,
  loadJob,
  listJobs,
  closeDb,
};