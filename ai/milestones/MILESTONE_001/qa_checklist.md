<!-- Machine Summary Block -->
{"file":"ai/milestones/MILESTONE_001/qa_checklist.md","purpose":"QA checklist ensuring Core Monitoring Alpha milestone meets contract validation gates."}

# QA Checklist: Core Monitoring Alpha

- [ ] Confirm TASK_007_ndjson_diff_logging checklist is complete and logs include NDJSON diff summaries.
- [ ] Confirm TASK_008_milestone_container checklist is complete and milestone schemas validate via `npm run schema:lint`.
- [ ] Confirm TASK_009_task_board_reorder checklist is complete and drag reorder persists across refresh.
- [ ] Run `npm run test` and capture results in qa_progress.ndjson.
- [ ] Review docs/milestone_workflow.md accuracy + mention in README/contract if needed.
- [ ] Append QA completion entry with diff snapshot to qa_progress.ndjson.