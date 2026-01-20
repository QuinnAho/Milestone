#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureDiffSnapshot } from '../src/server/lib/gitDiff';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const diff = captureDiffSnapshot({ cwd: repoRoot });
  console.log(JSON.stringify(diff, null, 2));
}

main();
