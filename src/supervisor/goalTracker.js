const DEFAULT_THRESHOLD = 0.75;
const MAX_ITERATIONS = 3;

function evaluateResult(state, request, iteration) {
  const tasks = state.tasks || [];
  const results = state.results || [];
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
  const failedTasks = tasks.filter((t) => t.status === 'FAILED').length;

  const completeness = totalTasks > 0 ? (completedTasks / totalTasks) : 0;

  const dataTasks = tasks.filter((t) => t.assignedAgent === 'data-agent' && t.output);
  const successfulDataTasks = dataTasks.filter((t) => t.status === 'COMPLETED');
  const coverage = dataTasks.length > 0 ? (successfulDataTasks.length / dataTasks.length) : 0;

  const rcaTask = tasks.find((t) => t.assignedAgent === 'rca-agent' && t.output);
  const depth = rcaTask && rcaTask.output ? Math.min((rcaTask.output.findingsCount || 0) / 3, 1) : 0;

  const requestWords = request.toLowerCase().split(/\s+/);
  const resultText = results.map((r) => JSON.stringify(r).toLowerCase()).join(' ');
  const matchedWords = requestWords.filter((w) => resultText.includes(w));
  const relevance = requestWords.length > 0 ? (matchedWords.length / requestWords.length) : 0;

  const details = {
    completeness: { score: +completeness.toFixed(2), ok: completeness >= 0.9 },
    coverage: { score: +coverage.toFixed(2), ok: coverage >= 0.8 },
    depth: { score: +depth.toFixed(2), ok: depth >= 0.5 },
    relevance: { score: +relevance.toFixed(2), ok: relevance >= 0.5 },
  };

  const goalScore = +((completeness + coverage + depth + relevance) / 4).toFixed(2);
  const isMet = goalScore >= DEFAULT_THRESHOLD || iteration >= MAX_ITERATIONS - 1;

  const gaps = Object.entries(details)
    .filter(([, v]) => !v.ok)
    .map(([k]) => k);

  const evaluation = { goalScore, isMet, gaps, iteration, details };

  state.job.goalHistory = state.job.goalHistory || [];
  state.job.goalHistory.push(evaluation);

  return evaluation;
}

function isGoalMet(state) {
  const history = state.job.goalHistory || [];
  if (history.length === 0) return false;
  return history[history.length - 1].isMet;
}

function getIteration(state) {
  return state.job.iterationCount || 0;
}

module.exports = {
  evaluateResult,
  isGoalMet,
  getIteration,
  DEFAULT_THRESHOLD,
  MAX_ITERATIONS,
};