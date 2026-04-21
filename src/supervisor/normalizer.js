function normalizeInput(payload = {}) {
  const now = new Date().toISOString();

  return {
    requestId: payload.request_id || `req_${Date.now()}`,
    source: payload.source || 'ms_teams',
    timestamp: payload.timestamp || now,
    user: {
      id: payload.user?.id || 'unknown_user',
      displayName: payload.user?.display_name || 'Unknown User',
    },
    conversation: {
      threadId: payload.conversation?.thread_id || `thread_${Date.now()}`,
      messageId: payload.conversation?.message_id || `msg_${Date.now()}`,
    },
    case: {
      caseId: payload.case?.case_id || null,
      priority: payload.case?.priority || 'low',
    },
    message: {
      text: (payload.message?.text || '').trim(),
    },
    raw: payload,
  };
}

module.exports = {
  normalizeInput,
};