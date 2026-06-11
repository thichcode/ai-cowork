# OpenClaw Subagent Orchestrator

This repo contains the OpenClaw subagent orchestrator: a CLI/web assistant that accepts high-level operational prompts and runs them through a lightweight multi-agent runtime with `jobs`, `plans`, `tasks`, and `messages`. Specialist agents gather context via CSV files, Excel workbooks, or a SQLite database, then synthesize findings into a final report.

## How it works

1. You submit a request to the orchestrator (via CLI or Web UI).
2. A planner agent creates an execution plan.
3. A dispatcher creates tasks and routes them to specialist agents.
4. Data, RCA, and report agents exchange task messages through shared job state.
5. Responses are aggregated and displayed in a human-readable format.

## Running the demo

1. Install dependencies

```bash
npm install
```

2. Generate sample data (creates CSV, Excel, and SQLite fixtures under `./data`)

```bash
npm run generate-data
```

3. Execute the orchestrator with a request

```bash
npm start -- "backup health"
```

## Web UI for job / agent flow

You can also run a small web dashboard to visualize how a job flows through the orchestrator, agent, and connector nodes.

1. Make sure sample data exists:

```bash
npm run generate-data
```

2. Start the web server:

```bash
npm run start:web
```

3. Open `http://localhost:3000`

The UI will show:
- a flow graph from user request → gateway → planner → dispatcher → specialist agents → data sources
- task/message-driven execution state (`job_received`, `plan_created`, `task_request`, `task_result`, `job_completed`)
- the aggregated result payload returned by the orchestrator
- retrieved knowledge items matched to the request
- selected skills chosen by the planner for the current job

### Model config in UI

The left control panel now includes model/runtime configuration fields:
- Provider (`Mock Runtime`, `Ollama`, `OpenAI`, `OpenRouter`)
- Base URL
- Model name
- Temperature
- Planner model
- Report model

These values are submitted with each job as `modelConfig` and stored in the job state so the dashboard can display which runtime/model was used.

You can swap the text after `node src/index.js` for other intents such as `RCA nginx`, `monitor status`, or `database sync` to exercise different keyword matches. If no keyword matches, the orchestrator prints a fallback note.

## Extending with intelligent agents

OpenClaw is designed to plug into external LLM services or internal connectors. If you want an intelligent agent capability like Olama, create a new subagent that transforms the orchestrator request into an API call, sends the prompt to Olama, and feeds the response back into the aggregation step. Because Olama exposes HTTP endpoints, you can wrap it in a subagent handler (e.g., `olamaAgent.js`) and add it to `agentMap` with the keywords it should respond to.

## Supervisor SRS MVP endpoint

The project now includes a Supervisor-style MVP pipeline aligned with the provided SRS.

### Endpoint

```bash
POST /api/supervisor/process
```

### Example input

```json
{
  "request_id": "req_001",
  "source": "ms_teams",
  "timestamp": "2026-04-05T14:00:00.000Z",
  "user": {
    "id": "u_123",
    "display_name": "Nguyen Van A"
  },
  "conversation": {
    "thread_id": "thread_001",
    "message_id": "msg_001"
  },
  "case": {
    "case_id": "case_001",
    "priority": "medium"
  },
  "message": {
    "text": "Please analyze this support case and prepare a safe response based on policy"
  }
}
```

### Example output

```json
{
  "request_id": "req_001",
  "status": "completed",
  "answer": "...",
  "confidence": 0.82,
  "risk_level": "medium",
  "metadata": {
    "intent": "support_case",
    "agents_used": ["context_agent", "policy_agent", "knowledge_agent", "draft_agent", "qa_agent"],
    "processing_time_ms": 12
  }
}
```

### Included in MVP

- input normalizer
- memory retrieval/write (in-memory)
- intent classifier
- risk evaluator
- decision engine
- context/policy/knowledge/draft/qa agents
- SRS-style output contract