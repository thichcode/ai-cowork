const path = require('path');
const { runBackupReport } = require('./subagents/reportAgent');

const agentMap = [
  { keywords: ['backup', 'report'], handler: runBackupReport },
  { keywords: ['rca', 'issue'], handler: runBackupReport },
  { keywords: ['monitor', 'status'], handler: runBackupReport },
];

async function orchestrate(request, ctx) {
  const matches = agentMap.filter((entry) =>
    entry.keywords.some((k) => request.toLowerCase().includes(k))
  );

  if (matches.length === 0) {
    return [{ label: 'Fallback', summary: ['No subagent matched the request.'] }];
  }

  const results = await Promise.all(matches.map((match) => match.handler(ctx)));
  return results;
}

module.exports = {
  orchestrate,
};