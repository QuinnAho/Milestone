import { Router } from 'express';
import { z } from 'zod';
import { FileAccess } from '../../fs/fileAccess';

const ChecklistFetchSchema = z.object({
  taskId: z.string().regex(/^TASK_[A-Za-z0-9_\-]+$/)
});

export function createChecklistRouter(fileAccess: FileAccess) {
  const router = Router();

  router.get('/:taskId', async (req, res, next) => {
    try {
      const { taskId } = ChecklistFetchSchema.parse(req.params);
      const contents = await fileAccess.readText(`ai/tasks/${taskId}/checklist.md`);
      res.json({ taskId, checklist: contents });
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
