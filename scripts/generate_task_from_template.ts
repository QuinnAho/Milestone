#!/usr/bin/env node
/**
 * Copies the ai/tasks/templates module into a new task directory using the FileAccess helper.
 * Usage: npm run generate:task -- TASK_123_new_task
 */
import path from 'node:path';
import process from 'node:process';
import { FileAccess } from '../src/fs/fileAccess';

async function main() {
  const [, , taskId, customDir] = process.argv;
  if (!taskId) {
    console.error('Usage: npm run generate:task -- TASK_123_example [target_dir]');
    process.exit(1);
  }

  const targetDirName = customDir ?? taskId;
  const templateDir = path.join('ai', 'tasks', 'templates');
  const targetDir = path.join('ai', 'tasks', targetDirName);
  const rootDir = path.resolve(__dirname, '..');
  const fileAccess = new FileAccess({
    rootDir,
    mode: 'read_write',
    logToFilePath: path.join(rootDir, 'logs', 'file_access.log')
  });

  const templateFiles = await fileAccess.list(templateDir);
  for (const templatePath of templateFiles) {
    const relative = path.relative(templateDir, templatePath);
    const destination = path.join(targetDir, relative);
    const contents = await fileAccess.readText(templatePath);
    const replaced = contents.replace(/{{TASK_ID}}/g, taskId);
    await fileAccess.writeText(destination, replaced);
  }

  console.log(`Task scaffolded at ${targetDir}`);
}

main().catch((error) => {
  console.error('Failed to generate task from template', error);
  process.exit(1);
});
