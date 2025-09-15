import { sh } from './shell.js';
import path from 'path';

export async function isGitRepo(cwd) {
  const res = await sh('git rev-parse --is-inside-work-tree', { cwd });
  return res.ok && /true/.test(res.stdout);
}

export async function snapshot(cwd) {
  const before = await sh('git rev-parse HEAD || echo NOHEAD', { cwd });
  const status = await sh('git status --porcelain', { cwd });
  return { head: before.stdout.trim(), status: status.stdout };
}

export async function changedFiles(cwd) {
  const diff = await sh('git status --porcelain', { cwd });
  const files = (diff.stdout || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => l.slice(3));
  return files;
}

export async function revertPaths(cwd, files) {
  if (!files?.length) return;
  const list = files.map(f => `'${f.replace(/'/g, "'\\''")}'`).join(' ');
  await sh(`git checkout -- ${list}`, { cwd });
  // handle untracked files
  await sh(`git clean -f ${list}`, { cwd });
}

