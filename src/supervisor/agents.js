function contextAgent(data, memory) {
  return {
    conversationContext: memory.recentMessages.map((item) => item.text),
    user: memory.userMemory,
    case: memory.caseMemory,
  };
}

function policyAgent(data) {
  const text = data.message.text.toLowerCase();
  const matchedPolicies = [];

  if (text.includes('policy') || text.includes('guideline') || text.includes('sop')) {
    matchedPolicies.push('Follow internal policy and avoid unsupported commitments.');
  }

  return { matchedPolicies };
}

function knowledgeAgent(_data, memory) {
  return {
    facts: memory.semanticMemory.map((item) => item.summary),
  };
}

function draftAgent(data, context, policy, knowledge) {
  const parts = [
    `Request from ${data.user.displayName}: ${data.message.text}`,
  ];

  if (context.conversationContext.length) {
    parts.push(`Recent context: ${context.conversationContext.join(' | ')}`);
  }
  if (policy.matchedPolicies.length) {
    parts.push(`Policy notes: ${policy.matchedPolicies.join(' ')}`);
  }
  if (knowledge.facts.length) {
    parts.push(`Knowledge: ${knowledge.facts.join(' ')}`);
  }

  parts.push('Proposed response: We reviewed the request, used the available context, and prepared the safest next response for this conversation.');

  return {
    answer: parts.join('\n'),
  };
}

function qaAgent(draft, intent, risk) {
  const confidence = intent.confidence > 0.85 && risk.risk_level === 'low'
    ? 0.9
    : intent.confidence > 0.75
      ? 0.82
      : 0.68;

  return {
    finalAnswer: draft.answer,
    confidence,
    needsReview: risk.risk_level === 'high' || confidence < 0.7,
  };
}

module.exports = {
  contextAgent,
  policyAgent,
  knowledgeAgent,
  draftAgent,
  qaAgent,
};