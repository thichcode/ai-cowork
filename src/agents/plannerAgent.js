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
    id: `plan_${Date.now()}`,
    version: 1,
    tasks,
    selectedSkills,
    retrievedKnowledge,
  };
}

module.exports = {
  buildPlan,
};