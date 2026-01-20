import { Router } from 'express';
import { z } from 'zod';
import { FileAccess } from '../../fs/fileAccess';
import { generateStructuredPrompt } from '../../prompts/structuredPromptGenerator';
import { getNextTaskId } from '../lib/taskStore';

const FeaturePlanSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  inputs: z.string().min(1),
  expectedFiles: z.string().min(1),
  acceptanceCriteria: z.string().min(1),
  references: z.string().min(1).optional()
});

export function createFeatureRouter(fileAccess: FileAccess) {
  const router = Router();

  router.post('/plan', async (req, res, next) => {
    try {
      const payload = FeaturePlanSchema.parse(req.body);
      const taskId = await getNextTaskId(fileAccess);
      const result = await generateStructuredPrompt(fileAccess, {
        blueprintId: 'task_creation',
        variables: {
          task_id: taskId,
          task_title: payload.title,
          task_summary: payload.summary,
          inputs: payload.inputs,
          expected_files: payload.expectedFiles,
          acceptance_criteria: payload.acceptanceCriteria,
          references: payload.references ?? 'ai/AI_TASK_MONITOR_CONTRACT.md'
        },
        persist: false,
        logEvent: false
      });
      res.status(200).json({ plan: result.prompt, taskId });
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
