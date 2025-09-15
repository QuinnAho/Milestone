import path from 'path';
import fs from 'fs-extra';
import { sh } from './shell.js';

export async function runQA(repoPath, scripts = ['build','test','lint']) {
  const builtIns = {
    build: 'npm run build --silent',
    test: 'npm test --silent -- --json',
    lint: 'npx -y eslint -f json .'
  };
  const results = [];
  for (const s of scripts) {
    const cmd = builtIns[s] || s;
    const res = await sh(cmd, { cwd: repoPath });
    results.push({ name: s, ok: res.ok, stdout: res.stdout, stderr: res.stderr });
  }

  const runId = new Date().toISOString().replace(/[:]/g,'-');
  const artifactsDir = path.join(repoPath, 'artifacts', 'NO-TASK', runId);
  await fs.ensureDir(artifactsDir);
  await fs.writeFile(path.join(artifactsDir, 'qa.log'), results.map(r=>`# ${r.name} (ok=${r.ok})\n${r.stdout}\n${r.stderr}`).join('\n\n'));
  return { artifactsDir: path.relative(repoPath, artifactsDir), results };
}

