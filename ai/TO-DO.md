<!-- Machine Summary Block -->
{"file":"ai/TO-DO.md","purpose":"Outlines the prioritized roadmap for AI Task Monitor development."}

 Requirements & Architecture
      - Actions: Define user roles (local editor, remote observer), enumerate data sources (ai/ files, GitHub
        artifacts), map dual-deployment workflow, choose tech stack (Next.js or similar + API).
      - Acceptance: Written architecture doc referencing both deployments, approved schema strategy, risks logged.
  2. Schema & Contract Baseline
      - Actions: Finalize AI_TASK_MONITOR_CONTRACT.md, create JSON schemas for task.json, current_index.json,
        progress.ndjson, Machine Summary blocks, and prompt templates.
      - Acceptance: Schemas validate existing repo files via automated script; contract stored with Machine Summary
        block.
  3. File Access Layer
      - Actions: Implement Node/FastAPI module that reads/writes task directories atomically, enforces read-only vs
        write mode toggles, logs operations.
      - Acceptance: Unit tests simulate edits and ensure atomic writes; read-only mode rejects mutations with explicit
        errors.
  4. Local Editor Backend
      - Actions: Build REST endpoints for listing tasks, fetching checklists/logs, creating tasks from templates,
        updating checklists, generating contracts/prompts.
      - Acceptance: Each endpoint covered by integration tests hitting filesystem sandbox; schema validation errors
        return 4xx with detail.
  5. Local Editor UI
      - Actions: React UI with task board, detail panes (task JSON, checklist, log timeline), contract/prompt editors
        with JSON linting, task creation wizard.
      - Acceptance: Manual test script verifies creating a task updates files, checklist toggles log entries, JSON
        editor prevents invalid saves.
  6. Structured Prompt Generators
      - Actions: Implement helper workflows that produce Claude/Codex-ready JSON (e.g., new checklist template, agent
        instructions) using stored prompt patterns.
      - Acceptance: Generated files include Machine Summary blocks, pass schema validation, and are logged in
        progress.ndjson.
  7. Remote Monitor Build
      - Actions: Strip write capabilities, create read-only API (or static data loader) that consumes GitHub-produced
        snapshots/artifacts, add timestamp indicators.
      - Acceptance: Deployment flag toggles build into read-only mode; simulated artifact fetch renders dashboard
        without filesystem writes.
  8. GitHub Actions Pipeline
      - Actions: Workflow that runs on push, validates schemas/tests, packages ai/ snapshot (or publishes to branch/
        storage), notifies remote monitor.
      - Acceptance: CI job succeeds on clean repo, uploads artifact containing contract/tasks/logs, exposes checksum or
        version tag.
  9. Remote Deployment
      - Actions: Deploy monitor UI/API to hosting (Vercel, static site + serverless), configure authentication if
        needed, connect to artifact source.
      - Acceptance: Hosted URL displays latest snapshot after CI run; manual test confirms refresh after new push.
  10. Documentation & Ops

  - Actions: Write docs covering architecture, local vs remote workflows, task creation guide, onboarding for AI agents,
    troubleshooting.
  - Acceptance: Docs include Machine Summary blocks, link to schemas, describe CI pipeline, and are reviewed.

  11. Validation & Sign-off

  - Actions: Run end-to-end scenario (create task locally, push, see updated remote dashboard), verify logs, ensure dual
    deployment stays in sync.
  - Acceptance: Checklist marks all steps [x], acceptance criteria met, final log entry task_completed recorded.

  This sequencing keeps each step measurable and tied to validation so you can track progress via the same contract
  system you’re building.
