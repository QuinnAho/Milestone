import { Router } from 'express';
import { z } from 'zod';
import { FileAccess } from '../../fs/fileAccess';
import { FileAccessError } from '../../fs/types';
import {
  createTaskFromTemplate,
  getTaskDetail,
  listTasks,
  toggleChecklistLine,
  getNextTaskId,
  reorderTaskList,
  appendProgressEntry
} from '../lib/taskStore';
import { captureDiffSnapshot } from '../lib/gitDiff';

const TaskCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.string().optional()
});

const ChecklistUpdateSchema = z.object({
  line: z.number().int().nonnegative(),
  checked: z.boolean()
});

const DiffSchema = z.object({
  summary: z.string().min(1),
  files: z.array(z.string().min(1)).max(50).optional(),
  patch: z.string().max(4000).optional(),
  commit: z.string().regex(/^[0-9a-f]{7,40}$/).optional()
});

const ProgressAppendSchema = z.object({
  ts: z.string().min(1),
  event: z.string().min(1),
  status: z.string().min(1),
  agent: z.string().min(1),
  details: z.string().min(1),
  diff: DiffSchema.optional()
});

const TaskReorderSchema = z.object({
  order: z.array(z.string().min(1)).min(1)
});

export function createTaskRouter(fileAccess: FileAccess) {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      const tasks = await listTasks(fileAccess);
      res.json({ tasks });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:taskId', async (req, res, next) => {
    try {
      const detail = await getTaskDetail(fileAccess, req.params.taskId);
      res.json(detail);
    } catch (error) {
      if (error instanceof FileAccessError) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const payload = TaskCreateSchema.parse(req.body);
      const taskId = await getNextTaskId(fileAccess);
      const overrides = {
        task_id: taskId,
        title: payload.title,
        description: payload.description,
        priority: payload.priority ?? 'medium',
        status: 'pending',
        created: new Date().toISOString()
      };
      const task = await createTaskFromTemplate(fileAccess, taskId, overrides);
      res.status(201).json({ task });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
        return;
      }
      next(error);
    }
  });

  router.patch('/:taskId/checklist', async (req, res, next) => {
    try {
      const payload = ChecklistUpdateSchema.parse(req.body);
      const line = await toggleChecklistLine(fileAccess, req.params.taskId, payload.line, payload.checked);
      res.json({ line });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
        return;
      }
      next(error);
    }
  });

  router.post('/:taskId/logs', async (req, res, next) => {
    try {
      const payload = ProgressAppendSchema.parse(req.body);
      const diffPayload =
        payload.diff ??
        captureDiffSnapshot({
          cwd: fileAccess.resolve('.')
        });
      await appendProgressEntry(fileAccess, req.params.taskId, {
        ...payload,
        task_id: req.params.taskId,
        diff: diffPayload
      });
      res.status(201).json({ status: 'appended' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
        return;
      }
      next(error);
    }
  });

  router.patch('/order', async (req, res, next) => {
    try {
      const payload = TaskReorderSchema.parse(req.body);
      await reorderTaskList(fileAccess, payload.order);
      res.status(200).json({ status: 'reordered' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
        return;
      }
      if (error instanceof FileAccessError && error.code === 'VALIDATION_FAILED') {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  return router;
}
