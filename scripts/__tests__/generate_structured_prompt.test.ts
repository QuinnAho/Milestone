import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { beforeEach, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { FileAccess } from '../../src/fs/fileAccess';
import {
  buildPrompt,
  generateStructuredPrompt,
  renderTemplate,
  type PromptBlueprint
} from '../../src/prompts/structuredPromptGenerator';

interface TestContext {
  rootDir: string;
  fileAccess: FileAccess;
}

const ctx: TestContext = {
  rootDir: '',
  fileAccess: undefined as unknown as FileAccess
};

beforeEach(() => {
  ctx.rootDir = mkdtempSync(path.join(tmpdir(), 'structured-prompt-test-'));
  ctx.fileAccess = new FileAccess({ rootDir: ctx.rootDir, mode: 'read_write' });
  seedBlueprintFixtures(ctx.rootDir);
});

afterEach(() => {
  if (ctx.rootDir) {
    rmSync(ctx.rootDir, { recursive: true, force: true });
  }
});

test('renderTemplate replaces placeholders', () => {
  const rendered = renderTemplate('Hello {{name}}!', { name: 'Codex' });
  assert.equal(rendered, 'Hello Codex!');
});

test('buildPrompt applies variables across fields', () => {
  const blueprint: PromptBlueprint = {
    blueprint_id: 'demo',
    description: 'demo',
    summary: { file: 'demo', purpose: 'demo' },
    template: {
      id: 'prompt_{{task}}',
      description: 'Desc {{task}}',
      body: 'Body {{task}}',
      tags: ['{{task}}'],
      summary: { file: 'file_{{task}}', purpose: 'purpose {{task}}' }
    },
    placeholders: [{ name: 'task', description: 'Task', required: true }]
  };

  const prompt = buildPrompt(blueprint, { task: 'TASK_X' });
  assert.equal(prompt.id, 'prompt_TASK_X');
  assert.equal(prompt.description, 'Desc TASK_X');
  assert.equal(prompt.body, 'Body TASK_X');
  assert.deepEqual(prompt.tags, ['TASK_X']);
  assert.equal(prompt.summary.file, 'file_TASK_X');
});

test('generateStructuredPrompt persists prompt and logs event', async () => {
  const result = await generateStructuredPrompt(ctx.fileAccess, {
    blueprintId: 'sample_blueprint',
    variables: {
      task_id: 'TASK_DEMO',
      task_title: 'Demo Work',
      acceptance: 'Do the thing'
    },
    outputPath: 'ai/templates/generated/demo.json',
    taskId: 'TASK_TEST'
  });

  const prompt = await ctx.fileAccess.readJson<Record<string, unknown>>('ai/templates/generated/demo.json');
  assert.equal(prompt.id, 'prompt_TASK_DEMO');
  assert.equal(prompt.description, 'Demo prompt for Demo Work');
  assert.equal(prompt.body, 'Acceptance: Do the thing | Context: Default feasibility context');

  const logContents = await ctx.fileAccess.readText('ai/tasks/TASK_TEST/progress.ndjson');
  assert.ok(logContents.includes('structured_prompt_generator'));

  assert.equal(result.prompt.id, prompt.id);
  assert.equal(result.outputPath, 'ai/templates/generated/demo.json');
});

function seedBlueprintFixtures(rootDir: string) {
  const blueprintDir = path.join(rootDir, 'ai', 'templates', 'prompt_blueprints');
  const taskDir = path.join(rootDir, 'ai', 'tasks', 'TASK_TEST');
  const generatedDir = path.join(rootDir, 'ai', 'templates', 'generated');

  [blueprintDir, taskDir, generatedDir].forEach((dir) => mkdirSync(dir, { recursive: true }));

  const blueprint = {
    blueprint_id: 'sample_blueprint',
    description: 'Sample blueprint',
    summary: {
      file: 'ai/templates/prompt_blueprints/sample_blueprint.json',
      purpose: 'Sample for tests'
    },
    placeholders: [
      { name: 'task_id', description: 'Task ID', required: true },
      { name: 'task_title', description: 'Task title', required: true },
      { name: 'acceptance', description: 'Acceptance', required: true },
      { name: 'context', description: 'Context', required: false, default: 'Default feasibility context' }
    ],
    template: {
      id: 'prompt_{{task_id}}',
      description: 'Demo prompt for {{task_title}}',
      body: 'Acceptance: {{acceptance}} | Context: {{context}}',
      summary: {
        file: 'ai/templates/generated/{{task_id}}.json',
        purpose: 'Generated for {{task_title}}'
      }
    }
  };
  writeFileSync(path.join(blueprintDir, 'sample_blueprint.json'), JSON.stringify(blueprint, null, 2));

  const index = {
    active_task_id: 'TASK_TEST',
    task_path: 'ai/tasks/TASK_TEST',
    status: 'in_progress',
    last_updated: new Date().toISOString()
  };
  writeFileSync(path.join(rootDir, 'ai', 'tasks', 'current_index.json'), JSON.stringify(index, null, 2));
  writeFileSync(path.join(taskDir, 'progress.ndjson'), '');
}
