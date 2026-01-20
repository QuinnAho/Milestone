<!-- Machine Summary Block -->
{"file":"docs/file_access_layer.md","purpose":"Explains the Node/TypeScript file access module, modes, and logging strategy for task artifacts."}

# File Access Layer

## 1. Overview
- **Goal:** Provide a deterministic interface for reading/writing AI task artifacts with atomic guarantees and read-only enforcement.
- **Module:** `src/fs/fileAccess.ts` exposes the `FileAccess` class backed by the shared types in `src/fs/types.ts`.
- **Outputs:** Structured logging (console + `logs/file_access.log`), schema validation hook, unit tests using `node:test`.

## 2. Core Concepts
| Feature | Description |
| --- | --- |
| Root directory | All operations resolve relative paths against a configured root. Attempts to escape root throw `OUT_OF_BOUNDS`. |
| Modes | `read_write` (default) permits mutation; `read_only` rejects all write/append calls with `READ_ONLY` errors. |
| Atomic writes | `writeText`/`writeJson` create a temp file then rename, ensuring partial writes never corrupt repo artifacts. |
| Schema hook | Write methods accept `schema` option; if `schemaValidator` provided, data must pass validation before commit. |
| Logging | Every operation logs via console and optional JSON log file (see `logs/file_access.log`). |

## 3. Public API (TypeScript)
```ts
const access = new FileAccess({
  rootDir: process.cwd(),
  mode: 'read_write',
  schemaValidator: ({ schema, data }) => validateWithAjv(schema, data),
  logToFilePath: path.join('logs', 'file_access.log')
});

await access.writeJson('ai/tasks/TASK_003/task.json', payload, { schema: 'schemas/task.json' });
const files = await access.list('ai/tasks');
access.setMode('read_only'); // flips to monitor mode
```

### Methods
- `readText(relativePath, options)` / `readJson(relativePath)` – Safe reads with encoding control.
- `writeText(relativePath, contents, options)` / `writeJson(relativePath, data, options)` – Atomic writes with schema support.
- `appendText(...)` / `appendNdjson(...)` – Append helpers for logs.
- `list(relativeDir)` – Recursively lists files under a folder (relative paths preserved).
- `setMode(mode)` / `getMode()` – Toggle between read-only and read/write.

## 4. Logging
- Console logging uses the `[file-access]` prefix with info/warn/error methods.
- When `logToFilePath` is supplied, each entry is written as JSON with timestamp, level, and details. See `logs/file_access.log` for format.
- Read-only violations log at `warn` level before throwing `FileAccessError`.

## 5. Testing Strategy
- `src/fs/fileAccess.test.ts` uses the built-in `node:test` runner plus `assert/strict`.
- Run via `npm test` (or `pnpm test`) which maps to `tsx --tsconfig tsconfig.json src/fs/fileAccess.test.ts`.
- Requires dev dependencies installed (`npm install`) to bring in `typescript`, `tsx`, and `@types/node`.
- Coverage:
  - Successful `writeJson`/`readJson` round trip including validator calls.
  - Read-only write rejection raising `FileAccessError` with `READ_ONLY` code.
  - `appendNdjson` newline behavior.
  - Recursive listing of nested directories.
- Tests rely on temporary directories via `mkdtempSync` and clean up after execution.

## 6. Integration Notes
- API is framework agnostic; future REST endpoints can inject this module for filesystem interactions.
- Remote monitor should instantiate with `mode: 'read_only'` to prevent accidental mutations.
- Local editor workflows can share schema validator logic with `scripts/validate_schemas.mjs` by exposing a wrapper that loads JSON schemas and reuses the lightweight validator.
- `scripts/generate_task_from_template.ts` demonstrates using FileAccess to scaffold new task directories (run via `npm run generate:task -- TASK_ID`).

## 7. Next Steps
1. Wire `FileAccess` into the upcoming Local Editor Backend REST endpoints.
2. Expose CLI utilities (e.g., `pnpm fs:write`) for manual testing.
3. Extend logging to include request identifiers once HTTP layer exists.
