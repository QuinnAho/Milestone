import express from 'express';
import { bootstrapAiTree, getCurrentTaskIdPath, listTasks } from '../lib/aiRepo.js';
import { createTask, switchTask } from '../lib/tasks.js';

export const tasksRouter = express.Router();

tasksRouter.get('/tasks', async (req, res) => {
  try {
    const repoPath = req.query.path;
    if (!repoPath || typeof repoPath !== 'string') return res.status(400).json({ error: 'path required' });
    await bootstrapAiTree(repoPath);
    const tasks = await listTasks(repoPath);
    const current = await getCurrentTaskIdPath(repoPath);
    return res.json({ tasks, current });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

tasksRouter.post('/tasks', async (req, res) => {
  try {
    const { path: repoPath, id, title, priority, deps } = req.body || {};
    if (!repoPath || !id || !title) return res.status(400).json({ error: 'path, id, title required' });
    const task = await createTask(repoPath, { id, title, priority, deps });
    return res.json({ ok: true, task });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

tasksRouter.post('/tasks/switch', async (req, res) => {
  try {
    const { path: repoPath, idPath } = req.body || {};
    if (!repoPath || !idPath) return res.status(400).json({ error: 'path, idPath required' });
    await switchTask(repoPath, idPath);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

