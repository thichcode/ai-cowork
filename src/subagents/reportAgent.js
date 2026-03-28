const { readCsv, csvExists } = require('../connectors/csvConnector');
const { readExcel } = require('../connectors/excelConnector');
const { queryDatabase } = require('../connectors/dbConnector');
const path = require('path');

async function runBackupReport(ctx) {
  const tasks = [];
  const csvPath = path.resolve(ctx.dataDir, 'backup-readiness.csv');
  if (csvExists(csvPath)) {
    const csv = await readCsv(csvPath);
    tasks.push(`CSV backups: ${csv.length} entries`);
  }

  try {
    const dbRows = await queryDatabase(path.resolve(ctx.dataDir, 'infra.db'), 'SELECT id, status FROM backups');
    tasks.push(`DB backups: ${dbRows.length} entries`);
  } catch (err) {
    tasks.push('DB backup data unavailable');
  }

  const excelPath = path.resolve(ctx.dataDir, 'service-metrics.xlsx');
  try {
    const excelData = await readExcel(excelPath);
    tasks.push(`Excel metrics sheets: ${excelData.length} rows`);
  } catch (err) {
    tasks.push('Excel metrics missing');
  }

  return {
    label: 'BackupReport',
    summary: tasks,
  };
}

module.exports = {
  runBackupReport,
};