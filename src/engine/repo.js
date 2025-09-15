import path from 'path';
import fs from 'fs-extra';
import { ensureDir, writeJson, readJson } from './fsutil.js';

export async function initRepo(repoPath) {
  const aiRoot = path.join(repoPath, 'ai');
  const configDir = path.join(aiRoot, 'config');
  const tasksDir = path.join(aiRoot, 'tasks');
  await ensureDir(configDir);
  await ensureDir(tasksDir);
  const providersJson = path.join(configDir, 'providers.json');
  if (!(await fs.pathExists(providersJson))) {
    await writeJson(providersJson, {
      default: 'claude',
      providers: [
        { name: 'claude', cli: 'claude', model: 'claude-3-7-sonnet' },
        { name: 'openai', cli: 'openai', model: 'gpt-4.1-mini' },
        { name: 'codex', cli: 'codex' }
      ]
    });
  }
  const indexPath = path.join(tasksDir, 'index.json');
  if (!(await fs.pathExists(indexPath))) await writeJson(indexPath, []);
  const currentPath = path.join(tasksDir, 'CURRENT');
  if (!(await fs.pathExists(currentPath))) await fs.writeFile(currentPath, '');
  return { aiRoot, configDir, tasksDir };
}

export async function listTasks(repoPath) {
  const indexPath = path.join(repoPath, 'ai', 'tasks', 'index.json');
  return (await readJson(indexPath, [])) || [];
}

export async function setCurrent(repoPath, idPath) {
  const file = path.join(repoPath, 'ai', 'tasks', 'CURRENT');
  await fs.ensureFile(file);
  await fs.writeFile(file, idPath ?? '');
}

export async function getCurrent(repoPath) {
  const file = path.join(repoPath, 'ai', 'tasks', 'CURRENT');
  if (!(await fs.pathExists(file))) return '';
  return (await fs.readFile(file, 'utf8')).trim();
}
