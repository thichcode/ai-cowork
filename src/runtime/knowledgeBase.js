const knowledgeItems = [
  {
    id: 'kb_backup_playbook',
    title: 'Backup Health Playbook',
    tags: ['backup', 'report', 'csv', 'db', 'excel'],
    summary: 'When checking backup health, compare exported CSV status, database backup rows, and Excel service metrics before writing the final report.',
    body: 'Validate backup status from CSV export, compare with database rows, and confirm service metrics from Excel before reporting health.',
  },
  {
    id: 'kb_rca_pattern',
    title: 'RCA Investigation Pattern',
    tags: ['rca', 'incident', 'monitoring', 'logs'],
    summary: 'RCA tasks should collect evidence first, then synthesize hypotheses, then produce a final report.',
    body: 'Gather signals from monitoring, logs, deployments, and structured data. Build hypotheses only after evidence collection.',
  },
];

const skillRegistry = [
  {
    id: 'skill.backup.health',
    name: 'Backup Health Analysis',
    tags: ['backup', 'report'],
    attachedAgents: ['planner-agent', 'data-agent', 'rca-agent', 'report-agent'],
    description: 'Analyze backup status from CSV, DB, and Excel, then synthesize a report.',
  },
  {
    id: 'skill.rca.default',
    name: 'Default RCA Pattern',
    tags: ['rca', 'incident'],
    attachedAgents: ['planner-agent', 'rca-agent', 'report-agent'],
    description: 'Use evidence-first RCA flow: collect, reason, summarize.',
  },
];

function retrieveKnowledge(request) {
  const normalized = request.toLowerCase();
  return knowledgeItems.filter((item) => item.tags.some((tag) => normalized.includes(tag)));
}

function selectSkills(request) {
  const normalized = request.toLowerCase();
  return skillRegistry.filter((skill) => skill.tags.some((tag) => normalized.includes(tag)));
}

module.exports = {
  knowledgeItems,
  skillRegistry,
  retrieveKnowledge,
  selectSkills,
};