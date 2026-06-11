const { retrieveKnowledge } = require('../runtime/knowledgeBase');

const memoryDb = {
  conversations: new Map(),
  users: new Map(),
  cases: new Map(),
  episodic: [],
};

function retrieveMemory(data) {
  const recentMessages = memoryDb.conversations.get(data.conversation.threadId) || [];
  const userMemory = memoryDb.users.get(data.user.id) || null;
  const caseMemory = data.case.caseId ? memoryDb.cases.get(data.case.caseId) || null : null;
  const semanticMemory = retrieveKnowledge(data.message.text);

  return {
    currentMessage: data.message.text,
    recentMessages: recentMessages.slice(-5),
    conversationSummary: recentMessages.slice(-3).map((item) => item.text).join(' | '),
    userMemory,
    caseMemory,
    semanticMemory,
  };
}

function writeMemory(data, result) {
  const conversationItems = memoryDb.conversations.get(data.conversation.threadId) || [];
  conversationItems.push({
    messageId: data.conversation.messageId,
    text: data.message.text,
    answer: result.answer,
    timestamp: new Date().toISOString(),
  });
  memoryDb.conversations.set(data.conversation.threadId, conversationItems);

  memoryDb.users.set(data.user.id, {
    userId: data.user.id,
    displayName: data.user.displayName,
    preferences: {},
    vipFlag: result.risk_level !== 'low',
  });

  if (data.case.caseId) {
    memoryDb.cases.set(data.case.caseId, {
      caseId: data.case.caseId,
      status: result.status,
      summary: result.answer,
      updatedAt: new Date().toISOString(),
    });
  }

  memoryDb.episodic.push({
    requestId: data.requestId,
    content: result.answer,
    confidence: result.confidence,
    createdAt: new Date().toISOString(),
  });
}

module.exports = {
  retrieveMemory,
  writeMemory,
  memoryDb,
};