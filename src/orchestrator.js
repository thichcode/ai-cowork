const path = require('path');
const { createJobState, pushMessage } = require('./runtime/jobState');
const { buildPlan } = require('./agents/plannerAgent');
const { runDispatcher } = require('./agents/dispatcher');
const { dataAgent, rcaAgent, reportAgent } = require('./agents/specialistAgents');
const { normalizeInput } = require('./supervisor/normalizer');
const { retrieveMemory, writeMemory } = require('./supervisor/memoryStore');
const { classifyIntent } = require('./supervisor/classifier');
const { evaluateRisk } = require('./supervisor/riskEvaluator');
const { decideExecutionPath } = require('./supervisor/decisionEngine');
const { contextAgent, policyAgent, knowledgeAgent, draftAgent, qaAgent } = require('./supervisor/agents');
const { aggregateResult } = require('./supervisor/aggregator');
const { generateProposals, selectBestProposal } = require('./supervisor/proposalGenerator');
const { createApprovalRequest, getApprovalRequest, approveProposal, isAwaitingApproval } = require('./supervisor/approvalHandler');

async function orchestrate(request, ctx = {}) {
  const state = createJobState(request, ctx.modelConfig || {});
  const emit = typeof ctx.onEvent === 'function' ? ctx.onEvent : () => {};

  state.job.status = 'PLANNING';
  state.job.startedAt = new Date().toISOString();
  pushMessage(state, { jobId: state.job.id, from: 'gateway', to: 'planner-agent', type: 'job_received', payload: { request } });
  emit({ type: 'job_received', jobId: state.job.id, request, timestamp: new Date().toISOString() });

  const plan = buildPlan(request);
  state.plans.push(plan);
  state.knowledge = plan.retrievedKnowledge || [];
  state.skills = plan.selectedSkills || [];
  state.job.currentPlanId = plan.id;
  pushMessage(state, { jobId: state.job.id, from: 'planner-agent', to: 'dispatcher', type: 'plan_created', payload: plan });
  emit({ type: 'plan_created', jobId: state.job.id, planId: plan.id, tasks: plan.tasks, modelConfig: state.job.modelConfig, skills: state.skills, knowledge: state.knowledge, timestamp: new Date().toISOString() });

  const proposals = generateProposals(request, plan, state.skills, state.knowledge);
  state.proposals = proposals;
  
  if (ctx.waitForApproval) {
    state.job.status = 'AWAITING_APPROVAL';
    state.job.approvalStatus = 'PENDING';
    
    const approvalReq = createApprovalRequest(state.job.id, proposals, {
      request,
      planId: plan.id,
      planTasks: plan.tasks,
      skills: state.skills,
      knowledge: state.knowledge,
    });
    
    pushMessage(state, { jobId: state.job.id, from: 'planner-agent', to: 'approval-handler', type: 'approval_requested', payload: approvalReq });
    emit({ type: 'approval_requested', jobId: state.job.id, approvalId: approvalReq.id, proposals, timestamp: new Date().toISOString() });
    
    return {
      job: state.job,
      plans: state.plans,
      knowledge: state.knowledge,
      skills: state.skills,
      tasks: state.tasks,
      messages: state.messages,
      proposals,
      approval: approvalReq,
      status: 'AWAITING_APPROVAL',
    };
  }

  state.job.status = 'RUNNING';

  const agentRegistry = {
    'data-agent': dataAgent,
    'rca-agent': rcaAgent,
    'report-agent': reportAgent,
  };

  await runDispatcher(state, plan, agentRegistry, ctx);

  state.job.status = 'COMPLETED';
  state.job.completedAt = new Date().toISOString();
  emit({ type: 'job_completed', jobId: state.job.id, timestamp: state.job.completedAt, results: state.results, state });

  return {
    job: state.job,
    plans: state.plans,
    knowledge: state.knowledge,
    skills: state.skills,
    tasks: state.tasks,
    messages: state.messages,
    results: state.results,
  };
}

module.exports = {
  orchestrate,
  resumeExecution,
};

async function resumeExecution(jobId, proposalId, ctx = {}) {
  const approval = getApprovalRequest(jobId);
  if (!approval) {
    throw new Error('No pending approval found for job: ' + jobId);
  }
  
  const result = approveProposal(jobId, proposalId);
  if (!result.success) {
    throw new Error(result.error);
  }
  
  const dataDir = ctx.dataDir || path.resolve(__dirname, '../data');
  const state = createJobState(approval.metadata.request, ctx.modelConfig || {});
  state.job.id = jobId;
  state.job.status = 'RUNNING';
  state.job.approvalStatus = 'APPROVED';
  state.job.approvedProposalId = proposalId;
  state.job.currentPlanId = approval.metadata.planId;
  state.plans = [{ id: approval.metadata.planId, tasks: approval.metadata.planTasks || [] }];
  state.skills = approval.metadata.skills || [];
  state.knowledge = approval.metadata.knowledge || [];
  
  const emit = typeof ctx.onEvent === 'function' ? ctx.onEvent : () => {};
  
  pushMessage(state, { jobId, from: 'approval-handler', to: 'dispatcher', type: 'approval_approved', payload: result.approval });
  emit({ type: 'approval_approved', jobId, proposalId, timestamp: new Date().toISOString() });

  const plan = { id: approval.metadata.planId, tasks: approval.metadata.planTasks || [] };
  const agentRegistry = {
    'data-agent': dataAgent,
    'rca-agent': rcaAgent,
    'report-agent': reportAgent,
  };

  await runDispatcher(state, plan, agentRegistry, { ...ctx, dataDir });

  state.job.status = 'COMPLETED';
  state.job.completedAt = new Date().toISOString();
  emit({ type: 'job_completed', jobId: state.job.id, timestamp: state.job.completedAt, results: state.results, state });

  return {
    job: state.job,
    plans: state.plans,
    knowledge: state.knowledge,
    skills: state.skills,
    tasks: state.tasks,
    messages: state.messages,
    results: state.results,
    approvedProposal: result.approval.selectedProposal,
  };
}

async function processSupervisorRequest(payload, ctx = {}) {
  const startedAt = Date.now();
  const normalized = normalizeInput(payload);
  const memory = retrieveMemory(normalized);
  const intent = classifyIntent(normalized, memory);
  const risk = evaluateRisk(normalized, intent);
  const decision = decideExecutionPath(intent, risk, normalized);

  let qa;
  let agentsUsed = [];

  if (decision.directAnswer) {
    const draft = {
      answer: `Direct response for ${normalized.user.displayName}: ${normalized.message.text}`,
    };
    qa = qaAgent(draft, intent, risk);
    agentsUsed = ['direct_answer'];
  } else {
    const context = contextAgent(normalized, memory);
    const policy = policyAgent(normalized, memory);
    const knowledge = knowledgeAgent(normalized, memory);
    const draft = draftAgent(normalized, context, policy, knowledge);
    qa = qaAgent(draft, intent, risk);
    agentsUsed = ['context_agent', 'policy_agent', 'knowledge_agent', 'draft_agent', 'qa_agent'];
  }

  const result = aggregateResult({
    data: normalized,
    intent,
    risk,
    qa,
    agentsUsed,
    processingTimeMs: Date.now() - startedAt,
    reviewOverride: decision.needsReview,
  });

  writeMemory(normalized, result);

  return {
    normalized,
    memory,
    intent,
    risk,
    decision,
    result,
  };
}

module.exports.processSupervisorRequest = processSupervisorRequest;