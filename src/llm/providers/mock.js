async function generate(prompt, modelConfig) {
  const startedAt = Date.now();
  return {
    text: `[Mock ${modelConfig.model || 'default'}] Response to: ${prompt.slice(0, 60)}...`,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    latencyMs: Date.now() - startedAt,
    provider: 'mock',
  };
}

module.exports = { generate };