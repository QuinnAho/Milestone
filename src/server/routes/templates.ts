import { Router } from 'express';
import { FileAccess } from '../../fs/fileAccess';
import { listTemplates } from '../lib/taskStore';

export function createTemplateRouter(fileAccess: FileAccess) {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      const templates = await listTemplates(fileAccess);
      res.json({ templates });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
