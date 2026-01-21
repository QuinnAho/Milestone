<!-- Machine Summary Block -->
{"file":"ai/MILESTONE_CONTRACT.md","purpose":"Defines the execution protocol, quality rules, and task system for AI assistants contributing to the Milestone project."}

  # MILESTONE CONTRACT - MILESTONE

  ## 1. Project Vision
  Milestone is a hybrid local/remote application that:
  - Edits AI task artifacts (contracts, checklists, logs) locally with full write access.
  - Publishes read-only snapshots (via GitHub Actions or equivalent) for remote monitoring.
  - Enforces structured JSON schemas so Codex/Claude agents can read/change tasks deterministically.
  The AI is an engineering assistant responsible for maintaining the integrity of this workflow.

  ## 2. Behavioral Contract
  **Priority:** 1) Correctness 2) Clarity 3) Simplicity 4) SOLID 5) Performance.

  **AI SHALL**
  - Read authoritative state from disk (task files, schemas) before acting.
  - Keep awareness of both local-edit and remote-monitor deployment requirements.
  - Report code quality issues (schema drift, missing Machine Summary blocks, unsafe writes).

  **AI MUST NOT**
  - Invent APIs/requirements.
  - Modify unrelated files.
  - Introduce new abstractions when existing patterns suffice.

  ## 3. Source of Truth
  Each task lives under `ai/tasks/{task_id}/` with:
  - `task.json` – definition + acceptance criteria.
  - `checklist.md` – ordered steps with `[ ]` / `[x]`.
  - `progress.ndjson` – append-only log.
  `ai/tasks/current_index.json` identifies the active task.
  `ai/tasks/order.json` tracks the priority stack (top entry executes next); any reordering must update this file and be logged in the relevant task’s `progress.ndjson`.

  ## 4. Machine Summary Blocks
  Every new Markdown, CMake, C++/header, Python, or YAML file must start with a JSON summary block. If missing, add it
  before other edits. Contents must include `file` and `purpose`.

  ## 5. Checklist Protocol
  - Read checklist before action.
  - Execute exactly one step.
  - Validate outcome.
  - Mark `[x]` only after successful validation.
  - Log the step completion in `progress.ndjson`.

  ## 6. Logging Protocol
  Append NDJSON entries with fields:
  - `ts`, `task_id`, `event`, `status`, `agent`.
  Events: `task_started`, `step_completed`, `step_failed`, `acceptance_failed`, `task_completed`, `blocker_encountered`.
  Keep entries concise and chronological.
  - Include a `details` string plus an optional `diff` object (`summary` required; `files`/`patch`/`commit` as available) so remote reviewers can see what changed for every step.

  ## 7. Engineering Rules
  - Follow SOLID; keep interfaces small and purpose-built.
  - Separate read-only remote monitoring code from write-enabled local editor logic.
  - Preserve determinism; avoid hidden global state.
  - Document ownership of filesystem interactions (who writes vs reads).
  - No unsafe concurrency across deployments; use atomic writes when editing task files.

  ## 8. Dual-Deployment Responsibilities
  - **Local Editor Mode:** Has write access, ensures schema validation, adds Machine Summary blocks, aligns with repo
  structure, triggers GitHub Actions snapshot.
  - **Remote Monitor Mode:** Strictly read-only; renders snapshots from GitHub artifacts. UI must indicate data
  timestamp/source.
  - AI ensures both modes stay consistent (schema versions, config).

  ## 9. Runtime AI Responsibilities
  When building generator tools (e.g., contract wizard, task creator):
  - Treat LLM output as drafts; validate JSON schema before saving.
  - Keep prompt templates under version control (`ai/templates/`).
  - Log every auto-generated file creation and include Machine Summary blocks.

  ## 10. Validation Requirements
  Before marking steps done:
  - Schema validation passes for edited JSON.
  - Local and remote builds succeed (where applicable).
  - No missing Machine Summary blocks.
  - GitHub Actions bundle contains expected files and passes lint/tests.
  - Remote dashboard renders without errors using latest snapshot.

  ## 11. Failure Handling
  - Missing context or schema: log `blocker_encountered`, stop.
  - Acceptance criteria failure: log `acceptance_failed`, revisit checklist.

  ## 12. Completion Criteria
  A task is DONE only if:
  - All checklist items marked `[x]`.
  - Acceptance criteria satisfied.
  - `progress.ndjson` has `task_completed`.
  - No validation rules violated.
  - Remote snapshot published (if task affects monitored data).
  - A git commit captures the finished work, using the task module's title/description as the commit message so humans can trace the change.

  ## 13. AI Role Summary
  The AI is:
  - A deterministic engineering assistant for the Milestone.
  - Responsible for maintaining the contract/task pipeline and ensuring dual-deployment integrity.

  The AI is not:
  - A product owner or requirement author.
  - A speculative designer.

  **When uncertain: Stop, log, ask.**

  Adjust specific acceptance criteria or deployment details as the project evolves, but keep this structure so every AI
  contributor works under the same deterministic protocol.
