<!-- Machine Summary Block -->
{"file":"ai/tasks/TASK_004_local_editor_backend/checklist.md","purpose":"Defines the steps for implementing the Local Editor Backend REST endpoints."}

# Task Checklist: TASK_004_local_editor_backend

## Pre-execution
- [x] Read task.json, acceptance criteria, ai/AI_TASK_MONITOR_CONTRACT.md, docs/requirements_architecture.md, docs/schema_strategy.md, docs/file_access_layer.md
- [x] Review FileAccess API and generator script usage patterns
- [x] Confirm `src/server/` structure, testing strategy (supertest), and dependency requirements

## Execution
- [x] Scaffold Express server entry (`src/server/app.ts`) wiring JSON parsing, error handling, and FileAccess injection
- [x] Implement task listing endpoint (`GET /api/tasks`) returning task metadata from ai/tasks directory
- [x] Implement task detail endpoint (`GET /api/tasks/:id`) returning task.json, checklist, and progress log
- [x] Implement task creation endpoint (`POST /api/tasks`) cloning templates via FileAccess logic with validation
- [x] Implement checklist update endpoint (`PATCH /api/tasks/:id/checklist`) toggling steps and logging progress
- [x] Implement log append endpoint (`POST /api/tasks/:id/logs`) writing NDJSON entries with schema validation
- [x] Implement contract/prompt regeneration endpoints as needed (`POST /api/contracts/regenerate`, `POST /api/contracts/prompts`)
- [x] Add schema/error middleware returning 4xx responses for validation issues
- [x] Write integration tests (`src/server/server.test.ts`) covering each endpoint against a temp sandbox
- [x] Document endpoints, payloads, and error semantics in `docs/local_editor_backend.md`
- [x] Log progress events for key milestones

## Validation
- [x] Run `npm test` (ensure server tests included) and confirm all pass
- [x] Execute `node scripts/validate_schemas.mjs` if JSON/Markdown changed
- [x] Verify acceptance criteria satisfied and docs include Machine Summary Blocks

## Completion
- [x] Mark checklist items `[x]` when validated
- [x] Append `task_completed` entry to progress.ndjson
- [x] Update ai/tasks/current_index.json to reflect task status
