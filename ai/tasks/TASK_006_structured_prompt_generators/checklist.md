<!-- Machine Summary Block -->
{"file":"ai/tasks/TASK_006_structured_prompt_generators/checklist.md","purpose":"Guides the creation of structured prompt generators, blueprints, and integrations for Claude/Codex workflows."}

# Task Checklist: TASK_006_structured_prompt_generators

## Pre-execution
- [x] Read task.json, acceptance criteria, ai/TO-DO.md item 6, docs/schema_strategy.md, docs/requirements_architecture.md
- [x] Review existing prompt template assets (`ai/templates/prompt_template.json`) and backend/UI requirements for prompt generation
- [x] Confirm directories/schemas to update (`ai/templates/prompt_blueprints/`, `schemas/`, FileAccess helpers) and plan logging touchpoints

## Execution
- [x] Define prompt blueprint schema plus initial blueprints (structured checklist + agent instruction) with Machine Summary Blocks stored under `ai/templates/prompt_blueprints/`
- [x] Implement TypeScript generator module/CLI (`scripts/generate_structured_prompt.ts`) that loads blueprints, enforces schema validation, injects Machine Summary Blocks, and writes outputs via FileAccess
- [x] Add schema + validation wiring (e.g., `schemas/prompt_blueprint.json`, updates to `scripts/validate_schemas.mjs`, package.json scripts) ensuring generated artifacts lint clean
- [x] Create automated tests (`scripts/__tests__/generate_structured_prompt.test.ts`) covering blueprint parsing, deterministic output, and logging/error cases
- [x] Expose generator via backend/UI integrations (e.g., `src/server/routes/prompts.ts`, service hooks, package scripts) with logging to the appropriate progress.ndjson
- [x] Document blueprint format, CLI usage, backend/UI flows, and manual validation steps in `docs/structured_prompt_generators.md`
- [x] Append progress entries for blueprint creation, generator implementation, integration, and documentation milestones

## Validation
- [x] Run generator unit/integration tests plus targeted backend/UI checks as applicable
- [x] Execute `node scripts/validate_schemas.mjs` and ensure new schema + sample outputs pass
- [x] Manually generate at least one prompt artifact, confirm Machine Summary Block + schema compliance, and capture results in documentation/logs

## Completion
- [x] Verify all checklist items are `[x]`, acceptance criteria satisfied, and generator accessible via documented entry point
- [x] Append `task_completed` entry to progress.ndjson with summary of delivered assets
- [x] Update `ai/tasks/current_index.json` with final status and ensure no validation rules are pending
