const { orchestrate } = require('./orchestrator');
const path = require('path');

async function main() {
  const request = process.argv.slice(2).join(' ') || 'backup report';
  const ctx = { dataDir: path.resolve(__dirname, '../data') };
  const execution = await orchestrate(request, ctx);
  console.log(`Request: ${request}`);
  execution.results.forEach((result) => {
    console.log(`--- ${result.label} ---`);
    result.summary.forEach((line) => console.log(`* ${line}`));
  });
}

main().catch((err) => {
  console.error('Error running orchestrator:', err);
});