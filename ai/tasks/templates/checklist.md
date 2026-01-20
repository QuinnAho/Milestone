<!-- Machine Summary Block -->
{"file":"ai/tasks/templates/checklist.md","purpose":"Template checklist structure copied into each task module."}

# Task Checklist: {{TASK_ID}}

  ## Pre-execution
  - [ ] Read task.json and acceptance criteria
  - [ ] Inspect relevant source files/context
  - [ ] Confirm required directories exist or create plan to add them

  ## Execution
  - [ ] Step 1 (quantifiable)
  - [ ] Step 2 (quantifiable)
  - [ ] Step N ...

  ## Validation
  - [ ] Code builds/tests pass
  - [ ] Schema validations succeed
  - [ ] Acceptance criteria verified

  ## Completion
  - [ ] All checklist items marked `[x]`
  - [ ] progress.ndjson updated with `task_completed`
  - [ ] No validation rules violated
  - [ ] Machine Summary Blocks present on all new files

  Replace placeholders ({{TASK_ID}}, Step names, etc.) when instantiating.
