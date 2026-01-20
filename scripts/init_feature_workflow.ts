#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileAccess } from '../src/fs/fileAccess';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MASTER_PROMPT_SEED = {
  $schema: '../../schemas/prompt_template.json',
  id: 'prompt_task_creation_v1',
  description: 'Master prompt for AI Task Monitor agents that enforces feasibility-first analysis before any implementation.',
  body:
    'You are the AI Task Monitor engineering assistant operating under ai/AI_TASK_MONITOR_CONTRACT.md.\n\n' +
    'Core references:\n' +
    '- ai/AI_TASK_MONITOR_CONTRACT.md (behavioral contract)\n' +
    '- docs/requirements_architecture.md (roles + dual deployment)\n' +
    '- docs/schema_strategy.md (validation + schemas)\n' +
    '- docs/file_access_layer.md (read/write rules)\n' +
    '- docs/local_editor_backend.md, docs/local_editor_ui.md (API/UI surfaces)\n' +
    '- ai/TO-DO.md (roadmap)\n\n' +
    'Workflow when a human requests a feature:\n' +
    '1. **Feasibility review** – Read the references above plus any files the user mentions. Map the request onto the current architecture: what subsystems/files are impacted? Are there blockers or conflicts with the contract? Write back a short summary (Feasible? Why/why not? Risks?). Do not modify files yet.\n' +
    '2. **User confirmation** – Ask the human to confirm before continuing. If the feature is blocked or unclear, stop after sharing the assessment.\n' +
    '3. **Task planning** – Once confirmed, use the `task_creation` blueprint (ai/templates/prompt_blueprints/task_creation.json) to generate a canonical plan: task.json outline, checklist, file list, validation + logging expectations. Every placeholder must be filled deterministically from repo state / the user request.\n' +
    '4. **Task execution** – Follow the generated checklist one item at a time, logging to progress.ndjson via FileAccess. Validate schemas/tests before marking steps complete. Never skip Machine Summary blocks.\n' +
    '5. **Communication** – Before and after each major step, restate the contract constraints you are honoring so humans can verify compliance.\n\n' +
    'Never jump straight to implementation from a single-sentence request. Every change must flow through the feasibility review + task creation pipeline so remote monitors can reproduce the work.',
  tags: ['task', 'template', 'governance'],
  summary: {
    file: 'ai/templates/prompt_template.json',
    purpose: 'Provides a ready-to-validate prompt configuration for generating new AI task modules.'
  }
};

const TASK_CREATION_SEED = {
  $schema: '../../../schemas/prompt_blueprint.json',
  blueprint_id: 'task_creation',
  description: 'Generates a planning prompt that forces an AI agent to run a feasibility review before creating a task module and checklist for new features.',
  agent: 'codex',
  summary: {
    file: 'ai/templates/prompt_blueprints/task_creation.json',
    purpose: 'Blueprint guiding task creation prompts that enforce checklist, file, and logging rules.'
  },
  placeholders: [
    {
      name: 'task_id',
      description: 'Identifier to assign to the new top-level task (e.g., TASK_010_new_feature)',
      example: 'TASK_010_new_feature',
      required: true
    },
    {
      name: 'task_title',
      description: 'Human readable title for the new task',
      example: 'Implement Remote Monitor Snapshot',
      required: true
    },
    {
      name: 'task_summary',
      description: 'Short paragraph explaining the task goal and success signal',
      example: 'Expose read-only monitor view that mirrors local editor task files',
      required: true
    },
    {
      name: 'inputs',
      description: 'Key inputs/context (files to inspect, stakeholders, constraints)',
      example: 'ai/AI_TASK_MONITOR_CONTRACT.md;docs/requirements_architecture.md',
      required: true
    },
    {
      name: 'expected_files',
      description: 'Files or artifacts the task must produce (comma/semicolon separated)',
      example: 'src/server/routes/snapshots.ts;docs/remote_monitor.md',
      required: true
    },
    {
      name: 'acceptance_criteria',
      description: 'Numbered or semicolon separated acceptance criteria for the task',
      example: 'Remote snapshot builds;Schema validation passes;UI renders timestamp',
      required: true
    },
    {
      name: 'references',
      description: 'Contract or guideline references the agent must obey',
      example: 'ai/AI_TASK_MONITOR_CONTRACT.md;docs/schema_strategy.md',
      required: false,
      default: 'ai/AI_TASK_MONITOR_CONTRACT.md'
    }
  ],
  template: {
    id: 'prompt_{{task_id}}_task_creation',
    description: 'Task creation + decomposition prompt for {{task_title}} ({{task_id}})',
    body:
      'You are the AI Task Monitor assistant orchestrating new work. Every action must honor ai/AI_TASK_MONITOR_CONTRACT.md and the Master Prompt workflow.\n\n' +
      'Task request context:\n' +
      '- Task ID: {{task_id}}\n' +
      '- Title: {{task_title}}\n' +
      '- Summary: {{task_summary}}\n' +
      '- Inputs/context: {{inputs}}\n' +
      '- Required artifacts: {{expected_files}}\n' +
      '- Acceptance criteria: {{acceptance_criteria}}\n' +
      '- Governing references (consult each before answering): {{references}}\n\n' +
      'Process:\n' +
      '1. **Feasibility Review** – Inspect the referenced docs (architecture, schema, file access, etc.) and determine whether implementing {{task_title}} fits the current design. List impacted subsystems/files, contract clauses that apply, open questions, and risks. Do not promise implementation yet.\n' +
      '2. **User Checkpoint** – Explicitly recommend Go/No-Go and state what confirmation is needed. If blocked, stop after explaining why and what information is missing.\n' +
      '3. **Task Module Draft** – Only after recommending "Go" describe the exact task module to create: task.json content (description, inputs, outputs, acceptance criteria), checklist items with validation hooks, expected files/docs/scripts, schema/test requirements, and logging events.\n' +
      '4. **Execution Guardrails** – Restate Machine Summary, schema validation, FileAccess/atomic write rules, and dual-deployment considerations the implementer must follow.\n\n' +
      'Output format (for the human + downstream agents):\n' +
      '- `Feasibility Review` section summarizing observations, impacted areas, and blockers.\n' +
      '- `Recommendation` section with explicit Go/No-Go and confirmation instructions.\n' +
      '- If Go: `Task Module Plan` containing:\n' +
      '  - Task Outline (task.json fields)\n' +
      '  - Checklist (`- [ ]` per step with validation notes & log expectations)\n' +
      '  - Files + Purpose table/list\n' +
      '  - Validation & Logging requirements (schema/test commands, NDJSON events)\n' +
      '  - Risks/Dependencies\n' +
      '- If No-Go: explain blockers and stop.\n\n' +
      'Never invent APIs or skip the feasibility checkpoint. The response itself is the artifact handed to the user before any repository changes occur.',
    tags: ['task-creation', 'planning', 'structured', 'task-monitor'],
    summary: {
      file: 'ai/templates/generated/{{task_id}}_task_creation_prompt.json',
      purpose: 'Generated planning prompt for creating task {{task_id}}'
    }
  }
};

async function ensureJson(fileAccess: FileAccess, relativePath: string, data: Record<string, unknown>, schema: string) {
  try {
    await fileAccess.readJson(relativePath);
    console.log(`✓ ${relativePath} already exists`);
  } catch {
    await fileAccess.writeJson(relativePath, data, { schema });
    console.log(`Created ${relativePath}`);
  }
}

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const fileAccess = new FileAccess({
    rootDir,
    mode: 'read_write',
    logToFilePath: path.join(rootDir, 'logs', 'file_access.log')
  });

  await ensureJson(fileAccess, 'ai/templates/prompt_template.json', MASTER_PROMPT_SEED, 'schemas/prompt_template.json');
  await ensureJson(
    fileAccess,
    'ai/templates/prompt_blueprints/task_creation.json',
    TASK_CREATION_SEED,
    'schemas/prompt_blueprint.json'
  );

  console.log('Feature workflow assets verified.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
