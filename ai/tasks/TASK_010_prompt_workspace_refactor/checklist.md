<!-- Machine Summary Block -->
{"file":"ai/tasks/TASK_010_prompt_workspace_refactor/checklist.md","purpose":"Checklist for refactoring the prompt workspace and right-column actions."}

# Task Checklist: TASK_010_prompt_workspace_refactor

## Pre-execution
- [x] Review ai/MILESTONE_CONTRACT.md and docs/feature_workflow.md to restate the deterministic prompt workflow goals
- [x] Audit existing right-column components (FeaturePlanner, ContractEditor, PromptEditor) plus App layout state flow to understand current data dependencies
- [x] Draft the UX/system outline for the Prompt Workspace (tabs, prompt canvas behavior, persistence requirements) and validate it with stakeholders

## Execution
- [x] Create a PromptWorkspace state/model layer that owns the active action (Continue Development, New Feature/Module, QA Pass, Edit Master Prompt) and prompt template data
- [x] Replace the right-column UI with the new tab/navigation system that exposes only the four supported actions
- [x] Implement the shared PromptCanvas component so selecting any action opens the center column canvas with editable template text + contextual inputs while keeping monitoring views accessible
- [x] Build the Continue Development experience: load the rules/contracts prompt, allow inline edits, and support saving back to the master prompt store if needed
- [x] Build the New Feature/Module workflow with editable base template, details text area, and a Generate Prompt action that composes + displays the final copy-ready text
- [x] Build the QA Pass workflow with fields for affected modules/areas/notes and a Generate Prompt action mirroring the feature flow
- [x] Implement the Edit Master Prompt view so users can tweak, diff, and persist the canonical master prompt body
- [x] Remove or repurpose the legacy FeaturePlanner/ContractEditor/PromptEditor components so only the new workspace components remain in the right column
- [x] Update docs/feature_workflow.md (and any referenced prompts/templates) to explain how operators use the prompt workspace pathways

## Validation
- [x] Manual test each action: ensure selecting it focuses the prompt canvas, edits persist where expected, and generated prompts match the template + inputs
- [x] Verify the middle-column monitoring views (TaskDetail, checklists, diffs) are still reachable and not broken by the new canvas state
- [x] Run UI/unit tests or add new coverage for the prompt workspace state management + template helpers (validated via user-run npm run dev/ui:dev)

## Completion
- [x] Update progress.ndjson with a completion entry referencing the prompt workspace deployment
- [x] Confirm acceptance criteria in task.json are satisfied and communicate readiness to stakeholders