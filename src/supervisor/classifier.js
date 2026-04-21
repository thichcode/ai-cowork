function classifyIntent(data, memory) {
  const text = `${data.message.text} ${(memory.conversationSummary || '')}`.toLowerCase();

  if (text.includes('boss') || text.includes('manager') || text.includes('executive')) {
    return { intent: 'executive_request', confidence: 0.92 };
  }

  if (text.includes('policy') || text.includes('guideline') || text.includes('sop')) {
    return { intent: 'policy', confidence: 0.87 };
  }

  if (text.includes('case') || text.includes('ticket') || text.includes('incident') || text.includes('support')) {
    return { intent: 'support_case', confidence: 0.82 };
  }

  if (text.includes('analy') || text.includes('compare') || text.includes('report')) {
    return { intent: 'analysis', confidence: 0.8 };
  }

  return { intent: 'faq', confidence: 0.72 };
}

module.exports = {
  classifyIntent,
};