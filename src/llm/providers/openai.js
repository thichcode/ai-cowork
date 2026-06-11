const https = require('https');

async function generate(prompt, modelConfig) {
  const apiKey = process.env.OPENAI_API_KEY || modelConfig.apiKey;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set. Set it via environment variable or modelConfig.apiKey');
  }

  const baseUrl = (modelConfig.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = modelConfig.model || 'gpt-4o-mini';
  const temperature = modelConfig.temperature ?? 0.7;

  const body = JSON.stringify({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature,
  });

  const url = new URL(`${baseUrl}/chat/completions`);

  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            return reject(new Error(`OpenAI API error: ${parsed.error.message}`));
          }
          resolve({
            text: parsed.choices?.[0]?.message?.content || '',
            usage: {
              promptTokens: parsed.usage?.prompt_tokens || 0,
              completionTokens: parsed.usage?.completion_tokens || 0,
              totalTokens: parsed.usage?.total_tokens || 0,
            },
            latencyMs: Date.now() - startedAt,
            provider: 'openai',
          });
        } catch {
          reject(new Error(`OpenAI: failed to parse response: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('OpenAI request timeout (60s)')); });
    req.write(body);
    req.end();
  });
}

module.exports = { generate };