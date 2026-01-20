<!-- Machine Summary Block -->
{"file":"ai/tasks/TASK_009_task_board_reorder/checklist.md","purpose":"Checklist for adding Task board hint and reordering controls."}

# Task Checklist: TASK_009_task_board_reorder

## Pre-execution
- [x] Review ai/AI_TASK_MONITOR_CONTRACT.md + current_index.json rules to understand ordering expectations
- [x] Audit TaskBoard component + useTasks hook to identify current rendering/data flow
- [x] Decide on storage strategy for task ordering (folder rename vs ordering metadata)

## Execution
- [x] Draft docs/task_reordering.md covering workflow, contract rationale, and how to use the UI
- [x] Add hint/tool tip text next to the task column title explaining top-to-bottom execution
- [x] Implement UI controls (drag/drop or move buttons) to reorder tasks locally with optimistic updates
- [x] Extend backend (taskStore/routes) to persist order changes and keep current_index valid
- [x] Update scripts/APIs (e.g., reorder_tasks.ts) to support automation/CLI reordering
- [x] Ensure reordering logs events or notes as required
- [x] Write tests (server + UI) to cover ordering + hint rendering

## Validation
- [x] `npm run test` passes with new coverage
- [x] Manual UI check: hint visible, tasks reorder correctly, refresh shows new order
- [x] Schema lint passes if new ordering metadata introduced
- [x] Confirm active task remains accurate after reorder operations

## Completion
- [x] All checklist items marked `[x]`
- [x] progress.ndjson updated with reorder milestone + completion event
- [x] Docs reviewed/linked from README as needed
