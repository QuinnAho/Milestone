<!-- Machine Summary Block -->
{"file":"docs/task_reordering.md","purpose":"Explains how to manage task ordering metadata so the AI executes work top-to-bottom and how the UI, API, and CLI interact with ai/tasks/order.json."}

# Task Reordering Protocol

The AI Task Monitor executes work strictly from the top of the task column to the bottom. Priority labels are informative, but **`ai/tasks/order.json`** is the single source of truth for execution order. This file is synced automatically whenever the UI or CLI reorders tasks, and it is versioned in git so reviewers can audit priority changes.

## 1. Data Sources
- `ai/tasks/order.json`: ordered array of task IDs (e.g., `["TASK_009...", "TASK_008...", ...]`). The backend reuses this list for `/api/tasks`, and syncing the file ensures remote monitors see the same order.
- `ai/tasks/current_index.json`: still records the active task module; reordering never mutates this file, so history stays stable.
- `ai/tasks/*/progress.ndjson`: whenever a reorder materially affects execution, append a log entry so the change is auditable.

## 2. UI Workflow (Task Board)
1. The left column now includes a hint: "AI works top-to-bottom. Drag tasks so high-priority work stays at the top."
2. Click and drag any task card to reorder it; dropping commits a new ordering array via `PATCH /api/tasks/order` so the backend and `ai/tasks/order.json` stay in sync.
3. Once the server responds, the React Query cache refreshes and the UI reflects the canonical order (the preview you see while dragging matches what will be persisted).

### Visual Guidelines
- Keep the hint visible near the "Tasks" heading.
- Badge colors communicate the stored `priority`, but order always wins.
- Milestones (when shipped) should wrap these same semantics so expanding a milestone preserves top-to-bottom execution for its child tasks.

## 3. CLI Support
Use `npm run reorder -- TASK_009_task_board_reorder TASK_008_milestone_container ...` (alias for `tsx scripts/reorder_tasks.ts ...`) when you need deterministic reordering outside the UI. The script validates duplicates/missing IDs and writes `ai/tasks/order.json` using the same helper as the API.

Example:
```bash
npm run reorder -- TASK_009_task_board_reorder TASK_008_milestone_container TASK_007_ndjson_diff_logging
```

## 4. Validation & Logging
- After any reorder, confirm `git diff ai/tasks/order.json` reflects the intended priority stack.
- If the active task (per `current_index.json`) moved, log a short reason (`event: "step_completed"`, `details: "Reprioritized TASK_009 to unblock milestone work"`).
- The TaskBoard UI automatically appends a `step_completed` entry to the active task’s `progress.ndjson` noting the new order; if you bypass the UI (CLI or manual edits), add a similar note yourself.
- Run `npm run test` when the reorder accompanies code changes touching task routing logic.
- Update task modules/checklists if the reorder changes execution dependencies (e.g., milestone gating).

Keeping this file accurate ensures every AI agent interprets the backlog the same way and aligns with the ?feasibility first, top-to-bottom" workflow defined in the contract.
