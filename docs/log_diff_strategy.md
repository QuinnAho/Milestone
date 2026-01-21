<!-- Machine Summary Block -->
{"file":"docs/log_diff_strategy.md","purpose":"Defines how Milestone captures and stores diff previews inside progress.ndjson entries for accountability."}

# Progress Log Diff Strategy

## 1. Goal
Every `progress.ndjson` entry should include a concise view of what changed during that step so remote reviewers can reconstruct the work without cloning the repo. The diff payload must be:

- **Deterministic:** derived from the current working tree or the latest commit.
- **Bounded:** avoid dumping entire patches for large changes (cap size, show summaries).
- **Schema-backed:** stored in a structured `diff` object so UIs and CLI tools can render it safely.

## 2. Data Model (`diff` payload)
Extend `schemas/progress_event.json` with an optional `diff` object:

| Field     | Description                                                                                   |
|-----------|-----------------------------------------------------------------------------------------------|
| `summary` | Required short string (e.g., `git diff --stat` output).                                       |
| `files`   | Optional array of filenames touched during the step (max ~20 entries).                        |
| `patch`   | Optional truncated patch (e.g., unified diff limited to 2000 chars, trimmed with ellipsis).   |
| `commit`  | Optional commit hash when the working tree is clean and the diff references a recorded commit.|

If a diff cannot be produced (e.g., non-git FS), set `summary` to a deterministic explanation (e.g., `diff unavailable: reason`) and omit other fields.

## 3. Capture Workflow
1. **Gather working-tree status**
   - Run `git status --porcelain` to detect dirty files.
   - If dirty: list filenames (limited) and use them for `files`.
2. **Compute summary & patch**
   - Use `git diff --stat HEAD` for `summary`.
   - Generate a focused patch via `git diff --unified=3 --` for the affected files, truncate to a safe size, and store in `patch`.
3. **Commit reference (optional)**
   - If the working tree is clean, prefer referencing the most recent commit (`git show --stat HEAD -1`) and set `commit` instead of a raw patch.
4. **Failure handling**
   - If git is unavailable or the diff command fails, record `summary: "diff unavailable: <reason>"` and omit the rest; do not block log recording.
5. **CLI preview**
   - Run `npm run log:diff` (wraps `scripts/log_diff_preview.ts`) to preview the snapshot that will be added to the next log entry.

## 4. System Touchpoints
- **Backend (`POST /api/tasks/:id/logs`):** Accept and validate `diff` per the schema. When web clients submit logs without a diff, the backend may enrich the entry by running the capture script (future enhancement).
- **CLI helpers / automation:** Before calling the API, run the capture workflow client-side so local changes are reflected immediately.
- **UI (LogTimeline):** Display `summary` inline with an expand/collapse control to show `patch`. If `commit` exists, link to `git show` instructions.

## 5. Contract & Templates
- Update `ai/MILESTONE_CONTRACT.md` to require diff payloads for every progress entry.
- Mention the diff requirement in task templates and blueprints so future agents follow the same guardrails.

## 6. Testing & Validation
- Schema lint enforces the new `diff` structure.
- Integration tests cover logging with/without diffs.
- Manual verification: append a log entry via CLI, confirm `summary/files/patch` appear in the NDJSON file, and ensure the UI renders it read-only.
