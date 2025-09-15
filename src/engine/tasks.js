import path from 'path';
import fs from 'fs-extra';
import { initRepo, listTasks } from './repo.js';
import { writeJson, appendLine } from './fsutil.js';

export async function createTask(repoPath, { id, title, priority = 'medium', deps = [] }) {
  await initRepo(repoPath);
  const tasksDir = path.join(repoPath, 'ai', 'tasks');
  const taskDir = path.join(tasksDir, id);
  await fs.ensureDir(taskDir);
  const now = new Date().toISOString();
  const entry = { id, title, status: 'Backlog', priority, deps, createdAt: now };
  const indexPath = path.join(tasksDir, 'index.json');
  const tasks = await listTasks(repoPath);
  tasks.push(entry);
  await writeJson(indexPath, tasks);

  await fs.writeFile(path.join(taskDir, 'README.md'), `# ${id} - ${title}\n\n`);
  await fs.writeFile(path.join(taskDir, 'spec.yaml'), '# Acceptance criteria\n');
  await fs.writeFile(path.join(taskDir, 'whitelist.txt'), '');
  await fs.writeFile(path.join(taskDir, 'passes.yaml'), '');
  await fs.ensureFile(path.join(taskDir, 'progress.ndjson'));
  await appendLine(path.join(taskDir, 'progress.ndjson'), JSON.stringify({ ts: now, type: 'task.created', id, title }));
  return entry;
}

export async function switchTask(repoPath, idPath) {
  const tasksDir = path.join(repoPath, 'ai', 'tasks');
  await fs.ensureFile(path.join(tasksDir, 'CURRENT'));
  await fs.writeFile(path.join(tasksDir, 'CURRENT'), idPath);
}

export async function readWhitelist(repoPath, taskIdPath) {
  const id = (taskIdPath || '').split('/')[0];
  if (!id) return [];
  const file = path.join(repoPath, 'ai', 'tasks', id, 'whitelist.txt');
  if (!(await fs.pathExists(file))) return [];
  return (await fs.readFile(file, 'utf8')).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
}

export function isAllowedEdit(file, whitelist) {
  if (!whitelist?.length) return true;
  return whitelist.some(w => file === w || file.startsWith(`${w}/`));
}

