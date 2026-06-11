const https = require('https');

const POLL_TIMEOUT = 30;

let botToken = null;
let offset = 0;
let isPolling = false;
let pollInterval = null;

let onCallbackQuery = null;

function setToken(token) {
  botToken = token;
}

function setCallbacks({ onCallback } = {}) {
  if (onCallback) onCallbackQuery = onCallback;
}

function getUpdates() {
  if (!botToken) {
    console.warn('[Telegram Polling] BOT_TOKEN not set');
    return Promise.resolve({ ok: false, error: 'BOT_TOKEN not set' });
  }

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/getUpdates?timeout=${POLL_TIMEOUT}&offset=${offset}`,
      method: 'GET',
    };

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

    req.on('error', (err) => {
      resolve({ ok: false, error: err.message });
    });

    req.setTimeout(POLL_TIMEOUT * 1000 + 5000, () => {
      req.destroy();
      resolve({ ok: false, error: 'timeout' });
    });

    req.end();
  });
}

async function processUpdates(updates) {
  if (!updates || !updates.ok || !updates.result) return;

  for (const update of updates.result) {
    offset = update.update_id + 1;

    if (update.callback_query) {
      const { id, data, message } = update.callback_query;
      const chatId = message?.chat?.id;
      const jobId = message?.text?.match(/Job ID: `([^`]+)`/)?.[1];

      console.log(`[Telegram Polling] Callback: ${data} for job ${jobId}`);

      if (onCallbackQuery) {
        await onCallbackQuery({ id, data, jobId, chatId });
      }

      await answerCallback(id, 'Processing...');
    }
  }
}

function answerCallback(callbackQueryId, text) {
  if (!botToken) return Promise.resolve({ ok: false });

  const postData = JSON.stringify({
    callback_query_id: callbackQueryId,
    text,
  });

  const options = {
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${botToken}/answerCallbackQuery`,
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

async function startPolling(intervalMs = 1000) {
  if (isPolling) {
    console.warn('[Telegram Polling] Already running');
    return;
  }

  if (!botToken) {
    console.warn('[Telegram Polling] BOT_TOKEN not set, cannot start');
    return;
  }

  isPolling = true;
  console.log('[Telegram Polling] Started');

  const poll = async () => {
    try {
      const updates = await getUpdates();
      await processUpdates(updates);
    } catch (err) {
      console.error('[Telegram Polling] Error:', err.message);
    }
  };

  pollInterval = setInterval(poll, intervalMs);
}

function stopPolling() {
  if (!isPolling) return;
  
  isPolling = false;
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  console.log('[Telegram Polling] Stopped');
}

function getStatus() {
  return {
    isPolling,
    offset,
    botToken: botToken ? '***' + botToken.slice(-4) : null,
  };
}

module.exports = {
  setToken,
  setCallbacks,
  startPolling,
  stopPolling,
  getStatus,
  answerCallback,
};