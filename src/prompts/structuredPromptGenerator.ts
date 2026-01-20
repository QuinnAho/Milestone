import path from 'node:path';
import { FileAccess } from '../fs/fileAccess';
import { appendProgressEntry } from '../server/lib/taskStore';
import { captureDiffSnapshot } from '../server/lib/gitDiff';

const BLUEPRINT_DIR = 'ai/templates/prompt_blueprints';
const CURRENT_INDEX_PATH = 'ai/tasks/current_index.json';

export interface BlueprintPlaceholder {
  name: string;
  description: string;
  example?: string;
  required?: boolean;
  default?: string;
}

export interface PromptBlueprint {
  blueprint_id: string;
  description: string;
  agent?: string;
  summary: {
    file: string;
    purpose: string;
  };
  placeholders?: BlueprintPlaceholder[];
  template: {
    id: string;
    description: string;
    body: string;
    tags?: string[];
    summary: {
      file: string;
      purpose: string;
    };
  };
}

export interface PromptTemplate {
  id: string;
  description: string;
  body: string;
  tags?: string[];
  summary: {
    file: string;
    purpose: string;
  };
}

export interface BlueprintSummary {
  blueprint_id: string;
  description: string;
  agent?: string;
  placeholders: BlueprintPlaceholder[];
}

export interface GenerationRequest {
  blueprintId: string;
  variables: Record<string, string>;
  outputPath?: string;
  persist?: boolean;
  taskId?: string;
  logEvent?: boolean;
}

export interface GenerationResult {
  prompt: PromptTemplate;
  blueprint: PromptBlueprint;
  outputPath?: string;
}

export async function listBlueprintSummaries(fileAccess: FileAccess): Promise<BlueprintSummary[]> {
  const files = await fileAccess.list(BLUEPRINT_DIR);
  const blueprints = files.filter((filePath) => filePath.endsWith('.json'));
  const summaries: BlueprintSummary[] = [];
  for (const filePath of blueprints) {
    const blueprint = await fileAccess.readJson<PromptBlueprint>(filePath);
    summaries.push({
      blueprint_id: blueprint.blueprint_id,
      description: blueprint.description,
      agent: blueprint.agent,
      placeholders: blueprint.placeholders ?? []
    });
  }
  return summaries.sort((a, b) => a.blueprint_id.localeCompare(b.blueprint_id));
}

export async function loadBlueprint(fileAccess: FileAccess, blueprintId: string): Promise<PromptBlueprint> {
  const blueprintPath = path.posix.join(BLUEPRINT_DIR, `${blueprintId}.json`);
  return fileAccess.readJson<PromptBlueprint>(blueprintPath);
}

export async function generateStructuredPrompt(
  fileAccess: FileAccess,
  request: GenerationRequest
): Promise<GenerationResult> {
  const blueprint = await loadBlueprint(fileAccess, request.blueprintId);
  const variables = resolveVariables(blueprint.placeholders ?? [], request.variables);
  const prompt = buildPrompt(blueprint, variables);
  const outputPath = request.outputPath ?? 'ai/templates/prompt_template.json';
  const shouldPersist = request.persist ?? true;
  const shouldLog = request.logEvent ?? true;

  if (shouldPersist) {
    await fileAccess.writeJson(outputPath, prompt, { schema: 'schemas/prompt_template.json' });
  }

  if (shouldLog) {
    const taskId = request.taskId ?? (await resolveActiveTaskId(fileAccess));
    if (taskId) {
      await logGeneration(fileAccess, taskId, {
        blueprintId: blueprint.blueprint_id,
        outputPath,
        persist: shouldPersist
      });
    }
  }

  return { prompt, blueprint, outputPath: shouldPersist ? outputPath : undefined };
}

export function buildPrompt(blueprint: PromptBlueprint, variables: Record<string, string>): PromptTemplate {
  const { template } = blueprint;
  const tags = template.tags?.map((value) => renderTemplate(value, variables));
  return {
    id: renderTemplate(template.id, variables),
    description: renderTemplate(template.description, variables),
    body: renderTemplate(template.body, variables),
    tags: tags && tags.length > 0 ? tags : undefined,
    summary: {
      file: renderTemplate(template.summary.file, variables),
      purpose: renderTemplate(template.summary.purpose, variables)
    }
  };
}

export function renderTemplate(value: string, variables: Record<string, string>): string {
  return value.replace(/\{\{(.*?)\}\}/g, (_match, key) => {
    const lookup = String(key).trim();
    if (Object.prototype.hasOwnProperty.call(variables, lookup)) {
      return variables[lookup] ?? '';
    }
    return '';
  });
}

function resolveVariables(placeholders: BlueprintPlaceholder[], provided: Record<string, string>) {
  const values: Record<string, string> = {};
  placeholders.forEach((placeholder) => {
    const key = placeholder.name;
    const supplied = provided[key];
    if (supplied === undefined || supplied === null || supplied === '') {
      if (placeholder.default !== undefined) {
        values[key] = placeholder.default;
      } else if (placeholder.required === false) {
        values[key] = '';
      } else {
        throw new Error(`Missing required placeholder "${key}"`);
      }
    } else {
      values[key] = supplied;
    }
  });
  Object.entries(provided).forEach(([key, value]) => {
    if (!(key in values) && value !== undefined && value !== null) {
      values[key] = String(value);
    }
  });
  return values;
}

async function resolveActiveTaskId(fileAccess: FileAccess): Promise<string | null> {
  try {
    const index = await fileAccess.readJson<{ active_task_id?: string }>(CURRENT_INDEX_PATH);
    return typeof index.active_task_id === 'string' ? index.active_task_id : null;
  } catch {
    return null;
  }
}

async function logGeneration(
  fileAccess: FileAccess,
  taskId: string,
  details: { blueprintId: string; outputPath: string; persist: boolean }
) {
  await appendProgressEntry(fileAccess, taskId, {
    ts: new Date().toISOString(),
    task_id: taskId,
    event: 'step_completed',
    status: 'success',
    agent: 'structured_prompt_generator',
    details: `Blueprint ${details.blueprintId} generated prompt${details.persist ? ` -> ${details.outputPath}` : ''}`,
    diff: captureDiffSnapshot()
  });
}
