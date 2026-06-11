const { readCsv, csvExists } = require('../connectors/csvConnector');
const { readExcel } = require('../connectors/excelConnector');
const { queryDatabase } = require('../connectors/dbConnector');
const path = require('path');

async function runBackupReport(ctx) {
  const emit = typeof ctx.onEvent === 'function' ? ctx.onEvent : () => {};
  const tasks = [];
  const csvPath = path.resolve(ctx.dataDir, 'backup-readiness.csv');
  emit({
    type: 'agent_signal',
    agent: ctx.agent,
    node: 'csv_connector',
    message: `Reading CSV source: ${path.basename(csvPath)}`,
    timestamp: new Date().toISOString(),
  });
  if (csvExists(csvPath)) {
    const csv = await readCsv(csvPath);
    tasks.push(`CSV backups: ${csv.length} entries`);
    emit({
      type: 'agent_signal',
      agent: ctx.agent,
      node: 'csv_connector',
      message: `CSV rows loaded: ${csv.length}`,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    emit({
      type: 'agent_signal',
      agent: ctx.agent,
      node: 'db_connector',
      message: 'Querying SQLite backup table',
      timestamp: new Date().toISOString(),
    });
    const dbRows = await queryDatabase(path.resolve(ctx.dataDir, 'infra.db'), 'SELECT id, status FROM backups');
    tasks.push(`DB backups: ${dbRows.length} entries`);
    emit({
      type: 'agent_signal',
      agent: ctx.agent,
      node: 'db_connector',
      message: `Database rows loaded: ${dbRows.length}`,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    tasks.push('DB backup data unavailable');
    emit({
      type: 'agent_signal',
      agent: ctx.agent,
      node: 'db_connector',
      message: `Database query failed: ${err.message}`,
      timestamp: new Date().toISOString(),
    });
  }

  const excelPath = path.resolve(ctx.dataDir, 'service-metrics.xlsx');
  try {
    emit({
      type: 'agent_signal',
      agent: ctx.agent,
      node: 'excel_connector',
      message: `Reading Excel source: ${path.basename(excelPath)}`,
      timestamp: new Date().toISOString(),
    });
    const excelData = await readExcel(excelPath);
    tasks.push(`Excel metrics sheets: ${excelData.length} rows`);
    emit({
      type: 'agent_signal',
      agent: ctx.agent,
      node: 'excel_connector',
      message: `Excel rows loaded: ${excelData.length}`,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    tasks.push('Excel metrics missing');
    emit({
      type: 'agent_signal',
      agent: ctx.agent,
      node: 'excel_connector',
      message: `Excel read failed: ${err.message}`,
      timestamp: new Date().toISOString(),
    });
  }

  return {
    label: 'BackupReport',
    summary: tasks,
  };
}

module.exports = {
  runBackupReport,
};