<!-- Machine Summary Block -->
{"file":"docs/local_editor_ui.md","purpose":"Documents the Local Editor UI architecture, components, and manual test plan."}

# Local Editor UI

## 1. Overview
- **Goal:** Provide a React/Vite UI that consumes the local backend to manage tasks, checklists, logs, contracts, and prompts.
- **Tech stack:** Vite + React 19 + TypeScript, TanStack Query for data fetching, Jotai for shared task selection, Axios for HTTP.
- **Location:** src/ui/ (Vite project) with components in src/ui/src/components/ and hooks in src/ui/src/hooks/.

## 2. Architecture
- TaskBoard shows the backlog with search/filter, inline creation (title/description only; task IDs auto-assign), the execution hint (“AI works top-to-bottom...”), and drag-to-reorder interactions that call `PATCH /api/tasks/order`.
- TaskDetail renders task metadata, then the progress log timeline above the checklist with an explicit visual break; the JSON viewer was removed to keep the panel human-friendly.
- FeaturePlanner (right column) loads the master prompt, captures feasibility inputs, and calls `POST /api/features/plan` to run the `task_creation` blueprint without persisting changes.
- ContractEditor + PromptEditor fetch/save via `/api/contracts/*`; PromptEditor’s Blueprint picker calls `/api/prompts/generate` to prefill the form, and the “Save Prompt” button persists to `ai/templates/prompt_template.json`.
- Hooks (`useTasks`, `useTaskDetail`, `usePromptEditor`, `useContractEditor`, `useChecklistMutations`) encapsulate TanStack Query state; layout is composed in `src/ui/src/pages/App.tsx` with shared styles under `src/ui/src/styles/`.
- Vite dev server proxies /api calls to the Express backend.

## 3. Development Scripts
```
npm run dev        # Starts the Express backend on http://localhost:3000
npm run ui:dev     # Runs the Vite dev server (proxies /api to :3000)
npm run ui:build   # Builds the UI for production
```
(Proxy config lives in src/ui/vite.config.ts.)

## 4. Manual Test Script
1. **Start services:** Run `npm run dev` (backend) and `npm run ui:dev` (UI) in separate terminals.
2. **Task board + hint:** Confirm the "Tasks" header shows the hint about top-to-bottom execution, search works, and dragging cards updates the order. Verify `ai/tasks/order.json` reflects the new order and that the active task’s `progress.ndjson` captures the reorder note.
3. **Create task:** Submit only a title/description via the form, confirm the new task auto-selects with the next sequential ID, and clear the form.
4. **Task detail panel:** Ensure the Progress Log renders above the checklist with the added spacing divider. Toggle a checklist item and confirm both the task list and detail views refresh.
5. **Feature Planner:** Enter sample inputs, click “Generate Feature Plan,” and confirm the feasibility output plus the proposed task ID render without writing files.
6. **Prompt Editor:** Use the Blueprint picker to generate content (no persistence) and then click “Save Prompt” to store the template, verifying `ai/templates/prompt_template.json`.
7. **Contract Editor:** Edit the contract with a valid Machine Summary block, save, and confirm `ai/MILESTONE_CONTRACT.md` updates. Reload the UI to ensure the latest state loads.

Document any discrepancies in ai/tasks/TASK_005_local_editor_ui/progress.ndjson before marking the task complete.

## 5. Manual Verification (2026-01-12)
- `npm --prefix src/ui run build` succeeds, confirming the Vite bundle plus TypeScript project compile without errors.
- Backend flows exercised in a CLI-only environment via `npx tsx` script that used the production FileAccess module to create a temporary task (`TASK_500_ui_demo`), toggle its checklist, and append a progress entry—mirroring the UI checklist interactions.
- The same script issued write/read cycles against `ai/MILESTONE_CONTRACT.md` and `ai/templates/prompt_template.json`, validating that the editors can persist content through backend routes without schema errors.
- Temporary artifacts created during the verification run were removed after confirming backend file updates, leaving the repository clean.
