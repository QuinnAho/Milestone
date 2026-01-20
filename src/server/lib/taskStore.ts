import path from 'node:path';
import { FileAccess } from '../../fs/fileAccess';
import { FileAccessError } from '../../fs/types';
import { getTaskMilestoneMap, syncMilestoneProgress } from './milestoneStore';

const TASK_JSON_PATTERN = /^ai\/tasks\/(TASK_[A-Za-z0-9_\-]+)\/task\.json$/;
const TASK_PREFIX = 'ai/tasks';
const TEMPLATE_DIR = 'ai/tasks/templates';
const ORDER_PATH = 'ai/tasks/order.json';
const TASK_NUMBER_PATTERN = /^TASK_(\d+)/;

export interface TaskDetail {
  task: Record<string, unknown>;
  checklist: string;
  progress: Record<string, unknown>[];
}

export async function listTasks(fileAccess: FileAccess) {
  const files = await fileAccess.list(TASK_PREFIX);
  const summaries = new Map<string, Record<string, unknown>>();
  const discoveredIds: string[] = [];
  const milestoneMap = await getTaskMilestoneMap(fileAccess);
  for (const filePath of files) {
    if (filePath.includes('templates/')) {
      continue;
    }
    const match = filePath.match(TASK_JSON_PATTERN);
    if (match) {
      const taskId = match[1];
      if (summaries.has(taskId)) {
        continue;
      }
      const data = await fileAccess.readJson<Record<string, unknown>>(filePath);
      const checklistComplete = await isChecklistComplete(fileAccess, taskId);
      const milestoneId = milestoneMap[taskId];
      summaries.set(taskId, {
        ...data,
        checklist_complete: checklistComplete,
        milestone_id: milestoneId
      });
      discoveredIds.push(taskId);
    }
  }
  const orderedIds = await syncTaskOrder(fileAccess, discoveredIds);
  const orderedTasks: Record<string, unknown>[] = [];
  orderedIds.forEach((taskId) => {
    const summary = summaries.get(taskId);
    if (summary) {
      orderedTasks.push(summary);
    }
  });
  summaries.forEach((summary, taskId) => {
    if (!orderedIds.includes(taskId)) {
      orderedTasks.push(summary);
    }
  });
  return orderedTasks;
}

export async function getTaskDetail(fileAccess: FileAccess, taskId: string): Promise<TaskDetail> {
  const base = path.posix.join(TASK_PREFIX, taskId);
  const task = await fileAccess.readJson<Record<string, unknown>>(`${base}/task.json`);
  const checklist = await fileAccess.readText(`${base}/checklist.md`);
  const progressRaw = await fileAccess.readText(`${base}/progress.ndjson`);
  const progress = parseNdjson(progressRaw);
  return { task, checklist, progress };
}

export async function createTaskFromTemplate(
  fileAccess: FileAccess,
  taskId: string,
  overrides: Partial<Record<string, unknown>>
) {
  const files = await fileAccess.list(TEMPLATE_DIR);
  const targetDir = path.posix.join(TASK_PREFIX, taskId);
  for (const templatePath of files) {
    const relative = path.posix.relative(TEMPLATE_DIR, templatePath);
    const destination = path.posix.join(targetDir, relative);
    const contents = await fileAccess.readText(templatePath);
    const populated = contents.replace(/{{TASK_ID}}/g, taskId);
    await fileAccess.writeText(destination, populated);
  }
  const taskPath = `${targetDir}/task.json`;
  const task = await fileAccess.readJson<Record<string, unknown>>(taskPath);
  const updated = { ...task, ...overrides };
  await fileAccess.writeJson(taskPath, updated, { schema: 'schemas/task.json' });
  await appendTaskOrder(fileAccess, taskId);
  return updated;
}

export function parseNdjson(raw: string): Record<string, unknown>[] {
  return raw
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });
}

export async function toggleChecklistLine(fileAccess: FileAccess, taskId: string, lineIndex: number, checked: boolean) {
  const checklistPath = `${TASK_PREFIX}/${taskId}/checklist.md`;
  const contents = await fileAccess.readText(checklistPath);
  const lines = contents.split(/\r?\n/);
  if (lineIndex < 0 || lineIndex >= lines.length) {
    throw new FileAccessError('Checklist line index out of range', 'IO_ERROR', {
      relativePath: checklistPath,
      absolutePath: fileAccess.resolve(checklistPath),
      mode: fileAccess.getMode()
    });
  }
  const line = lines[lineIndex];
  const updatedLine = line.replace(/\[(x| )\]/i, checked ? '[x]' : '[ ]');
  lines[lineIndex] = updatedLine;
  await fileAccess.writeText(checklistPath, `${lines.join('\n')}\n`);
  await syncMilestoneProgress(fileAccess, taskId);
  return updatedLine;
}

export async function appendProgressEntry(
  fileAccess: FileAccess,
  taskId: string,
  entry: Record<string, unknown>
) {
  const logPath = `${TASK_PREFIX}/${taskId}/progress.ndjson`;
  await fileAccess.appendNdjson(logPath, entry, { schema: 'schemas/progress_event.json' });
}

export async function listTemplates(fileAccess: FileAccess) {
  const files = await fileAccess.list(TEMPLATE_DIR);
  return files.filter((file) => file.endsWith('task.json')).map((file) => path.posix.basename(path.posix.dirname(file)));
}

export async function reorderTaskList(fileAccess: FileAccess, desiredOrder: string[]) {
  const validIds = await discoverTaskIds(fileAccess);
  const unique = new Set(desiredOrder);
  if (unique.size !== desiredOrder.length) {
    throw new FileAccessError('Order contains duplicate task ids', 'VALIDATION_FAILED', {
      relativePath: ORDER_PATH,
      absolutePath: fileAccess.resolve(ORDER_PATH),
      mode: fileAccess.getMode()
    });
  }
  const missing = validIds.filter((id) => !unique.has(id));
  if (missing.length > 0) {
    throw new FileAccessError(`Order missing task ids: ${missing.join(', ')}`, 'VALIDATION_FAILED', {
      relativePath: ORDER_PATH,
      absolutePath: fileAccess.resolve(ORDER_PATH),
      mode: fileAccess.getMode()
    });
  }
  await saveTaskOrder(fileAccess, desiredOrder);
}

export async function getNextTaskId(fileAccess: FileAccess): Promise<string> {
  let files: string[] = [];
  try {
    files = await fileAccess.list(TASK_PREFIX);
  } catch {
    return formatTaskId(1);
  }
  let maxNumber = 0;
  for (const filePath of files) {
    if (filePath.includes('templates/')) {
      continue;
    }
    const match = filePath.match(TASK_JSON_PATTERN);
    if (match) {
      const taskId = match[1];
      const numberMatch = taskId.match(TASK_NUMBER_PATTERN);
      if (numberMatch) {
        const value = Number.parseInt(numberMatch[1], 10);
        if (!Number.isNaN(value)) {
          maxNumber = Math.max(maxNumber, value);
        }
      }
    }
  }
  return formatTaskId(maxNumber + 1);
}

function formatTaskId(value: number) {
  return `TASK_${value.toString().padStart(3, '0')}`;
}

async function discoverTaskIds(fileAccess: FileAccess): Promise<string[]> {
  const files = await fileAccess.list(TASK_PREFIX);
  const ids = new Set<string>();
  for (const filePath of files) {
    if (filePath.includes('templates/')) {
      continue;
    }
    const match = filePath.match(TASK_JSON_PATTERN);
    if (match) {
      ids.add(match[1]);
    }
  }
  return Array.from(ids);
}

async function isChecklistComplete(fileAccess: FileAccess, taskId: string) {
  try {
    const checklistPath = `${TASK_PREFIX}/${taskId}/checklist.md`;
    const contents = await fileAccess.readText(checklistPath);
    const actionable = contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- ['));
    if (actionable.length === 0) {
      return false;
    }
    return actionable.every((line) => /\[[xX]\]/.test(line));
  } catch {
    return false;
  }
}

async function loadTaskOrder(fileAccess: FileAccess): Promise<string[]> {
  try {
    const order = await fileAccess.readJson<string[]>(ORDER_PATH);
    if (Array.isArray(order)) {
      return order.filter((item) => typeof item === 'string');
    }
    return [];
  } catch {
    return [];
  }
}

async function saveTaskOrder(fileAccess: FileAccess, order: string[]) {
  await fileAccess.writeJson(ORDER_PATH, order, { pretty: true });
}

async function syncTaskOrder(fileAccess: FileAccess, taskIds: string[]): Promise<string[]> {
  const existing = new Set(taskIds);
  let order = await loadTaskOrder(fileAccess);
  let changed = false;
  order = order.filter((taskId) => {
    const keep = existing.has(taskId);
    if (!keep) {
      changed = true;
    }
    return keep;
  });
  taskIds.forEach((taskId) => {
    if (!order.includes(taskId)) {
      order.push(taskId);
      changed = true;
    }
  });
  if (changed) {
    await saveTaskOrder(fileAccess, order);
  }
  return order;
}

async function appendTaskOrder(fileAccess: FileAccess, taskId: string) {
  const order = await loadTaskOrder(fileAccess);
  if (!order.includes(taskId)) {
    order.push(taskId);
    await saveTaskOrder(fileAccess, order);
  }
}
