function aggregateResult({ data, intent, risk, qa, agentsUsed, processingTimeMs, reviewOverride = false }) {
  return {
    request_id: data.requestId,
    status: qa.needsReview || reviewOverride ? 'needs_review' : 'completed',
    answer: qa.finalAnswer,
    confidence: qa.confidence,
    risk_level: risk.risk_level,
    metadata: {
      intent: intent.intent,
      agents_used: agentsUsed,
      processing_time_ms: processingTimeMs,
    },
  };
}

module.exports = {
  aggregateResult,
};