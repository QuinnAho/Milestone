<!-- Machine Summary Block -->
{"file":"docs/structured_prompt_generators.md","purpose":"Explains the structured prompt generator blueprints, CLI workflow, backend routes, and validation steps for AI Task Monitor."}

# Structured Prompt Generators

## 1. Overview
- **Goal:** Provide deterministic prompt/checklist artifacts for Claude/Codex agents using reusable blueprints stored under `ai/templates/prompt_blueprints/`.
- **Components:** JSON blueprints + schema, a shared generator module (`src/prompts/structuredPromptGenerator.ts`), a CLI (`npm run generate:prompt`), backend routes (`/api/prompts/*` and `/api/features/plan`), and Prompt Editor + Feature Planner UI hooks.
- **Logging:** Every generator run appends an event to the active task’s `progress.ndjson` via the shared FileAccess helper (unless explicitly skipped for feasibility planning).

## 2. Blueprint Format
- All blueprints conform to `schemas/prompt_blueprint.json` and live in `ai/templates/prompt_blueprints/`.
- Core fields:
  - `blueprint_id`, `description`, `agent`, and `summary` metadata (Machine Summary compatible).
  - `placeholders[]`: name/description/default metadata that drives variable substitution.
  - `template`: describes the resulting prompt template (id/description/body/tags/summary) that maps to `schemas/prompt_template.json`.
- Seed blueprints:
  - `structured_checklist.json`: emits checklist prompts referencing acceptance criteria.
  - `agent_instruction.json`: emits onboarding prompts for agents tied to a task/deliverable.
  - `task_creation.json`: emits planning prompts that run a feasibility review, restate contract constraints, and produce a full task module plan before implementation. (Seeded automatically during project initialization.)

## 3. Feasibility-First Workflow
1. **Master Prompt context** – `ai/templates/prompt_template.json` instructs every agent to read the contract/architecture docs, perform a feasibility review, and wait for human confirmation before touching files.
2. **Blueprint execution** – When the review recommends Go, the agent uses the `task_creation` blueprint to emit a canonical plan (task.json outline, checklist, file list, validation/logging requirements).
3. **Task creation** – Operators store the generated plan inside a new task module (`ai/tasks/TASK_xxx/`) with Machine Summary + schema validation.
4. **Implementation** – Subsequent prompts (e.g., `structured_checklist`) run inside that task, executing one checklist line at a time while logging progress.

This flow keeps feature work deterministic instead of ad-hoc edits.

## 4. CLI Usage
```bash
npm run init:workflow   # Ensures master prompt + task_creation blueprint exist on fresh clones
npm run generate:prompt -- --blueprint structured_checklist ^
  --set task_id=TASK_010_ui ^
  --set task_title="Local Editor UI" ^
  --set acceptance_criteria="Checklist ready;UI renders" ^
  --out ai/templates/generated/TASK_010_ui_prompt.json
```
- Flags:
  - `--blueprint/-b`: blueprint ID (required).
  - `--out/-o`: output path (defaults to `ai/templates/prompt_template.json`).
  - `--set key=value`: inline variables (repeatable). `--vars path/to.json` is also supported for bulk JSON.
  - `--task/-t`: optional override for the task whose `progress.ndjson` receives the log entry (defaults to `ai/tasks/current_index.json`).
  - `--dry-run`: skip writing to disk and print the generated prompt.
- The CLI reuses the shared generator module so backend/UI flows stay in sync.

## 5. Backend & UI Integration
- `src/server/routes/prompts.ts` exposes:
  - `GET /api/prompts/blueprints` to list available blueprints and placeholder metadata.
  - `POST /api/prompts/generate` to render a blueprint (`persist` defaults to `false`; pass `true` + `targetFile` to store on disk).
- `src/server/routes/features.ts` adds `POST /api/features/plan`, which wraps the `task_creation` blueprint with logging disabled so feasibility reports can be produced before a task module exists.
- The UI now includes two key panels:
  - **Feature Planner** pulls the master prompt text, captures feature-request metadata, and calls `/api/features/plan` to display the feasibility review + task-module plan (including the next auto-assigned `TASK_###`) for human approval.
  - **Prompt Editor** retains its blueprint picker that fetches metadata, pre-fills placeholder JSON, and calls `/api/prompts/generate` (without persisting) before `/api/contracts/prompts` saves the final template.

## 6. Validation & Testing
- Run `npm run test` to execute:
  - `scripts/__tests__/generate_structured_prompt.test.ts` (blueprint rendering, prompt persistence, logging).
  - Updated server integration tests covering `/api/prompts/*` and `/api/features/plan`.
- Run `npm run schema:lint` to validate the blueprint schema and all blueprint JSON files.
- Manual sanity check: `npm run generate:prompt -- --blueprint agent_instruction --dry-run --set task_id=TASK_DEMO --set deliverable="..." --set files="ai/AI_TASK_MONITOR_CONTRACT.md"` and confirm the output contains substituted fields and (when logging is enabled) the log entry lands in the active task’s `progress.ndjson`.

## 7. Prompt Editor Flow (Generate vs Save)
- **Generate from Blueprint:** Invokes `/api/prompts/generate` with `persist=false`, producing a JSON prompt that matches `schemas/prompt_template.json`. The `body` field inside that JSON is natural-language text, but the overall output stays structured so the UI can edit/review it before any disk writes occur.
- **Save Prompt:** Sends the current editor state to `/api/contracts/prompts`, which validates and writes `ai/templates/prompt_template.json`. This is the only step that mutates files.
- Use Generate to experiment with placeholder combinations (or to answer "what does this blueprint look like?"). Once satisfied, adjust any fields manually and hit Save to publish the template for subsequent agents.
