const path = require('path');
const { readCsv, csvExists } = require('../connectors/csvConnector');
const { readExcel } = require('../connectors/excelConnector');
const { queryDatabase } = require('../connectors/dbConnector');

async function dataAgent(task, state, ctx) {
  const dataDir = ctx.dataDir;
  if (task.source === 'csv') {
    const csvPath = path.resolve(dataDir, 'backup-readiness.csv');
    const rows = csvExists(csvPath) ? await readCsv(csvPath) : [];
    return { kind: 'csv', rows: rows.length, summary: `Loaded ${rows.length} CSV rows` };
  }

  if (task.source === 'db') {
    const rows = await queryDatabase(path.resolve(dataDir, 'infra.db'), 'SELECT id, status FROM backups');
    return { kind: 'db', rows: rows.length, summary: `Loaded ${rows.length} DB rows` };
  }

  if (task.source === 'excel') {
    const rows = await readExcel(path.resolve(dataDir, 'service-metrics.xlsx'));
    return { kind: 'excel', rows: rows.length, summary: `Loaded ${rows.length} Excel rows` };
  }

  return { kind: 'unknown', summary: 'No data source configured' };
}

async function rcaAgent(task, state) {
  const evidence = state.tasks
    .filter((item) => item.assignedAgent === 'data-agent' && item.output)
    .map((item) => item.output.summary);

  return {
    hypotheses: ['Backup health depends on CSV, DB, and Excel consistency'],
    confidence: 0.74,
    summary: `Synthesized evidence: ${evidence.join('; ')}`,
  };
}

async function reportAgent(task, state) {
  const rca = state.tasks.find((item) => item.assignedAgent === 'rca-agent' && item.output)?.output;
  const summary = rca?.summary || 'No RCA available';
  const report = {
    label: 'MultiAgentReport',
    summary: [summary],
  };
  state.results.push(report);
  return report;
}

module.exports = {
  dataAgent,
  rcaAgent,
  reportAgent,
};