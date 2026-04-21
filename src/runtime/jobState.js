function createJobState(request, modelConfig = {}) {
  const jobId = `job_${Date.now()}`;
  return {
    job: {
      id: jobId,
      request,
      modelConfig,
      status: 'RECEIVED',
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      currentPlanId: null,
      approvalStatus: null,
      approvedProposalId: null,
    },
    plans: [],
    knowledge: [],
    skills: [],
    tasks: [],
    messages: [],
    artifacts: [],
    results: [],
  };
}

function pushMessage(state, message) {
  const entry = {
    id: `msg_${state.messages.length + 1}`,
    timestamp: new Date().toISOString(),
    ...message,
  };
  state.messages.push(entry);
  return entry;
}

function createTask(state, task) {
  const entry = {
    id: task.id || `task_${state.tasks.length + 1}`,
    status: 'CREATED',
    retryCount: 0,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    output: null,
    ...task,
  };
  state.tasks.push(entry);
  return entry;
}

function updateTask(state, taskId, patch) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return null;
  Object.assign(task, patch);
  return task;
}

module.exports = {
  createJobState,
  pushMessage,
  createTask,
  updateTask,
};