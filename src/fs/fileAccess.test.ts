import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { FileAccess } from './fileAccess';
import { FileAccessError, SchemaValidationRequest } from './types';

interface TestContext {
  rootDir: string;
  validatorCalls: SchemaValidationRequest[];
}

const ctx: TestContext = {
  rootDir: '',
  validatorCalls: []
};

beforeEach(() => {
  ctx.rootDir = mkdtempSync(path.join(tmpdir(), 'Milestone-'));
  ctx.validatorCalls = [];
});

afterEach(() => {
  if (ctx.rootDir && existsSync(ctx.rootDir)) {
    rmSync(ctx.rootDir, { recursive: true, force: true });
  }
});

function createFileAccess(mode: 'read_only' | 'read_write' = 'read_write') {
  return new FileAccess({
    rootDir: ctx.rootDir,
    mode,
    schemaValidator: (request) => ctx.validatorCalls.push(request),
    logToFilePath: path.join(ctx.rootDir, 'file_access.log')
  });
}

test('writes and reads JSON atomically with validation hook', async () => {
  const access = createFileAccess();
  const relativePath = 'ai/tasks/sample/task.json';

  await access.writeJson(relativePath, { task_id: 'TASK_TEST', title: 'Sample' }, { schema: 'schemas/task.json' });
  const stored = await access.readJson(relativePath);

  assert.equal(stored.task_id, 'TASK_TEST');
  assert.equal(ctx.validatorCalls.length, 1);
  assert.equal(ctx.validatorCalls[0].schema, 'schemas/task.json');
  assert.equal(ctx.validatorCalls[0].filePath, relativePath);

  const logPath = path.join(ctx.rootDir, 'file_access.log');
  const logContents = readFileSync(logPath, 'utf8').trim();
  assert.ok(logContents.length > 0, 'log file should contain entries');
});

test('rejects write attempts when in read-only mode', async () => {
  const access = createFileAccess('read_only');
  await assert.rejects(
    () => access.writeText('docs/example.md', '# demo'),
    (error: unknown) => {
      assert.ok(error instanceof FileAccessError);
      assert.equal(error.code, 'READ_ONLY');
      return true;
    }
  );
});

test('appendNdjson adds newline separated entries', async () => {
  const access = createFileAccess();
  const file = 'ai/tasks/sample/progress.ndjson';
  await access.appendNdjson(file, { task_id: 'TASK_TEST', event: 'task_started' });
  await access.appendNdjson(file, { task_id: 'TASK_TEST', event: 'task_completed' });

  const contents = readFileSync(path.join(ctx.rootDir, file), 'utf8').trim().split('\n');
  assert.equal(contents.length, 2);
});

test('list returns nested files relative to root', async () => {
  const access = createFileAccess();
  await access.writeText('docs/a.md', 'one');
  await access.writeText('docs/nested/b.md', 'two');

  const files = await access.list('docs');
  files.sort();
  assert.deepEqual(files, ['docs/a.md', 'docs/nested/b.md']);
});
