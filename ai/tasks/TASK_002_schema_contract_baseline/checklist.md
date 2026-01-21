<!-- Machine Summary Block -->
{"file":"ai/tasks/TASK_002_schema_contract_baseline/checklist.md","purpose":"Guides execution of TASK_002 to finalize the AI contract and deliver baseline schemas plus validation tooling."}

# Task Checklist: TASK_002_schema_contract_baseline

## Pre-execution
- [x] Read task.json, acceptance criteria, docs/requirements_architecture.md, docs/schema_strategy.md, and ai/TO-DO.md item 2
- [x] Review current ai/MILESTONE_CONTRACT.md content and confirm sections needing updates
- [x] Inventory template files (ai/templates/*) and existing task directories to understand schema targets

## Execution
- [x] Update ai/MILESTONE_CONTRACT.md with Machine Summary Block and finalized language
- [x] Draft JSON schema for task modules (`schemas/task.json`) covering metadata, enums, and acceptance criteria
- [x] Draft JSON schema for current index (`schemas/current_index.json`) enforcing task path consistency
- [x] Draft JSON schema for NDJSON events (`schemas/progress_event.json`) with allowed event/status enums
- [x] Draft Machine Summary schema (`schemas/machine_summary.json`) reused by Markdown, YAML, Python, etc.
- [x] Draft schema for prompt/checklist templates (`schemas/prompt_template.json`) referencing summary + body constraints
- [x] Implement validation script (`scripts/validate_schemas.mjs`) wired to `pnpm schema:lint` (or similar) to run all schema checks
- [x] Run validation script locally, fixing repo files until it passes cleanly
- [x] Append required progress.ndjson entries for schema and contract milestones

## Validation
- [x] Capture script output demonstrating success and note command in task log
- [x] Confirm all edited/created Markdown files start with Machine Summary Blocks
- [x] Verify acceptance criteria satisfied (contract finalized, schemas created, validation tooling documented)

## Completion
- [x] Mark checklist items `[x]` when validated
- [x] Add `task_completed` entry to progress.ndjson once all acceptance criteria met
- [x] Update ai/tasks/current_index.json to reflect completed task
