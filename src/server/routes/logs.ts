import { Router } from 'express';
import { z } from 'zod';
import { FileAccess } from '../../fs/fileAccess';
import { parseNdjson } from '../lib/taskStore';

const TaskParamsSchema = z.object({
  taskId: z.string().regex(/^TASK_[A-Za-z0-9_\-]+$/)
});

export function createLogRouter(fileAccess: FileAccess) {
  const router = Router();

  router.get('/:taskId', async (req, res, next) => {
    try {
      const { taskId } = TaskParamsSchema.parse(req.params);
      const raw = await fileAccess.readText(`ai/tasks/${taskId}/progress.ndjson`);
      res.json({ taskId, entries: parseNdjson(raw) });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
        return;
      }
      next(error);
    }
  });

  return router;
}
