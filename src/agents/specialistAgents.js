const path = require('path');
const { readCsv, csvExists } = require('../connectors/csvConnector');
const { readExcel } = require('../connectors/excelConnector');
const { queryDatabase } = require('../connectors/dbConnector');

async function dataAgent(task, state, ctx) {
  const dataDir = ctx.dataDir;
  if (task.source === 'csv') {
    const csvPath = path.resolve(dataDir, 'backup-readiness.csv');
    const rows = csvExists(csvPath) ? await readCsv(csvPath) : [];
    return { kind: 'csv', rows: rows.length, summary: `Loaded ${rows.length} CSV rows`, sourcesRead: 1, totalSources: 1, rowCount: rows.length };
  }

  if (task.source === 'db') {
    const rows = await queryDatabase(path.resolve(dataDir, 'infra.db'), 'SELECT id, status FROM backups');
    return { kind: 'db', rows: rows.length, summary: `Loaded ${rows.length} DB rows`, sourcesRead: 1, totalSources: 1, rowCount: rows.length };
  }

  if (task.source === 'excel') {
    const rows = await readExcel(path.resolve(dataDir, 'service-metrics.xlsx'));
    return { kind: 'excel', rows: rows.length, summary: `Loaded ${rows.length} Excel rows`, sourcesRead: 1, totalSources: 1, rowCount: rows.length };
  }

  if (task.source === 'all') {
    const csvPath = path.resolve(dataDir, 'backup-readiness.csv');
    const csvRows = csvExists(csvPath) ? await readCsv(csvPath) : [];
    const dbRows = await queryDatabase(path.resolve(dataDir, 'infra.db'), 'SELECT id, status FROM backups');
    const excelRows = await readExcel(path.resolve(dataDir, 'service-metrics.xlsx'));
    const all = csvRows.length + dbRows.length + excelRows.length;
    return { kind: 'all', rows: all, summary: `Re-read all sources: ${all} total rows`, sourcesRead: 3, totalSources: 3, rowCount: all };
  }

  return { kind: 'unknown', summary: 'No data source configured', sourcesRead: 0, totalSources: 0, rowCount: 0 };
}

async function rcaAgent(task, state) {
  const evidence = state.tasks
    .filter((item) => item.assignedAgent === 'data-agent' && item.output)
    .map((item) => item.output.summary);

  const sourceCount = state.tasks.filter((item) => item.assignedAgent === 'data-agent' && item.output).length;
  const hypotheses = ['Backup health depends on CSV, DB, and Excel consistency'];

  if (sourceCount >= 2) {
    hypotheses.push('Data source alignment indicates potential sync issues');
  }
  if (sourceCount >= 3) {
    hypotheses.push('Cross-source validation required for backup integrity');
  }

  return {
    hypotheses,
    findingsCount: hypotheses.length,
    analysisDepth: evidence.length > 1 ? 'deep' : 'shallow',
    confidence: 0.74 + (evidence.length * 0.05),
    summary: `Synthesized evidence: ${evidence.join('; ')}`,
  };
}

async function reportAgent(task, state) {
  const rca = state.tasks.find((item) => item.assignedAgent === 'rca-agent' && item.output)?.output;
  const summary = rca?.summary || 'No RCA available';
  const report = {
    label: 'MultiAgentReport',
    summary: [summary],
    confidence: rca?.confidence || 0.5,
    findingsCount: rca?.findingsCount || 0,
    wordCount: summary.split(/\s+/).length,
  };
  state.results.push(report);
  return report;
}

module.exports = {
  dataAgent,
  rcaAgent,
  reportAgent,
};