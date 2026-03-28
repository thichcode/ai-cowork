# OpenClaw Subagent Orchestrator

This repo contains the OpenClaw subagent orchestrator: a CLI-driven assistant that accepts high-level operational prompts (backup health, RCA, monitoring) and fans them out to purpose-built subagents. Subagents gather context via CSV files, Excel workbooks, or a SQLite database, then synthesize summaries, charts, and RCA notes.

## How it works

1. You submit a request to the orchestrator (via the CLI).
2. The orchestrator picks matching subagents based on keywords.
3. Subagents use data connectors (CSV, Excel, database) to gather context.
4. Responses are aggregated and displayed in a human-readable format.

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

You can swap the text after `node src/index.js` for other intents such as `RCA nginx`, `monitor status`, or `database sync` to exercise different keyword matches. If no keyword matches, the orchestrator prints a fallback note.

## Extending with intelligent agents

OpenClaw is designed to plug into external LLM services or internal connectors. If you want an intelligent agent capability like Olama, create a new subagent that transforms the orchestrator request into an API call, sends the prompt to Olama, and feeds the response back into the aggregation step. Because Olama exposes HTTP endpoints, you can wrap it in a subagent handler (e.g., `olamaAgent.js`) and add it to `agentMap` with the keywords it should respond to.