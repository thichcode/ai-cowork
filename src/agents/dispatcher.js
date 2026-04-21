const { createTask, pushMessage, updateTask } = require('../runtime/jobState');

async function runDispatcher(state, plan, agentRegistry, ctx) {
  for (const taskDef of plan.tasks) {
    const task = createTask(state, taskDef);
    updateTask(state, task.id, { status: 'DISPATCHED' });
    pushMessage(state, {
      jobId: state.job.id,
      taskId: task.id,
      from: 'dispatcher',
      to: task.assignedAgent,
      type: 'task_request',
      payload: { goal: task.goal, source: task.source || null, dependsOn: task.dependsOn || [] },
    });

    updateTask(state, task.id, { status: 'RUNNING', startedAt: new Date().toISOString() });
    const agent = agentRegistry[task.assignedAgent];
    const output = await agent(task, state, ctx);
    updateTask(state, task.id, { status: 'COMPLETED', completedAt: new Date().toISOString(), output });
    pushMessage(state, {
      jobId: state.job.id,
      taskId: task.id,
      from: task.assignedAgent,
      to: 'dispatcher',
      type: 'task_result',
      payload: output,
    });
  }
}

module.exports = {
  runDispatcher,
};