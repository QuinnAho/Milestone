import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureDiffSnapshot } from './lib/gitDiff';

test('captureDiffSnapshot returns fallback summary outside git repos', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'git-diff-test-'));
  try {
    const diff = captureDiffSnapshot({ cwd: tempDir });
    assert.ok(typeof diff.summary === 'string' && diff.summary.length > 0);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
