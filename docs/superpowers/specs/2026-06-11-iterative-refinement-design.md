# Iterative Refinement with Goal-Driven Loop

## Summary
Add an auto-loop mechanism to the orchestrator that evaluates execution results against a computed goal score and re-plans if the goal is not met, up to a maximum of 3 iterations.

## Motivation
The current orchestrator runs a single pass: plan → execute → done. There is no feedback loop to detect insufficient results. For complex requests, a single pass often produces shallow or incomplete output. This feature enables the system to self-improve by iterating until quality criteria are met.

## Architecture

### Flow
```
orchestrate(request)
  │
  ├─ buildPlan() → plan #1
  │
  ├─ do {
  │     runDispatcher(state, plan)
  │     evaluate = goalTracker.evaluate(state, request)
  │     if evaluate.isMet → break
  │     if iteration >= MAX_ITER → break with MAX_ITERATIONS_EXCEEDED
  │     plan = plannerAgent.revisePlan(request, state, evaluate)
  │     iteration++
  │   } while (true)
  │
  └─ COMPLETED / MAX_ITERATIONS_EXCEEDED
```

### Components

#### 1. GoalTracker (`src/supervisor/goalTracker.js`)
- `evaluateResult(state, request, iteration)` → `{ goalScore, gaps[], isMet, details }`
- Computes 4 sub-scores from agent outputs:
  - **completeness** — % of tasks that completed vs total dispatched
  - **coverage** — ratio of data sources actually read vs available
  - **depth** — whether RCA/report analysis is substantive (word count, finding count)
  - **relevance** — keyword/entity match between result and request
- `isMet = goalScore >= threshold` (default 0.75)

#### 2. PlannerAgent extension (`src/agents/plannerAgent.js`)
- `revisePlan(request, state, evaluation)` → new plan object
- Uses `evaluation.gaps` to generate targeted supplementary tasks:
  - coverage low → add data tasks for missing sources
  - depth low → add deeper RCA task
  - relevance low → add report revision task
- Preserves all previous task outputs in state

#### 3. SpecialistAgent outputs (`src/agents/specialistAgents.js`)
- Each agent now returns structured data with quality signals:
  - dataAgent: add `sourcesRead`, `totalSources`, `rowCount`
  - rcaAgent: add `findingsCount`, `analysisDepth`
  - reportAgent: add `confidence`, `wordCount`

#### 4. Orchestrator loop (`src/orchestrator.js`)
- Wrap `runDispatcher` + evaluation in a do-while loop
- Constants: `MAX_ITERATIONS = 3`, `GOAL_THRESHOLD = 0.75`
- New job status: `MAX_ITERATIONS_EXCEEDED` when loop limit reached
- Evaluator is bypassed if dispatcher throws (crashes to error)

### Data Structures

```js
// GoalTracker output:
{
  goalScore: 0.82,
  isMet: true,
  gaps: ['coverage'],
  details: {
    completeness: { score: 1.0, ok: true },
    coverage: { score: 0.5, ok: false },
    depth: { score: 0.9, ok: true },
    relevance: { score: 0.88, ok: true },
  },
}

// JobState additions:
{
  job: {
    ...existing,
    iterationCount: 0,
    goalHistory: [],  // evaluation snapshots per iteration
  },
}
```

### Error Handling
- If `runDispatcher` throws → bubble up, no retry
- If `revisePlan` returns empty tasks → stop with `GOAL_NOT_ACHIEVABLE` status
- Each agent error is caught at task level (not crash entire iteration)

## Files Changed
- NEW: `src/supervisor/goalTracker.js`
- MODIFY: `src/agents/plannerAgent.js` — add `revisePlan()`
- MODIFY: `src/agents/specialistAgents.js` — add confidence/coverage fields
- MODIFY: `src/agents/dispatcher.js` — add error handling per task
- MODIFY: `src/runtime/jobState.js` — add iteration tracking
- MODIFY: `src/orchestrator.js` — add loop + goal check
