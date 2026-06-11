const https = require('https');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function sendMessage(text, parseMode = 'Markdown') {
  if (!BOT_TOKEN) {
    console.warn('[Telegram] BOT_TOKEN not set, skipping notification');
    return Promise.resolve({ ok: false, error: 'BOT_TOKEN not configured' });
  }

  const postData = JSON.stringify({
    chat_id: CHAT_ID,
    text,
    parse_mode: parseMode,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Approve PA1', callback_data: 'approve_proposal_1' },
          { text: '✅ Approve PA2', callback_data: 'approve_proposal_2' },
          { text: '✅ Approve PA3', callback_data: 'approve_proposal_3' },
        ],
        [
          { text: '❌ Reject', callback_data: 'reject_approval' },
        ],
      ],
    },
  });

  const options = {
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch {
          resolve({ ok: false, raw: data });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function sendApprovalRequest(jobId, proposals) {
  const proposalList = proposals
    .map(
      (p, i) =>
        `${i + 1}. *${p.name}*\n   ${p.description}\n   ⏱️ ${p.estimatedTime} | 📊 ${Math.round(p.confidence * 100)}% confidence`
    )
    .join('\n\n');

  const text = `🛠️ *New Approval Request*\n\n` +
    `Job ID: \`${jobId}\`\n\n` +
    `*Available Proposals:*\n\n${proposalList}\n\n` +
    `Select an option below:`;

  return sendMessage(text);
}

function sendApprovalConfirmation(jobId, proposalId, proposalName) {
  const text = `✅ *Approved!*\n\n` +
    `Job: \`${jobId}\`\n` +
    `Proposal: *${proposalName}*\n\n` +
    `Executing...`;

  return sendMessage(text);
}

function sendRejectionConfirmation(jobId) {
  const text = `❌ *Rejected*\n\nJob: \`${jobId}\`\n\nApproval request cancelled.`;

  return sendMessage(text);
}

function answerCallbackQuery(callbackQueryId, text) {
  if (!BOT_TOKEN) return Promise.resolve({ ok: false });

  const postData = JSON.stringify({
    callback_query_id: callbackQueryId,
    text,
  });

  const options = {
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${BOT_TOKEN}/answerCallbackQuery`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ ok: true }));
    });
    req.on('error', () => resolve({ ok: false }));
    req.write(postData);
    req.end();
  });
}

module.exports = {
  sendMessage,
  sendApprovalRequest,
  sendApprovalConfirmation,
  sendRejectionConfirmation,
  answerCallbackQuery,
  setChatId: (id) => {
    process.env.TELEGRAM_CHAT_ID = id;
  },
};