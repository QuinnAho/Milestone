import { Router } from 'express';
import { z } from 'zod';
import { FileAccess } from '../../fs/fileAccess';
import {
  generateStructuredPrompt,
  listBlueprintSummaries
} from '../../prompts/structuredPromptGenerator';

const GenerateSchema = z.object({
  blueprintId: z.string().min(1),
  variables: z.record(z.string()).default({}),
  persist: z.boolean().optional(),
  targetFile: z.string().min(1).optional(),
  taskId: z.string().min(1).optional()
});

export function createPromptGeneratorRouter(fileAccess: FileAccess) {
  const router = Router();

  router.get('/blueprints', async (_req, res, next) => {
    try {
      const blueprints = await listBlueprintSummaries(fileAccess);
      res.json({ blueprints });
    } catch (error) {
      next(error);
    }
  });

  router.post('/generate', async (req, res, next) => {
    try {
      const payload = GenerateSchema.parse(req.body);
      const result = await generateStructuredPrompt(fileAccess, {
        blueprintId: payload.blueprintId,
        variables: payload.variables,
        outputPath: payload.targetFile,
        persist: payload.persist ?? false,
        taskId: payload.taskId
      });
      res.status(payload.persist ? 201 : 200).json({
        prompt: result.prompt,
        blueprint: result.blueprint
      });
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
