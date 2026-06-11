const { createTask, pushMessage, updateTask } = require('../runtime/jobState');

function groupTasksByLevel(tasks) {
  const levels = [];
  const completedIds = new Set();

  while (tasks.length > 0) {
    const remaining = [];
    const currentLevel = [];

    for (const task of tasks) {
      const deps = task.dependsOn || [];
      const allDepsMet = deps.every(d => completedIds.has(d));
      if (allDepsMet) {
        currentLevel.push(task);
      } else {
        remaining.push(task);
      }
    }

    if (currentLevel.length === 0) {
      console.warn(`[Dispatcher] Circular dependency or unmet deps for: ${remaining.map(t => t.id).join(', ')}`);
      levels.push(remaining);
      break;
    }

    levels.push(currentLevel);
    currentLevel.forEach(t => completedIds.add(t.id));
    tasks = remaining;
  }

  return levels;
}

async function runDispatcher(state, plan, agentRegistry, ctx) {
  const taskDefs = [...plan.tasks];
  const levels = groupTasksByLevel(taskDefs);

  for (const level of levels) {
    const promises = level.map(async (taskDef) => {
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

      try {
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
      } catch (err) {
        const errorOutput = { error: err.message, kind: 'error' };
        updateTask(state, task.id, { status: 'FAILED', completedAt: new Date().toISOString(), output: errorOutput });
        pushMessage(state, {
          jobId: state.job.id,
          taskId: task.id,
          from: task.assignedAgent,
          to: 'dispatcher',
          type: 'task_error',
          payload: errorOutput,
        });
      }
    });

    await Promise.all(promises);
  }
}

module.exports = {
  runDispatcher,
  groupTasksByLevel,
};