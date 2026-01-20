<!-- Machine Summary Block -->
{"file":"docs/feature_workflow.md","purpose":"Explains the feasibility-first workflow for new feature requests, including the Feature Planner UI, CLI usage, and schema/logging requirements."}

# Feature Workflow (Feasibility First)

## 1. When a user requests a feature
1. Read the master prompt (`ai/templates/prompt_template.json`) and the contract/architecture docs it references (contract, schema strategy, file access, backend, UI, roadmap).
2. Perform a feasibility review: map the request to existing subsystems, note risks or conflicts, list affected files, and identify missing information.
3. Respond to the user with the feasibility summary and a Go/No-Go recommendation. Do not touch repo files until the user confirms.

## 2. Generate the canonical plan
- **UI path:** Open the Feature Planner panel (right column) and provide:
  - Title/summary.
  - Inputs/expected files/acceptance criteria/references.
  - Click “Generate Feature Plan” to call `POST /api/features/plan`, which invokes the `task_creation` blueprint (logging disabled). The response includes the feasibility review plus the next auto-assigned `TASK_###` identifier; review it with the user before creating files.
- **CLI path (optional):**
  ```bash
  npm run init:workflow   # one-time to ensure task_creation blueprint + master prompt exist
  npm run generate:prompt -- --blueprint task_creation ^
    --set task_id=TASK_999_new_feature ^  # determine the next number beforehand
    --set task_title="Describe feature" ^
    --set task_summary="Short summary" ^
    --set inputs="ai/AI_TASK_MONITOR_CONTRACT.md;docs/..." ^
    --set expected_files="docs/foo.md;src/bar.ts" ^
    --set acceptance_criteria="..." ^
    --set references="ai/AI_TASK_MONITOR_CONTRACT.md" ^
    --dry-run
  ```
  Capture the CLI output (Feasibility + Task Module Plan) and share it for confirmation.

## 3. Create the task module
1. After approval, create a new task via the UI form or `/api/tasks` endpoint. Only provide the title/description (and optional priority)-the `TASK_###` identifier is assigned automatically based on the next sequential number.
2. Populate `task.json`, `checklist.md`, and `progress.ndjson` based on the generated plan.
3. Ensure every Markdown/JSON file begins with a Machine Summary Block and passes schema validation (`npm run schema:lint`).
4. Verify `ai/tasks/order.json` reflects the intended priority order before implementation starts (see `docs/task_reordering.md`), since the AI executes tasks top-to-bottom exactly as the file dictates.

## 4. Execute the checklist
1. Use the Prompt Editor blueprint picker (often `structured_checklist`) to craft deterministic prompts for each sub-step.
2. Execute one checklist line at a time, logging to `progress.ndjson` via FileAccess-powered routes or CLI helpers.
3. Run validations/tests described in the plan before marking a step `[x]`.
4. Continue until all checklist lines, acceptance criteria, and logging requirements are satisfied.

## 5. Automation helpers
- `npm run init:workflow`: seeds/validates the master prompt and `task_creation` blueprint if they are missing (useful for fresh clones or boilerplate repos).
- `/api/features/plan`: backend endpoint for feasibility plans (used by the Feature Planner UI; can be scripted).
- `/api/prompts/generate`: general blueprint renderer (used by Prompt Editor UI + CLI).
- `/api/contracts/prompts`: persists the current prompt template after preview/generation.

## 6. Prompt Workspace (Right Column)
- The right column now exposes four deterministic actions that open the middle-column prompt canvas:
  - **Continue Development** – show/edit the rules-heavy restart prompt; copy or save local tweaks before dispatching to your agent.
  - **New Feature / Module** – edit the base template, outline the feature in the details box, then click *Generate Prompt* to merge the two; copy the output directly or iterate before saving the template.
  - **QA Pass** – similar to the feature flow but scoped to validation work; provide modules/areas in the scope box and generate a QA/UAT prompt.
  - **Prompt Template (Master)** – edit the canonical prompt JSON the other actions clone, then save it via `/api/contracts/prompts`.
- Selecting any action replaces the monitoring view with the prompt canvas. Use **Back to Monitoring** to return to the task detail panel without losing state.
- Template edits for Continue/Feature/QA are stored locally (per operator) so you can iterate without touching backend files until ready.

Following this workflow ensures every feature request flows through a repeatable feasibility assessment, captures a structured plan, and keeps local/remote monitors in sync with the contract.
