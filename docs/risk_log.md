<!-- Machine Summary Block -->
{"file":"docs/risk_log.md","purpose":"Tracks risks and mitigations for requirements and architecture decisions of the Milestone."}

# Risk Log

| ID | Risk | Impact | Likelihood | Owner | Mitigation |
| --- | --- | --- | --- | --- | --- |
| R1 | Schema drift between local artifacts and remote snapshots | High | Medium | Schema Maintainer | Enforce schema validation in CI and block merges on failure; version schemas with `$schema` field. |
| R2 | Machine Summary Blocks omitted in new Markdown | Medium | Medium | Tooling Owner | Pre-commit hook + template generator that inserts summary; add automated linter check. |
| R3 | Atomic write failures leading to partial task artifacts | High | Low | Filesystem Module Owner | Implement write temp + rename strategy; add integration tests simulating failures. |
| R4 | Remote monitor serving stale snapshots | Medium | Medium | CI Owner | Include timestamp/version in artifact name; remote UI polls for latest and displays staleness indicator. |
| R5 | Unauthorized edits in remote environment | High | Low | DevOps Lead | Deploy remote monitor in read-only environment, remove write APIs, and restrict hosting credentials. |
| R6 | Tech stack decision (Next.js + Node) may bottleneck specialized workflows | Medium | Low | Architecture Owner | Revisit stack after MVP; evaluate modular adapters for other languages if needs arise. |
| R7 | GitHub Actions limitations for large artifacts | Medium | Low | CI Owner | Evaluate artifact size early; consider alternative storage (S3/Azure) if snapshot exceeds limits. |
