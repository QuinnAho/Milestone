<!-- Machine Summary Block -->
{"file":"docs/requirements_architecture.md","purpose":"Defines requirements, user roles, data sources, and architecture decisions for dual deployments of the AI Task Monitor."}

# Requirements & Architecture Baseline

## 1. Overview
- **Goal:** Align local editor and remote monitor deployments under the AI Task Monitor Contract.
- **Scope:** Define user roles, enumerate data sources, describe dual-deployment workflow, and select an initial technology stack enabling deterministic file management plus read-only publishing.

## 2. Personas & Responsibilities
- **Local Editor (engineers, AI assistants with write access)**  
  - Permissions: full write to `ai/` artifacts, ability to run schema validation, produce new task files.  
  - Responsibilities: instantiate tasks from templates, maintain Machine Summary blocks, log NDJSON progress, trigger CI snapshot pipeline.
- **Remote Observer (stakeholders, reviewers, monitoring bots)**  
  - Permissions: read-only access via published snapshots (GitHub artifacts or static hosting).  
  - Responsibilities: review task state, verify compliance, flag discrepancies but never mutate artifacts.
- **CI Automation (GitHub Actions or equivalent)**  
  - Permissions: read/write workspace checkout during pipeline, publish artifacts for remote monitor.  
  - Responsibilities: run schema validation/tests, bundle `ai/` snapshot, push outputs for remote monitor consumption.

## 3. Data Sources & Ownership
| Source | Contents | Mode | Owner | Notes |
| --- | --- | --- | --- | --- |
| `ai/tasks/*/task.json` | Task metadata & acceptance criteria | Read/Write (local editor), Read (remote) | Local editor | Must stay schema-compliant. |
| `ai/tasks/*/checklist.md` | Ordered steps with `[ ]/[x]` | Read/Write (local editor), Read (remote) | Local editor | Requires Machine Summary Block. |
| `ai/tasks/*/progress.ndjson` | Append-only log | Append (local editor), Read (remote) | Local editor | No rewrites; only append. |
| `ai/tasks/current_index.json` | Active task pointer | Write (local editor), Read (remote & CI) | Local editor | Drives dashboard default view. |
| `ai/AI_TASK_MONITOR_CONTRACT.md` | Behavioral contract | Read for all, occasional write by maintainers | Contract owner | Drives governance. |
| GitHub artifact `ai-snapshot` | Exported `ai/` tree + docs | Read for remote monitor | CI | Immutable snapshot. |

## 4. Dual-Deployment Workflow
1. **Task authoring (Local Editor Mode):**
   - Agent reads `current_index.json` and relevant templates.
   - Creates/updates task directory while enforcing Machine Summary rules.
   - Runs schema validation (Node/CLI script) locally before commit.
2. **Version control & CI:**
   - Push triggers GitHub Actions workflow that installs deps, validates schemas, runs tests.
   - Workflow publishes `ai/` snapshot artifact tagged with commit SHA and timestamp.
3. **Remote Monitor Mode:**
   - Static site or serverless API fetches latest artifact.
   - UI renders tasks/checklists/logs read-only with metadata for timestamp/source.
   - Any discrepancies feed back as new local tasks.

## 5. Technology Stack Decision
- **Frontend/UI:** Next.js 15 (app router) for both local editor UI and remote monitor (read-only) due to built-in routing, React ecosystem, and SSR/SSG flexibility.
- **Backend/API:** Node.js (Express or Next.js Route Handlers) for local editor REST endpoints (task CRUD, checklist updates, log append). Remote monitor reuses Next.js but enforces read-only handlers hitting snapshot files.
- **Filesystem Layer:** Custom TypeScript module implementing atomic read/write with mode toggles (local write vs remote read). Provides schema validation wrappers using `ajv`.
- **Storage/Artifacts:** GitHub Actions caches and uploads zipped snapshots to workflow artifacts; remote monitor fetches via GitHub REST (or future storage bucket) using PAT/unauth tokens depending on deployment.
- **Rationale:** Single JavaScript/TypeScript stack reduces context switching, facilitates shared schema definitions, and simplifies CI/CD integration.
- **Alternatives Considered:** FastAPI backend (rejected for now to avoid multi-language overhead), purely static site (insufficient for local write operations).

## 6. Interfaces & Contracts
- **Task Creation API:** `POST /api/tasks` accepts template reference and metadata; enforces schema before writing to disk.
- **Checklist Update API:** `PATCH /api/tasks/:id/checklist` toggles steps and appends NDJSON entry.
- **Snapshot Loader:** `GET /api/snapshot/:sha` (remote) serves zipped snapshot manifest for UI.
- **Validation Scripts:** `pnpm validate:schemas` runs `ajv` CLI; required before merging.

## 7. Dependencies & Constraints
- Local mode must prevent partial writes (use temp files + rename).
- Remote mode cannot depend on filesystem writes; all data originates from artifacts.
- Machine Summary Block enforcement built into template generator and linter.

## 8. Next Actions
1. Finalize schema definitions to match files listed above.
2. Implement filesystem access layer abiding by read-only/write modes.
3. Build CI workflow for snapshot validation/publication.
4. Draft onboarding docs referencing this architecture.

## 9. References
- `ai/AI_TASK_MONITOR_CONTRACT.md` (Sections 3-12) for governance, machine summary rules, and deployment constraints.
- `ai/TO-DO.md` item 1 for requirement details that seeded this document.
