const https = require('https');
const http = require('http');

async function generate(prompt, modelConfig) {
  const baseUrl = (modelConfig.baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
  const model = modelConfig.model || 'llama3.2';
  const temperature = modelConfig.temperature ?? 0.7;

  const body = JSON.stringify({
    model,
    prompt,
    stream: false,
    options: { temperature },
  });

  const isHttps = baseUrl.startsWith('https://');
  const url = new URL(`${baseUrl}/api/generate`);
  const transport = isHttps ? https : http;

  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 11434),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = transport.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            return reject(new Error(`Ollama error: ${parsed.error}`));
          }
          resolve({
            text: parsed.response || '',
            usage: {
              promptTokens: parsed.prompt_eval_count || 0,
              completionTokens: parsed.eval_count || 0,
              totalTokens: (parsed.prompt_eval_count || 0) + (parsed.eval_count || 0),
            },
            latencyMs: Date.now() - startedAt,
            provider: 'ollama',
          });
        } catch {
          reject(new Error(`Ollama: failed to parse response: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(120000, () => { req.destroy(); reject(new Error('Ollama request timeout (120s)')); });
    req.write(body);
    req.end();
  });
}

module.exports = { generate };