<!-- Machine Summary Block -->
{"file":"ai/tasks/TASK_008_milestone_container/checklist.md","purpose":"Checklist for implementing milestone containers and QA gating."}

# Task Checklist: TASK_008_milestone_container

## Pre-execution
- [x] Review ai/MILESTONE_CONTRACT.md to align milestone QA requirements with existing completion rules
- [x] Inventory current task list flows (server + UI) to understand where milestones integrate
- [x] Define milestone data model (fields, storage path, schema dependencies)

## Execution
- [x] Draft docs/milestone_workflow.md describing milestone lifecycle, QA gate, and user expectations
- [x] Create schemas/milestone.json (plus any index schema) and seed sample milestone files under ai/milestones/
- [x] Implement backend storage/helpers (milestoneStore) and routes for listing/creating/updating milestones + QA status
- [x] Wire task completion events to milestone progress (auto-check status when tasks finish)
- [x] Extend UI (TaskBoard sidebar + new Milestone component) to render milestones, allow expansion, show QA pending/completed states, and surface a collapsible "Completed" section where finished tasks drop automatically (with drag-to-reorder support that lets users pull items back into scope if needed)
- [x] Remove duplicate task modules in the sidebar so every card only appears inside its milestone context (no standalone copy)
- [ ] Replace the milestone strip's updated timestamp with an inline "Add Milestone" control that surfaces contract-aligned naming/creation UX
- [ ] Implement the Add Milestone flow in the UI so operators can create and name milestones from the sidebar (POST /api/milestones) without touching disk manually
- [ ] Expand drag-and-drop so tasks can move between milestones and back to the unassigned backlog, persisting membership updates to milestoneStore
- [ ] Update contract/docs/templates to mention milestone QA requirements
- [ ] Add integration/unit tests for milestone APIs, schema validation, and UI data hooks

## Validation
- [ ] `npm run test` passes with new milestone coverage
- [ ] `npm run schema:lint` validates milestone JSON files
- [ ] Manual UI sanity: milestone list expands, tasks show correct states, QA gate triggered
- [ ] Documentation reviewed for accuracy

## Completion
- [ ] All checklist boxes checked
- [ ] progress.ndjson appended with `task_completed` referencing milestone QA
- [ ] Active milestone sample demonstrates QA workflow end-to-end
