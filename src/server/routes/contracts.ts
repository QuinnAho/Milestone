import { Router } from 'express';
import { z } from 'zod';
import { FileAccess } from '../../fs/fileAccess';

const ContractUpdateSchema = z.object({
  content: z.string().min(1)
});

const PromptGenerateSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  body: z.string().min(1),
  summary: z.object({
    file: z.string().min(1),
    purpose: z.string().min(1)
  })
});

export function createContractRouter(fileAccess: FileAccess) {
  const router = Router();

  router.get('/current', async (_req, res, next) => {
    try {
      const content = await fileAccess.readText('ai/AI_TASK_MONITOR_CONTRACT.md');
      res.json({ content });
    } catch (error) {
      next(error);
    }
  });

  router.post('/regenerate', async (req, res, next) => {
    try {
      const payload = ContractUpdateSchema.parse(req.body);
      await fileAccess.writeText('ai/AI_TASK_MONITOR_CONTRACT.md', payload.content);
      res.status(200).json({ status: 'updated' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
        return;
      }
      next(error);
    }
  });

  router.get('/prompts', async (_req, res, next) => {
    try {
      const template = await fileAccess.readJson('ai/templates/prompt_template.json');
      res.json(template);
    } catch (error) {
      next(error);
    }
  });

  router.post('/prompts', async (req, res, next) => {
    try {
      const payload = PromptGenerateSchema.parse(req.body);
      await fileAccess.writeJson('ai/templates/prompt_template.json', payload, {
        schema: 'schemas/prompt_template.json'
      });
      res.status(201).json({ status: 'stored' });
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
