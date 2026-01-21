<!-- Machine Summary Block -->
{"file":"docs/local_editor_backend.md","purpose":"Describes the Local Editor Backend REST API for the Milestone project."}

# Local Editor Backend

## 1. Overview
- **Purpose:** Provide a local REST interface for task CRUD operations, leveraging the FileAccess module for deterministic filesystem changes.
- **Stack:** Express 4 + TypeScript (`src/server/app.ts`) with routers under `src/server/routes/`.
- **Key features:** Task listing/detail, task creation from templates, checklist toggles, log append/fetch, template listing, contract/prompt regeneration, prompt blueprint generation, and feature-planning helpers.

## 2. Routes
| Method & Path | Description |
| --- | --- |
| `GET /health` | Simple readiness probe. |
| `GET /api/tasks` | Lists task metadata (ordered via `ai/tasks/order.json`). |
| `GET /api/tasks/:taskId` | Returns `task.json`, `checklist.md`, and `progress.ndjson` contents. |
| `POST /api/tasks` | Clones template files, auto-assigns the next `TASK_###`, and applies the provided title/description/priority. |
| `PATCH /api/tasks/:taskId/checklist` | Toggles a checklist line, ensuring `[x]/[ ]` substitution. |
| `PATCH /api/tasks/order` | Persists a new ordering array (validated against existing IDs) to `ai/tasks/order.json`. |
| `POST /api/tasks/:taskId/logs` | Appends NDJSON entries validated against `schemas/progress_event.json` and auto-captures a diff summary/patch (see `docs/log_diff_strategy.md`). |
| `GET /api/checklists/:taskId` | Fetches raw checklist text. |
| `GET /api/logs/:taskId` | Returns parsed NDJSON log entries. |
| `GET /api/templates` | Lists available task templates. |
| `GET /api/contracts/current` | Returns the current contract markdown text. |
| `POST /api/contracts/regenerate` | Writes new contract content to `ai/MILESTONE_CONTRACT.md`. |
| `GET /api/contracts/prompts` | Fetches the active prompt template JSON. |
| `POST /api/contracts/prompts` | Stores prompt template JSON validated via `schemas/prompt_template.json`. |
| `GET /api/prompts/blueprints` | Lists prompt blueprint metadata for the UI’s picker. |
| `POST /api/prompts/generate` | Renders a blueprint with supplied variables (defaults to dry-run/non-persisting). |
| `POST /api/features/plan` | Wraps the `task_creation` blueprint to produce feasibility plans + the next task ID. |

## 3. Architecture
- `createApp(config)` builds the Express app and injects a `FileAccess` instance.
- Routers encapsulate domain logic (`routes/tasks.ts`, `routes/checklists.ts`, `routes/logs.ts`, `routes/templates.ts`, `routes/contracts.ts`).
- Shared helpers live in `src/server/lib/taskStore.ts` (listing tasks, parsing NDJSON, copying templates, toggling checklist lines, etc.).
- Error handling converts `FileAccessError` and `ZodError` into structured JSON responses.

## 4. Validation & Logging
- Request payloads validated using Zod schemas per route; failures return HTTP 400 with error arrays.
- File operations rely on FileAccess, ensuring atomic writes, schema validation hooks, and JSON logging to `logs/file_access.log`.
- Integration tests (`src/server/server.test.ts`) run via `npm test` alongside filesystem tests.

## 5. Usage
```bash
npm install
START_SERVER=true PORT=3001 npm run dev
curl http://localhost:3001/api/tasks
```
- Create a task: `POST /api/tasks` with `{ "title": "New feature", "description": "context", "priority": "high" }`; the server assigns the next `TASK_###`.
- Reorder the backlog: `PATCH /api/tasks/order` with `{ "order": ["TASK_009...", "TASK_008...", ...] }` (mirrors the drag-and-drop UI and updates `ai/tasks/order.json`).
- Toggle a checklist line: `PATCH /api/tasks/TASK_010_example/checklist` body `{ "line": 5, "checked": true }`.
- Append a progress log: `POST /api/tasks/TASK_010_example/logs` with `ts`, `event`, `status`, `agent`, `details`. The backend will attach a diff snapshot automatically (or you can include a custom `diff` payload).
- Inspect the upcoming diff payload locally: `npm run log:diff` (wraps `scripts/log_diff_preview.ts`) to preview the summary/files/patch that will be stored.
- Generate a feasibility plan: `POST /api/features/plan` with title/summary/inputs/expectedFiles/acceptanceCriteria to run the `task_creation` blueprint (dry-run only).
- Blueprint dry-run: `POST /api/prompts/generate` with `{ "blueprintId": "structured_checklist", "variables": {...} }` (omit `persist` or set to `false` when using the UI).
- Contract/Prompt CRUD: `GET/POST /api/contracts/*` as before; `GET /api/prompts/blueprints` backs the blueprint dropdown.

## 6. Testing
- Run `npm test` to execute both filesystem and server integration tests.
- Tests spin up the Express app against a temporary FileAccess root to avoid mutating the real repo.
- Schema validation remains available via `npm run schema:lint`.

## 7. Future Enhancements
1. Add authentication for API access (e.g., tokens or local auth).
2. Support pagination/filtering on task list endpoint.
3. Stream log updates via SSE/WebSocket for live UI updates.
