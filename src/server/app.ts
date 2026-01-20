import express from 'express';
import path from 'node:path';
import { FileAccess } from '../fs/fileAccess';
import { FileAccessError } from '../fs/types';
import { createTaskRouter } from './routes/tasks';
import { createChecklistRouter } from './routes/checklists';
import { createLogRouter } from './routes/logs';
import { createTemplateRouter } from './routes/templates';
import { createContractRouter } from './routes/contracts';
import { createPromptGeneratorRouter } from './routes/prompts';
import { createFeatureRouter } from './routes/features';
import { createMilestoneRouter } from './routes/milestones';

export interface AppConfig {
  fileAccess?: FileAccess;
  rootDir?: string;
}

export function createApp(config: AppConfig = {}) {
  const app = express();
  const fileAccess =
    config.fileAccess ??
    new FileAccess({
      rootDir: config.rootDir ?? process.cwd(),
      mode: 'read_write',
      logToFilePath: path.join(process.cwd(), 'logs', 'file_access.log')
    });

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/tasks', createTaskRouter(fileAccess));
  app.use('/api/checklists', createChecklistRouter(fileAccess));
  app.use('/api/logs', createLogRouter(fileAccess));
  app.use('/api/templates', createTemplateRouter(fileAccess));
  app.use('/api/contracts', createContractRouter(fileAccess));
  app.use('/api/prompts', createPromptGeneratorRouter(fileAccess));
  app.use('/api/features', createFeatureRouter(fileAccess));
  app.use('/api/milestones', createMilestoneRouter(fileAccess));

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof FileAccessError) {
      res.status(400).json({ error: err.message, code: err.code });
      return;
    }
    res.status(500).json({ error: 'Internal Server Error' });
  });

  return app;
}
