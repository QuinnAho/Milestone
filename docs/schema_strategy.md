<!-- Machine Summary Block -->
{"file":"docs/schema_strategy.md","purpose":"Outlines JSON schema coverage, validation checkpoints, and ownership for AI Task Monitor artifacts."}

# Schema Strategy

## 1. Objectives
- Guarantee deterministic parsing of all AI task artifacts.
- Prevent drift between local editor and remote monitor by validating before publishing snapshots.
- Provide a single registry of schemas shared by local tooling, CI, and remote rendering layers.

## 2. Target Artifacts & Schema Plans
| Artifact | Format | Schema File | Notes |
| --- | --- | --- | --- |
| `ai/tasks/*/task.json` | JSON | `schemas/task.json` | Validates metadata, status enums, acceptance criteria array. |
| `ai/tasks/*/checklist.md` | Markdown with Machine Summary | `schemas/machine_summary.json` + custom checklist linter | Ensure `[ ]/[x]` bullet consistency. |
| `ai/tasks/*/progress.ndjson` | NDJSON | `schemas/progress_event.json` applied per line | Append-only script validates each event. |
| `ai/tasks/current_index.json` | JSON | `schemas/current_index.json` | Ensures active task references existing directory. |
| Machine Summary Blocks | JSON snippet | `schemas/machine_summary.json` | Reused across Markdown, YAML, Python, etc. |
| Prompt templates (`ai/templates/*`) | Markdown/JSON | Format-specific schema referencing summary block | Blocks unauthorized fields. |

## 3. Validation Workflow
1. **Local Development**
   - Run `node scripts/validate_schemas.mjs` (aliased later via `pnpm schema:lint`) to validate JSON/NDJSON artifacts and Machine Summary Blocks in Markdown.
   - Script failure blocks commits; contributors fix offending files before pushing.
2. **CI Pipeline**
   - Re-run the validation script plus unit/integration tests.
   - Upload validation report alongside snapshot for remote audit.
3. **Remote Monitor**
   - Treats snapshot files as trusted (already validated) but still performs read-time schema checks to guard against artifact corruption.

## 4. Ownership
- **Schema Maintainer:** Local editor lead (initially this repo team) reviews schema changes via PR.
- **Tooling Owner:** Adds CLI wrappers and ensures `package.json` scripts point to validation commands.
- **CI Owner:** Keeps GitHub Actions job definitions updated with schema validation steps.

## 5. Versioning & Compatibility
- Store schemas under `schemas/` with semantic version (e.g., `schemas/v1/task.json`).
- Reference schema versions inside files via `$schema` property to allow gradual migrations.
- Maintain changelog entries describing breaking vs additive changes.

## 6. Automation Hooks
- Pre-commit hook ensures Machine Summary Block exists in new Markdown/CMake/Python/YAML files.
- Task creation script auto-populates `$schema` references based on template metadata.
- NDJSON logger tool appends events only after validating payload.
- Schema validation script (`scripts/validate_schemas.mjs`) runs in CI and local dev to keep JSON and Markdown files compliant.

## 7. Open Questions / Follow-ups
1. Decide whether to embed schema validation in remote UI (likely yes for defense-in-depth).
2. Determine storage for schema docs (monorepo vs separate package) before scaling.
3. Evaluate using JSON Schema Draft 2020-12 features for advanced constraints (e.g., regex on checklist steps).

## 8. References
- `ai/AI_TASK_MONITOR_CONTRACT.md` (Sections 3 Source of Truth, 4 Machine Summary Blocks, 10 Validation Requirements).
- `ai/TO-DO.md` item 2 Schema & Contract Baseline.
