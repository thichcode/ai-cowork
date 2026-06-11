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

async function rcaAgent(task, state, ctx) {
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

  const base = {
    hypotheses,
    findingsCount: hypotheses.length,
    analysisDepth: evidence.length > 1 ? 'deep' : 'shallow',
    confidence: 0.74 + (evidence.length * 0.05),
    summary: `Synthesized evidence: ${evidence.join('; ')}`,
  };

  if (ctx.llm && state.job.modelConfig?.provider !== 'Mock Runtime') {
    try {
      const prompt = [
        `You are an RCA agent analyzing infrastructure data.`,
        `Evidence summaries: ${evidence.join('\n') || 'none'}`,
        `Hypotheses so far: ${hypotheses.join('\n')}`,
        `Based on this evidence, provide a deeper root cause analysis summary (2-3 sentences).`,
      ].join('\n');
      const result = await ctx.llm(prompt, state.job.modelConfig);
      if (result.text) {
        base.summary = result.text;
        base.confidence = Math.min(0.95, base.confidence + 0.1);
        base.llmGenerated = true;
      }
    } catch (e) {
      console.warn('[RCA Agent] LLM call failed, using fallback:', e.message);
    }
  }

  return base;
}

async function reportAgent(task, state, ctx) {
  const rca = state.tasks.find((item) => item.assignedAgent === 'rca-agent' && item.output)?.output;
  const summary = rca?.summary || 'No RCA available';
  const report = {
    label: 'MultiAgentReport',
    summary: [summary],
    confidence: rca?.confidence || 0.5,
    findingsCount: rca?.findingsCount || 0,
    wordCount: summary.split(/\s+/).length,
  };

  if (ctx.llm && state.job.modelConfig?.provider !== 'Mock Runtime') {
    try {
      const prompt = [
        `You are a report generation agent. Synthesize the following RCA analysis into a concise executive summary (3-4 sentences).`,
        `RCA summary: ${summary}`,
        `Hypotheses: ${(rca?.hypotheses || []).join(', ')}`,
        `Confidence: ${rca?.confidence || 0}`,
      ].join('\n');
      const result = await ctx.llm(prompt, state.job.modelConfig);
      if (result.text) {
        report.summary = [result.text, ...report.summary];
        report.confidence = Math.min(0.95, report.confidence + 0.05);
        report.llmGenerated = true;
        report.wordCount = result.text.split(/\s+/).length;
      }
    } catch (e) {
      console.warn('[Report Agent] LLM call failed, using fallback:', e.message);
    }
  }

  state.results.push(report);
  return report;
}

module.exports = {
  dataAgent,
  rcaAgent,
  reportAgent,
};