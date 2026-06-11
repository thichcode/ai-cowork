const { retrieveKnowledge, selectSkills } = require('../runtime/knowledgeBase');

function buildPlan(request) {
  const normalized = request.toLowerCase();
  const tasks = [];
  const retrievedKnowledge = retrieveKnowledge(request);
  const selectedSkills = selectSkills(request);

  if (normalized.includes('backup') || normalized.includes('report')) {
    tasks.push(
      { id: 'task_data_csv', assignedAgent: 'data-agent', goal: 'Read backup CSV', source: 'csv' },
      { id: 'task_data_db', assignedAgent: 'data-agent', goal: 'Read backup DB', source: 'db' },
      { id: 'task_data_excel', assignedAgent: 'data-agent', goal: 'Read backup Excel', source: 'excel' },
      { id: 'task_rca', assignedAgent: 'rca-agent', goal: 'Synthesize findings', dependsOn: ['task_data_csv', 'task_data_db', 'task_data_excel'] },
      { id: 'task_report', assignedAgent: 'report-agent', goal: 'Write final report', dependsOn: ['task_rca'] }
    );
  }

  if (tasks.length === 0) {
    tasks.push({ id: 'task_report', assignedAgent: 'report-agent', goal: 'Return fallback response' });
  }

  return {
    id: `plan_${Date.now()}_v1`,
    version: 1,
    tasks,
    selectedSkills,
    retrievedKnowledge,
  };
}

function revisePlan(request, state, evaluation) {
  const normalized = request.toLowerCase();
  const newTasks = [];
  const prefix = `iter_${(state.job.iterationCount || 0) + 1}`;

  if (evaluation.gaps.includes('coverage')) {
    const dataTasks = state.tasks.filter((t) => t.assignedAgent === 'data-agent');
    const sourcesRead = new Set(dataTasks.filter((t) => t.status === 'COMPLETED').map((t) => t.source));
    const missingSources = [];

    if (!sourcesRead.has('csv') && (!normalized.includes('backup') || !normalized.includes('report'))) {
      missingSources.push('csv');
    }
    if (!sourcesRead.has('db')) missingSources.push('db');
    if (!sourcesRead.has('excel')) missingSources.push('excel');

    if (missingSources.length === 0) {
      const allDataTasks = ['csv', 'db', 'excel'].filter((s) => !sourcesRead.has(s));
      if (allDataTasks.length > 0) {
        missingSources.push(allDataTasks[0]);
      } else {
        newTasks.push({
          id: `${prefix}_data_refresh`,
          assignedAgent: 'data-agent',
          goal: 'Re-read all data sources for updated state',
          source: 'all',
        });
      }
    }

    missingSources.forEach((src) => {
      newTasks.push({
        id: `${prefix}_data_${src}`,
        assignedAgent: 'data-agent',
        goal: `Read ${src} data (improving coverage)`,
        source: src,
      });
    });
  }

  if (evaluation.gaps.includes('depth')) {
    newTasks.push({
      id: `${prefix}_rca_deep`,
      assignedAgent: 'rca-agent',
      goal: 'Deeper RCA analysis with root cause identification',
      source: 'rca',
    });
  }

  if (evaluation.gaps.includes('relevance')) {
    newTasks.push({
      id: `${prefix}_report_refine`,
      assignedAgent: 'report-agent',
      goal: `Refine report to address: ${request}`,
      source: 'report',
    });
  }

  if (newTasks.length === 0) {
    newTasks.push({
      id: `${prefix}_report_supplement`,
      assignedAgent: 'report-agent',
      goal: `Supplement report for: ${request}`,
      source: 'report',
    });
  }

  return {
    id: `plan_${Date.now()}_v${(state.job.iterationCount || 0) + 2}`,
    version: (state.job.iterationCount || 0) + 2,
    tasks: newTasks,
    selectedSkills: state.skills || [],
    retrievedKnowledge: state.knowledge || [],
  };
}

module.exports = {
  buildPlan,
  revisePlan,
};