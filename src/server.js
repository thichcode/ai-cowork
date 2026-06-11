const express = require('express');
const path = require('path');
const { orchestrate, processSupervisorRequest, resumeExecution } = require('./orchestrator');
const { getApprovalRequest, approveProposal, rejectProposal, pendingApprovals, setCallbacks } = require('./supervisor/approvalHandler');
const { sendApprovalRequest, sendApprovalConfirmation, sendRejectionConfirmation } = require('./notifiers/telegramNotifier');
const { setToken: setTelegramToken, startPolling, stopPolling, getStatus, setCallbacks: setPollingCallbacks } = require('./notifiers/telegramPolling');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.resolve(__dirname, '../public')));

setCallbacks({
  onCreated: (jobId, proposals, metadata) => {
    console.log(`[Approval] Created for job ${jobId}`);
    sendApprovalRequest(jobId, proposals).catch((err) => console.error('[Telegram] Error:', err.message));
  },
  onApproved: (jobId, proposalId, proposal) => {
    console.log(`[Approval] Approved ${proposalId} for job ${jobId}`);
    sendApprovalConfirmation(jobId, proposalId, proposal.name).catch((err) => console.error('[Telegram] Error:', err.message));
  },
  onRejected: (jobId, response) => {
    console.log(`[Approval] Rejected for job ${jobId}`);
    sendRejectionConfirmation(jobId).catch((err) => console.error('[Telegram] Error:', err.message));
  },
});

setPollingCallbacks({
  onCallback: async ({ id, data, jobId, chatId }) => {
    try {
      if (data?.startsWith('approve_proposal_')) {
        const proposalId = data.replace('approve_proposal_', 'proposal_');
        await resumeExecution(jobId, proposalId, {
          dataDir: path.resolve(__dirname, '../data'),
        });
      } else if (data === 'reject_approval') {
        rejectProposal(jobId, 'Rejected via Telegram');
      }
    } catch (err) {
      console.error('[Telegram Polling] Handle callback error:', err.message);
    }
  },
});

app.post('/api/telegram/webhook', express.json(), async (req, res) => {
  const { callback_query } = req.body;
  
  if (callback_query) {
    const { id, data, message } = callback_query;
    const chatId = message?.chat?.id;
    
    if (data?.startsWith('approve_proposal_')) {
      const proposalId = data.replace('approve_proposal_', 'proposal_');
      const jobId = message?.text?.match(/Job ID: `([^`]+)`/)?.[1];
      
      if (jobId) {
        answerCallbackQuery(id, 'Processing...').catch(() => {});
        
        try {
          await resumeExecution(jobId, proposalId, {
            dataDir: path.resolve(__dirname, '../data'),
          });
          answerCallbackQuery(id, '✅ Approved and executing!').catch(() => {});
        } catch (err) {
          answerCallbackQuery(id, `❌ Error: ${err.message}`).catch(() => {});
        }
      }
    } else if (data === 'reject_approval') {
      const jobId = message?.text?.match(/Job ID: `([^`]+)`/)?.[1];
      
      if (jobId) {
        rejectProposal(jobId, 'Rejected via Telegram');
        answerCallbackQuery(id, '❌ Rejected').catch(() => {});
      }
    }
    
    return res.json({ ok: true });
  }
  
  res.json({ ok: false, error: 'No callback_query' });
});

app.post('/api/jobs', async (req, res) => {
  const request = (req.body?.request || 'backup report').trim();
  const modelConfig = req.body?.modelConfig || {};
  const waitForApproval = req.body?.waitForApproval || false;
  const events = [];

  try {
    const execution = await orchestrate(request, {
      dataDir: path.resolve(__dirname, '../data'),
      modelConfig,
      waitForApproval,
      onEvent: (event) => events.push({ id: events.length + 1, ...event }),
    });

    res.json({
      request,
      job: execution.job,
      plans: execution.plans,
      tasks: execution.tasks,
      messages: execution.messages,
      events,
      results: execution.results,
      proposals: execution.proposals,
      approval: execution.approval,
      status: execution.status,
    });
  } catch (error) {
    res.status(500).json({
      request,
      events,
      error: error.message,
    });
  }
});

app.post('/api/jobs/:jobId/approve', async (req, res) => {
  const { jobId } = req.params;
  const { proposalId, response } = req.body;
  const events = [];

  try {
    const result = await resumeExecution(jobId, proposalId, {
      dataDir: path.resolve(__dirname, '../data'),
      onEvent: (event) => events.push({ id: events.length + 1, ...event }),
    });

    res.json({
      job: result.job,
      tasks: result.tasks,
      messages: result.messages,
      results: result.results,
      approvedProposal: result.approvedProposal,
      events,
    });
  } catch (error) {
    res.status(400).json({
      error: error.message,
    });
  }
});

app.get('/api/approvals/:jobId', (req, res) => {
  const { jobId } = req.params;
  const approval = getApprovalRequest(jobId);
  
  if (!approval) {
    return res.status(404).json({ error: 'Approval not found' });
  }
  
  res.json(approval);
});

app.post('/api/approvals/:jobId/reject', (req, res) => {
  const { jobId } = req.params;
  const { response } = req.body;
  
  const result = rejectProposal(jobId, response);
  
  if (!result.success) {
    return res.status(400).json(result);
  }
  
  res.json(result.approval);
});

app.post('/api/supervisor/process', async (req, res) => {
  try {
    const execution = await processSupervisorRequest(req.body || {});
    res.json(execution.result);
  } catch (error) {
    res.status(500).json({
      request_id: req.body?.request_id || null,
      status: 'needs_review',
      answer: '',
      confidence: 0,
      risk_level: 'high',
      metadata: {
        intent: 'unknown',
        agents_used: [],
        processing_time_ms: 0,
      },
      error: error.message,
    });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/telegram/setChatId', express.json(), (req, res) => {
  const { chatId } = req.body;
  if (!chatId) {
    return res.status(400).json({ error: 'chatId required' });
  }
  process.env.TELEGRAM_CHAT_ID = chatId;
  res.json({ ok: true, chatId });
});

app.post('/api/telegram/setToken', express.json(), (req, res) => {
  const { token, startPolling: shouldStartPolling } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'token required' });
  }
  process.env.TELEGRAM_BOT_TOKEN = token;
  setTelegramToken(token);
  
  if (shouldStartPolling) {
    startPolling();
  }
  
  res.json({ ok: true });
});

app.post('/api/telegram/polling/start', (req, res) => {
  startPolling();
  res.json({ ok: true, status: getStatus() });
});

app.post('/api/telegram/polling/stop', (req, res) => {
  stopPolling();
  res.json({ ok: true, status: getStatus() });
});

app.get('/api/telegram/status', (req, res) => {
  res.json(getStatus());
});

app.listen(PORT, () => {
  console.log(`OpenClaw web UI running at http://localhost:${PORT}`);
});