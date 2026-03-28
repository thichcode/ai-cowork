const { orchestrate } = require('./orchestrator');
const path = require('path');

async function main() {
  const request = process.argv.slice(2).join(' ') || 'backup report';
  const ctx = { dataDir: path.resolve(__dirname, '../data') };
  const responses = await orchestrate(request, ctx);
  console.log(`Request: ${request}`);
  responses.forEach((result) => {
    console.log(`--- ${result.label} ---`);
    result.summary.forEach((line) => console.log(`* ${line}`));
  });
}

main().catch((err) => {
  console.error('Error running orchestrator:', err);
});