<!-- Machine Summary Block -->
{"file":"docs/milestone_workflow.md","purpose":"Defines the deterministic milestone lifecycle, QA gate, and storage artifacts for AI Task Monitor."}

# Milestone Workflow

Milestones bundle one or more task modules under `ai/milestones/` so the AI can enforce QA gates across meaningful groupings. Each milestone owns:

- `milestone.json` that conforms to `schemas/milestone.json` and captures metadata, task membership, and QA review pointers.
- `qa_checklist.md` mirroring the task checklist style, scoped to the milestone-level validation pass.
- `qa_progress.ndjson` for logging every QA review event with diff snapshots.

`ai/milestones/milestone_index.json` lists every milestone plus any unassigned tasks so the Task Board (and future Milestone Board) can render containers in deterministic order.

## Data Model

Key fields defined in `schemas/milestone.json`:

- `milestone_id`: `MILESTONE_###` identifier that also names the folder.
- `tasks`: ordered array of `task_id` entries with `blocking` + `qa_required` flags so we know which tasks gate completion.
- `qa_review`: contains `checklist_path`, `log_path`, and `status` so UI/backends can demand a QA pass after all blocking tasks complete.
- `qa_scope` + `acceptance_criteria`: capture contract/risk areas the reviewer must cover.
- `links/docs`: references to contract sections or workflow docs for context.

Example layout (`ai/milestones/MILESTONE_001`):

```
ai/milestones/
  milestone_index.json
  MILESTONE_001/
    milestone.json
    qa_checklist.md
    qa_progress.ndjson
```

## QA Gate Lifecycle

1. **Tasks Complete:** When every `blocking` task reports checklist completion, the backend flips the milestone status to `qa_pending` and surfaces a banner in the UI.
2. **Run Checklist:** Reviewer opens `qa_checklist.md`, executes each item (tests, schema lint, doc verification), and records notes/results in the checklist + `qa_progress.ndjson`.
3. **Log Evidence:** Use `POST /api/milestones/:id/logs` (to be implemented) or append entries through FileAccess helpers so every QA action includes timestamps, agent name, and diffs.
4. **Close Milestone:** After QA checklist is `[x]` and validations pass, mark `qa_review.status` as `completed`, set `completed_at`, and move milestone `status` to `completed`.

Remote monitors only consume the snapshot, so the QA log ensures reviewers can prove compliance without local access.

## Integration Points

- **Server**: `milestoneStore.ts` will mirror `taskStore` (list/create/update, append QA logs, wire into existing `/api/tasks` reorder logic so milestone order tracks `ai/tasks/order.json`).
- **Routes**: `src/server/routes/milestones.ts` will expose CRUD + QA review endpoints; `tasks.ts` will emit milestone metadata alongside tasks for sidebar rendering.
- **UI**: `MilestoneBoard` + enriched `TaskBoard` will read `useMilestones` to render expand/collapse containers, show QA pending badges, and let operators open the milestone QA checklist from the sidebar.
- **Automation**: `scripts/reorder_tasks.ts` + the future `scripts/run-all-tests.ts` can use the index to scope test suites per milestone before promotion.

## Operational Notes

- Always run `npm run schema:lint` after editing milestone JSON files to catch contract drift.
- QA reviewers must append NDJSON entries containing `milestone_id` and `diff.summary` so GitHub snapshots expose evidence to remote monitors.
- When relocating tasks across milestones, update both `milestone_index.json` and the affected `milestone.json` files in the same commit, then log the change in each task's `progress.ndjson`.