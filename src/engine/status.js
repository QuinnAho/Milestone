import path from 'path';
import fs from 'fs-extra';
import { sh } from './shell.js';

async function runFirst(repoPath, commands) {
  for (const cmd of commands) {
    const res = await sh(cmd, { cwd: repoPath });
    if (res.ok || res.stdout || res.stderr) return { cmd, ok: res.ok, stdout: res.stdout, stderr: res.stderr };
  }
  return null;
}

export async function computeStatus(repoPath) {
  const build = await runFirst(repoPath, ['npm run build --silent', 'pnpm build', 'yarn build', 'make']);
  const tests = await runFirst(repoPath, ['npm test --silent -- --json', 'pytest --json-report', 'go test -json ./...', 'ctest -T Test']);
  const lint = await runFirst(repoPath, ['npx -y eslint -f json .', 'ruff --output-format json .', 'golangci-lint run --out-format json']);

  const activity = await sh('git log --since=7.days --pretty=oneline | wc -l', { cwd: repoPath });
  const dirty = await sh('git status --porcelain', { cwd: repoPath });
  const branch = await sh('git rev-parse --abbrev-ref HEAD', { cwd: repoPath });
  const activityCount = activity.ok ? parseInt((activity.stdout||'0').trim(),10)||0 : 0;
  const isDirty = dirty.ok ? (dirty.stdout||'').trim().length>0 : false;

  const signals = { build, tests, lint, repo: { activityCount, dirty: isDirty, branch: branch.stdout?.trim()||'' } };
  const explain = [];
  let overall = 'yellow';
  const buildPass = !!(build && build.ok);
  const testsPass = tests ? tests.ok : null;
  const lintPass = lint ? lint.ok : null;
  if (!buildPass) { overall = 'red'; explain.push('Build failed'); }
  if (tests && testsPass === false) { overall = 'red'; explain.push('Tests failed'); }
  if (lint && lintPass === false) { overall = 'red'; explain.push('Lint errors present'); }
  if (overall !== 'red') {
    if (isDirty) explain.push('Repo dirty');
    overall = buildPass && ((tests===null && (lint ? lint.ok : true)) || testsPass) ? 'green' : (explain.length? 'yellow':'green');
  }
  return { overall, explain: explain.join('; ') || 'OK', signals };
}

