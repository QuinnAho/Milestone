import path from 'path';
import fs from 'fs-extra';
import { appendLine, readJson, writeJson } from './fsutil.js';

export async function appendEvent(repoPath, taskId, event) {
  const taskDir = path.join(repoPath, 'ai', 'tasks', taskId);
  const file = path.join(taskDir, 'progress.ndjson');
  await appendLine(file, JSON.stringify({ ts: new Date().toISOString(), ...event }));
}

export async function computeProgressSnapshot(repoPath) {
  const tasksDir = path.join(repoPath, 'ai', 'tasks');
  const index = await fs.readJson(path.join(tasksDir, 'index.json')).catch(()=>[]);
  const columns = { Backlog: [], 'In Progress': [], Review: [], Done: [] };
  const byId = {};
  for (const t of index) {
    const evPath = path.join(tasksDir, t.id, 'progress.ndjson');
    let status = t.status || 'Backlog';
    try {
      const data = await fs.readFile(evPath, 'utf8');
      const lines = data.split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));
      for (const e of lines) {
        if (e.type === 'task.status') status = e.status;
      }
    } catch {}
    const snap = { ...t, status };
    byId[t.id] = snap;
    (columns[status] || columns.Backlog).push(snap);
  }
  const progress = { columns };
  await writeJson(path.join(repoPath, 'ai', 'progress.json'), progress);
  return progress;
}

