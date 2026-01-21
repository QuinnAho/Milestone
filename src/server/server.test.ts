import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { FileAccess } from '../fs/fileAccess';
import { createApp } from './app';

interface TestContext {
  rootDir: string;
  fileAccess: FileAccess;
}

const ctx: TestContext = {
  rootDir: '',
  fileAccess: undefined as unknown as FileAccess
};

beforeEach(async () => {
  ctx.rootDir = mkdtempSync(path.join(tmpdir(), 'ai-task-monitor-api-'));
  ctx.fileAccess = new FileAccess({
    rootDir: ctx.rootDir,
    mode: 'read_write',
    logToFilePath: path.join(ctx.rootDir, 'logs', 'file_access.log')
  });
  await seedTemplates();
  await seedTask('TASK_SAMPLE');
  await seedOrder(['TASK_SAMPLE']);
  await seedCurrentIndex('TASK_SAMPLE');
});

afterEach(() => {
  if (ctx.rootDir && existsSync(ctx.rootDir)) {
    rmSync(ctx.rootDir, { recursive: true, force: true });
  }
});

test('lists tasks and fetches detail', async () => {
  const app = createApp({ fileAccess: ctx.fileAccess });
  const listResponse = await request(app).get('/api/tasks');
  assert.equal(listResponse.status, 200);
  assert.ok(Array.isArray(listResponse.body.tasks));
  assert.equal(listResponse.body.tasks.length, 1);

  const detailResponse = await request(app).get('/api/tasks/TASK_SAMPLE');
  assert.equal(detailResponse.status, 200);
  assert.equal(detailResponse.body.task.task_id, 'TASK_SAMPLE');
  assert.ok(Array.isArray(detailResponse.body.progress));
});

test('creates task from template and toggles checklist', async () => {
  const app = createApp({ fileAccess: ctx.fileAccess });
  const createResponse = await request(app)
    .post('/api/tasks')
    .send({ title: 'New Task', description: 'Demo task' });
  if (createResponse.status !== 201) {
    throw new Error(`status=${createResponse.status} body=${JSON.stringify(createResponse.body)}`);
  }
  const createdTaskId = createResponse.body.task?.task_id;
  assert.equal(createdTaskId, 'TASK_001');

  const toggleResponse = await request(app)
    .patch(`/api/tasks/${createdTaskId}/checklist`)
    .send({ line: 5, checked: true });
  if (toggleResponse.status !== 200) {
    throw new Error(`status=${toggleResponse.status} body=${JSON.stringify(toggleResponse.body)}`);
  }
  assert.ok(toggleResponse.body.line.includes('[x]'));
});

test('milestone status switches to qa_pending when blocking tasks complete', async () => {
  await seedMilestone(['TASK_SAMPLE']);
  const app = createApp({ fileAccess: ctx.fileAccess });
  const checklist = await ctx.fileAccess.readText('ai/tasks/TASK_SAMPLE/checklist.md');
  const actionable = checklist
    .split(/\r?\n/)
    .map((line, index) => ({ line, index }))
    .filter((item) => item.line.trim().startsWith('- ['));
  for (const { index } of actionable) {
    const response = await request(app)
      .patch('/api/tasks/TASK_SAMPLE/checklist')
      .send({ line: index, checked: true });
    if (response.status !== 200) {
      throw new Error(`status=${response.status} body=${JSON.stringify(response.body)}`);
    }
  }
  const milestone = await ctx.fileAccess.readJson<Record<string, unknown>>('ai/milestones/MILESTONE_001/milestone.json');
  assert.equal(milestone.status, 'qa_pending');
  const logContents = await ctx.fileAccess.readText('ai/milestones/MILESTONE_001/qa_progress.ndjson');
  assert.ok(/milestone_status_changed/.test(logContents));
});

test('reorders tasks via API', async () => {
  const app = createApp({ fileAccess: ctx.fileAccess });
  const createResponse = await request(app)
    .post('/api/tasks')
    .send({ title: 'Second Task', description: 'Another task' });
  if (createResponse.status !== 201) {
    throw new Error(`status=${createResponse.status} body=${JSON.stringify(createResponse.body)}`);
  }
  const reorderResponse = await request(app)
    .patch('/api/tasks/order')
    .send({ order: ['TASK_001', 'TASK_SAMPLE'] });
  assert.equal(reorderResponse.status, 200);
  const listResponse = await request(app).get('/api/tasks');
  assert.equal(listResponse.status, 200);
  const ids = listResponse.body.tasks.map((task: Record<string, unknown>) => task.task_id);
  assert.deepEqual(ids.slice(0, 2), ['TASK_001', 'TASK_SAMPLE']);
  const currentIndex = await ctx.fileAccess.readJson<Record<string, string>>('ai/tasks/current_index.json');
  assert.equal(currentIndex.active_task_id, 'TASK_SAMPLE');
});

test('appends log entry and regenerates contract', async () => {
  const app = createApp({ fileAccess: ctx.fileAccess });
  const logResponse = await request(app)
    .post('/api/tasks/TASK_SAMPLE/logs')
    .send({
      ts: new Date().toISOString(),
      event: 'step_completed',
      status: 'success',
      agent: 'test',
      details: 'Added log entry via API'
    });
  assert.equal(logResponse.status, 201);

  const contractResponse = await request(app)
    .post('/api/contracts/regenerate')
    .send({ content: '<!-- Machine Summary Block -->\n{"file":"ai/MILESTONE_CONTRACT.md","purpose":"Test"}\n\n# Contract' });
  assert.equal(contractResponse.status, 200);

  const promptResponse = await request(app)
    .post('/api/contracts/prompts')
    .send({
      id: 'prompt_test',
      description: 'demo',
      body: 'test body',
      summary: { file: 'ai/templates/prompt_template.json', purpose: 'demo' }
    });
  assert.equal(promptResponse.status, 201);
});

async function seedTemplates() {
  const checklist = [
    '<!-- Machine Summary Block -->',
    '{"file":"ai/tasks/templates/checklist.md","purpose":"Template"}',
    '',
    '# Task Checklist: {{TASK_ID}}',
    '',
    '- [ ] Step 1'
  ].join('\n');

  await ctx.fileAccess.writeText('ai/tasks/templates/checklist.md', `${checklist}\n`);
  await ctx.fileAccess.writeJson(
    'ai/tasks/templates/task.json',
    {
      task_id: '{{TASK_ID}}',
      title: 'Template',
      description: 'Template',
      created: '1970-01-01T00:00:00Z',
      status: 'pending',
      priority: 'medium',
      inputs: { files: [], context: [] },
      outputs: { expected_files: [], expected_changes: [] },
      acceptance_criteria: [],
      notes: []
    },
    { schema: 'schemas/task.json' }
  );
  await ctx.fileAccess.writeText('ai/tasks/templates/progress.ndjson', '');
}

async function seedTask(taskId: string) {
  const base = `ai/tasks/${taskId}`;
  await ctx.fileAccess.writeJson(
    `${base}/task.json`,
    {
      task_id: taskId,
      title: 'Sample',
      description: 'Sample desc',
      created: '2026-01-01T00:00:00Z',
      status: 'in_progress',
      priority: 'high',
      inputs: { files: [], context: [] },
      outputs: { expected_files: [], expected_changes: [] },
      acceptance_criteria: [],
      notes: []
    },
    { schema: 'schemas/task.json' }
  );
  await ctx.fileAccess.writeText(
    `${base}/checklist.md`,
    ['<!-- Machine Summary Block -->', '{"file":"sample","purpose":"demo"}', '', '- [ ] Step A', '- [ ] Step B', '- [ ] Step C'].join('\n')
  );
  await ctx.fileAccess.writeText(
    `${base}/progress.ndjson`,
    '{"ts":"2026-01-01T00:00:00Z","task_id":"' + taskId + '","event":"task_started","status":"in_progress","agent":"tester","details":"Seed"}\n'
  );
  await ctx.fileAccess.writeText(
    'ai/MILESTONE_CONTRACT.md',
    '<!-- Machine Summary Block -->\n{"file":"ai/MILESTONE_CONTRACT.md","purpose":"Contract"}\n\n# Contract'
  );
  await ctx.fileAccess.writeJson(
    'ai/templates/prompt_template.json',
    {
      id: 'prompt_sample',
      description: 'sample',
      body: 'body',
      summary: { file: 'ai/templates/prompt_template.json', purpose: 'sample' }
    },
    { schema: 'schemas/prompt_template.json' }
  );
}

async function seedOrder(taskIds: string[]) {
  await ctx.fileAccess.writeJson('ai/tasks/order.json', taskIds, { pretty: true });
}

async function seedCurrentIndex(taskId: string) {
  await ctx.fileAccess.writeJson(
    'ai/tasks/current_index.json',
    {
      active_task_id: taskId,
      task_path: `ai/tasks/${taskId}`,
      status: 'pending',
      last_updated: new Date().toISOString()
    },
    { pretty: true }
  );
}

async function seedMilestone(taskIds: string[]) {
  const milestoneRecord = {
    milestone_id: 'MILESTONE_001',
    title: 'Test Milestone',
    description: 'Covers sample tasks',
    created: new Date().toISOString(),
    status: 'pending',
    priority: 'high',
    tasks: taskIds.map((taskId) => ({ task_id: taskId, blocking: true, qa_required: true })),
    qa_review: {
      status: 'not_started',
      checklist_path: 'ai/milestones/MILESTONE_001/qa_checklist.md',
      log_path: 'ai/milestones/MILESTONE_001/qa_progress.ndjson'
    },
    qa_scope: [],
    acceptance_criteria: [],
    notes: []
  };
  await ctx.fileAccess.writeJson('ai/milestones/MILESTONE_001/milestone.json', milestoneRecord, {
    schema: 'schemas/milestone.json'
  });
  await ctx.fileAccess.writeText(
    'ai/milestones/MILESTONE_001/qa_checklist.md',
    '<!-- Machine Summary Block -->\n{"file":"ai/milestones/MILESTONE_001/qa_checklist.md","purpose":"QA checklist seed"}\n\n# QA Checklist\n'
  );
  await ctx.fileAccess.writeText('ai/milestones/MILESTONE_001/qa_progress.ndjson', '');
  await ctx.fileAccess.writeJson(
    'ai/milestones/milestone_index.json',
    {
      version: 1,
      last_updated: new Date().toISOString(),
      milestones: [
        {
          milestone_id: 'MILESTONE_001',
          title: 'Test Milestone',
          status: 'pending',
          qa_status: 'not_started',
          qa_required: true,
          task_ids: taskIds
        }
      ],
      unassigned_tasks: []
    },
    { schema: 'schemas/milestone_index.json' }
  );
}
