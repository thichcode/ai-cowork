const path = require('path');
const { createJobState, pushMessage } = require('./runtime/jobState');
const { buildPlan, revisePlan } = require('./agents/plannerAgent');
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
const { evaluateResult, MAX_ITERATIONS } = require('./supervisor/goalTracker');
const { validateRequest, checkImprovementFeasibility } = require('./supervisor/dataSufficiency');
const { generate } = require('./llm');
const { saveJob, saveEvent } = require('./runtime/jobStore');

async function orchestrate(request, ctx = {}) {
  const state = createJobState(request, ctx.modelConfig || {});
  const dataDir = ctx.dataDir || path.resolve(__dirname, '../data');
  const emit = typeof ctx.onEvent === 'function' ? ctx.onEvent : () => {};

  try { require('fs').mkdirSync(dataDir, { recursive: true }); } catch {};

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
  await saveJob(state).catch(e => console.error('[Persist] save error:', e.message));

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
    await saveJob(state).catch(e => console.error('[Persist] save error:', e.message));
    await saveEvent(state.job.id, 'awaiting_approval', { approvalId: approvalReq.id }).catch(() => {});
    
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

  const execCtx = { ...ctx, dataDir, llm: generate };

  const validation = await validateRequest(request, dataDir);
  if (validation.status !== 'SUFFICIENT') {
    state.job.status = validation.status;
    state.job.completedAt = new Date().toISOString();
    state.sufficiency = validation;
    pushMessage(state, { jobId: state.job.id, from: 'gateway', to: 'dispatcher', type: validation.status, payload: validation });
    emit({ type: validation.status, jobId: state.job.id, validation, timestamp: new Date().toISOString() });
    return {
      job: state.job,
      plans: state.plans,
      tasks: state.tasks,
      messages: state.messages,
      sufficiency: validation,
      status: validation.status,
    };
  }

  const disableAutoIteration = ctx.disableAutoIteration === true;
  let currentPlan = plan;

  do {
    await runDispatcher(state, currentPlan, agentRegistry, execCtx);
    await saveJob(state).catch(e => console.error('[Persist] save error:', e.message));
    await saveEvent(state.job.id, 'iteration_complete', { iteration: state.job.iterationCount }).catch(() => {});

    if (disableAutoIteration) break;

    const evaluation = evaluateResult(state, request, state.job.iterationCount);
    state.job.iterationCount++;

    emit({ type: 'iteration_completed', jobId: state.job.id, iteration: state.job.iterationCount, evaluation, timestamp: new Date().toISOString() });

    if (evaluation.isMet) {
      break;
    }

    const feasibility = checkImprovementFeasibility(state.job.goalHistory);
    if (!feasibility.feasible) {
      state.job.status = 'INSUFFICIENT_DATA';
      state.job.sufficiencyReason = feasibility.reason;
      emit({ type: 'insufficient_data', jobId: state.job.id, feasibility, timestamp: new Date().toISOString() });
      break;
    }

    if (state.job.iterationCount >= MAX_ITERATIONS) {
      state.job.status = 'MAX_ITERATIONS_EXCEEDED';
      break;
    }

    currentPlan = revisePlan(request, state, evaluation);
    state.plans.push(currentPlan);
    state.job.currentPlanId = currentPlan.id;

    pushMessage(state, { jobId: state.job.id, from: 'planner-agent', to: 'dispatcher', type: 'plan_revised', payload: { plan: currentPlan, evaluation } });
    emit({ type: 'plan_revised', jobId: state.job.id, planId: currentPlan.id, iteration: state.job.iterationCount, evaluation, timestamp: new Date().toISOString() });
  } while (true);

  if (state.job.status !== 'MAX_ITERATIONS_EXCEEDED' && state.job.status !== 'INSUFFICIENT_DATA') {
    state.job.status = 'COMPLETED';
  }
  state.job.completedAt = new Date().toISOString();
  await saveJob(state).catch(e => console.error('[Persist] final save error:', e.message));
  await saveEvent(state.job.id, 'job_complete', { status: state.job.status }).catch(() => {});
  emit({ type: 'job_completed', jobId: state.job.id, timestamp: state.job.completedAt, results: state.results, state, goalHistory: state.job.goalHistory });

  return {
    job: state.job,
    plans: state.plans,
    knowledge: state.knowledge,
    skills: state.skills,
    tasks: state.tasks,
    messages: state.messages,
    results: state.results,
    goalHistory: state.job.goalHistory,
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

  await runDispatcher(state, plan, agentRegistry, { ...ctx, dataDir, llm: generate });
  await saveJob(state).catch(e => console.error('[Persist] save error:', e.message));

  state.job.status = 'COMPLETED';
  state.job.completedAt = new Date().toISOString();
  await saveJob(state).catch(e => console.error('[Persist] final save error:', e.message));
  await saveEvent(state.job.id, 'job_complete', { status: state.job.status }).catch(() => {});
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