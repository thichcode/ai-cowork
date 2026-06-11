function decideExecutionPath(intent, risk, data) {
  const text = data.message.text.toLowerCase();
  const isMultiStep = [' and ', ' then ', 'after that', 'sau đó'].some((token) => text.includes(token));
  const containsCommitment = ['will', 'commit', 'guarantee', 'cam kết'].some((token) => text.includes(token));
  const useSubagents = [ 'policy', 'support_case', 'analysis' ].includes(intent.intent)
    || risk.risk_level !== 'low'
    || isMultiStep
    || intent.confidence < 0.78;

  const needsReview = intent.intent === 'executive_request'
    || risk.risk_level === 'high'
    || intent.confidence < 0.7
    || containsCommitment;

  return {
    useSubagents,
    needsReview,
    directAnswer: !useSubagents,
  };
}

module.exports = {
  decideExecutionPath,
};