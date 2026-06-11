const providers = {
  'Mock Runtime': require('./providers/mock'),
  'OpenAI': require('./providers/openai'),
  'OpenRouter': require('./providers/openai'),
  'Ollama': require('./providers/ollama'),
};

function resolveProvider(modelConfig) {
  const providerName = modelConfig.provider || 'Mock Runtime';
  const provider = providers[providerName];
  if (!provider) {
    console.warn(`[LLM] Unknown provider "${providerName}", falling back to Mock Runtime`);
    return providers['Mock Runtime'];
  }

  if (providerName === 'OpenRouter') {
    const cfg = { ...modelConfig, baseUrl: modelConfig.baseUrl || 'https://openrouter.ai/api/v1' };
    return { generate: (prompt, _cfg) => providers['OpenAI'].generate(prompt, { ...cfg, ..._cfg }) };
  }

  return provider;
}

async function generate(prompt, modelConfig = {}) {
  const provider = resolveProvider(modelConfig);
  const startedAt = Date.now();

  try {
    const result = await provider.generate(prompt, modelConfig);
    return result;
  } catch (err) {
    return {
      text: '',
      error: err.message,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      latencyMs: Date.now() - startedAt,
      provider: modelConfig.provider || 'mock',
    };
  }
}

module.exports = { generate, providers };