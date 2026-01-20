import { Router } from 'express';
import { z } from 'zod';
import { FileAccess } from '../../fs/fileAccess';
import { FileAccessError } from '../../fs/types';
import {
  appendMilestoneLog,
  createMilestone,
  getMilestoneDetail,
  listMilestones,
  updateMilestone,
  MilestoneTaskEntry
} from '../lib/milestoneStore';

const TaskEntrySchema: z.ZodType<MilestoneTaskEntry> = z.object({
  task_id: z.string().min(1),
  blocking: z.boolean().optional(),
  qa_required: z.boolean().optional(),
  status_override: z.string().optional(),
  contract_refs: z.array(z.string().min(1)).optional(),
  notes: z.string().optional()
});

const MilestoneCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  tasks: z.array(z.string().min(1)).min(1),
  qa_scope: z.array(z.string().min(1)).optional(),
  acceptance_criteria: z.array(z.string().min(1)).optional(),
  notes: z.array(z.string().min(1)).optional(),
  links: z.record(z.any()).optional()
});

const MilestoneUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  status: z.enum(['pending', 'active', 'qa_pending', 'qa_in_progress', 'blocked', 'completed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  tasks: z.array(TaskEntrySchema).optional(),
  qa_scope: z.array(z.string().min(1)).optional(),
  acceptance_criteria: z.array(z.string().min(1)).optional(),
  notes: z.array(z.string().min(1)).optional(),
  links: z.record(z.any()).optional(),
  qa_review: z
    .object({
      status: z.enum(['not_started', 'in_progress', 'blocked', 'completed']).optional(),
      assigned_to: z.string().min(1).optional(),
      started_at: z.string().min(1).optional(),
      completed_at: z.string().min(1).optional(),
      notes: z.string().optional()
    })
    .optional()
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

export function createMilestoneRouter(fileAccess: FileAccess) {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      const collection = await listMilestones(fileAccess);
      res.json(collection);
    } catch (error) {
      next(error);
    }
  });

  router.get('/:milestoneId', async (req, res, next) => {
    try {
      const detail = await getMilestoneDetail(fileAccess, req.params.milestoneId);
      res.json(detail);
    } catch (error) {
      if (error instanceof FileAccessError) {
        res.status(404).json({ error: 'Milestone not found' });
        return;
      }
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const payload = MilestoneCreateSchema.parse(req.body);
      const milestone = await createMilestone(fileAccess, payload);
      res.status(201).json({ milestone });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
        return;
      }
      if (error instanceof FileAccessError) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  router.patch('/:milestoneId', async (req, res, next) => {
    try {
      const payload = MilestoneUpdateSchema.parse(req.body);
      const milestone = await updateMilestone(fileAccess, req.params.milestoneId, payload);
      res.json({ milestone });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
        return;
      }
      if (error instanceof FileAccessError && error.code === 'IO_ERROR') {
        res.status(404).json({ error: 'Milestone not found' });
        return;
      }
      next(error);
    }
  });

  router.post('/:milestoneId/logs', async (req, res, next) => {
    try {
      const payload = ProgressAppendSchema.parse(req.body);
      await appendMilestoneLog(fileAccess, req.params.milestoneId, payload);
      res.status(201).json({ status: 'appended' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
        return;
      }
      if (error instanceof FileAccessError && error.code === 'IO_ERROR') {
        res.status(404).json({ error: 'Milestone not found' });
        return;
      }
      next(error);
    }
  });

  return router;
}
