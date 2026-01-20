import path from 'node:path';
import { FileAccess } from '../../fs/fileAccess';
import { FileAccessError } from '../../fs/types';

const MILESTONE_DIR = 'ai/milestones';
const MILESTONE_INDEX_PATH = path.posix.join(MILESTONE_DIR, 'milestone_index.json');
const MILESTONE_PATTERN = /^ai\/milestones\/(MILESTONE_[A-Za-z0-9_\-]+)\/milestone\.json$/;
const MILESTONE_ID_PATTERN = /^MILESTONE_(\d+)$/;

export type MilestoneTaskEntry = {
  task_id: string;
  blocking?: boolean;
  qa_required?: boolean;
  status_override?: string;
  contract_refs?: string[];
  notes?: string;
};

export interface MilestoneRecord extends Record<string, unknown> {
  milestone_id: string;
  title: string;
  description: string;
  created: string;
  updated?: string;
  status: string;
  priority?: string;
  owner?: string;
  links?: Record<string, unknown>;
  tasks: MilestoneTaskEntry[];
  qa_review: Record<string, unknown>;
  qa_scope?: string[];
  acceptance_criteria?: string[];
  notes?: string[];
}

export interface MilestoneIndexEntry {
  milestone_id: string;
  title?: string;
  status: string;
  qa_status?: string;
  qa_required?: boolean;
  task_ids: string[];
  notes?: string;
}

export interface MilestoneIndexFile {
  version?: number;
  last_updated?: string;
  milestones: MilestoneIndexEntry[];
  unassigned_tasks?: string[];
}

export interface MilestoneCollection {
  milestones: MilestoneRecord[];
  unassigned_tasks: string[];
  last_updated?: string;
}

export interface MilestoneCreateInput {
  title: string;
  description: string;
  tasks: string[];
  priority?: string;
  qa_scope?: string[];
  acceptance_criteria?: string[];
  notes?: string[];
  links?: Record<string, unknown>;
}

export interface MilestoneUpdateInput {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  tasks?: MilestoneTaskEntry[];
  qa_scope?: string[];
  acceptance_criteria?: string[];
  notes?: string[];
  links?: Record<string, unknown>;
  qa_review?: Record<string, unknown>;
}

function createDefaultIndex(): MilestoneIndexFile {
  return {
    version: 1,
    last_updated: new Date().toISOString(),
    milestones: [],
    unassigned_tasks: []
  };
}

export async function listMilestones(fileAccess: FileAccess): Promise<MilestoneCollection> {
  const index = await loadMilestoneIndex(fileAccess);
  const milestones: MilestoneRecord[] = [];
  for (const entry of index.milestones) {
    try {
      const milestone = await readMilestoneFile(fileAccess, entry.milestone_id);
      milestones.push(milestone);
    } catch (error) {
      if (error instanceof FileAccessError && error.code === 'IO_ERROR') {
        continue;
      }
      throw error;
    }
  }
  return {
    milestones,
    unassigned_tasks: index.unassigned_tasks ?? [],
    last_updated: index.last_updated
  };
}

export async function getMilestoneDetail(fileAccess: FileAccess, milestoneId: string) {
  const milestone = await readMilestoneFile(fileAccess, milestoneId);
  const qaChecklist = await readChecklistSafe(fileAccess, milestoneId, milestone);
  const qaProgress = await readQaProgress(fileAccess, milestoneId, milestone);
  return {
    milestone,
    qa_checklist: qaChecklist,
    qa_progress: qaProgress
  };
}

export async function createMilestone(fileAccess: FileAccess, payload: MilestoneCreateInput) {
  if (!payload.tasks || payload.tasks.length === 0) {
    throw new FileAccessError('Milestone requires at least one task', 'VALIDATION_FAILED', {
      relativePath: MILESTONE_INDEX_PATH,
      absolutePath: fileAccess.resolve(MILESTONE_INDEX_PATH),
      mode: fileAccess.getMode()
    });
  }
  const milestoneId = await getNextMilestoneId(fileAccess);
  const baseDir = path.posix.join(MILESTONE_DIR, milestoneId);
  const checklistPath = path.posix.join(baseDir, 'qa_checklist.md');
  const logPath = path.posix.join(baseDir, 'qa_progress.ndjson');
  const now = new Date().toISOString();
  const tasks = payload.tasks.map((taskId) => ({
    task_id: taskId,
    blocking: true,
    qa_required: true
  }));
  const milestone: MilestoneRecord = {
    milestone_id: milestoneId,
    title: payload.title,
    description: payload.description,
    created: now,
    status: 'pending',
    priority: payload.priority ?? 'medium',
    tasks,
    qa_review: {
      status: 'not_started',
      checklist_path: checklistPath,
      log_path: logPath
    },
    qa_scope: payload.qa_scope ?? [],
    acceptance_criteria: payload.acceptance_criteria ?? [],
    notes: payload.notes ?? [],
    links: payload.links
  };
  await fileAccess.writeJson(path.posix.join(baseDir, 'milestone.json'), milestone, {
    schema: 'schemas/milestone.json'
  });
  await seedChecklist(fileAccess, milestoneId, payload.title, checklistPath);
  await seedQaLog(fileAccess, milestoneId, logPath);
  await upsertIndexEntry(fileAccess, {
    milestone_id: milestoneId,
    title: payload.title,
    status: milestone.status,
    qa_status: 'not_started',
    qa_required: true,
    task_ids: payload.tasks
  });
  return milestone;
}

export async function updateMilestone(fileAccess: FileAccess, milestoneId: string, patch: MilestoneUpdateInput) {
  const filePath = path.posix.join(MILESTONE_DIR, milestoneId, 'milestone.json');
  const existing = await fileAccess.readJson<MilestoneRecord>(filePath);
  const nextTasks = patch.tasks ?? existing.tasks;
  const updated: MilestoneRecord = {
    ...existing,
    ...patch,
    tasks: nextTasks,
    qa_review: patch.qa_review ? { ...existing.qa_review, ...patch.qa_review } : existing.qa_review,
    qa_scope: patch.qa_scope ?? existing.qa_scope,
    acceptance_criteria: patch.acceptance_criteria ?? existing.acceptance_criteria,
    notes: patch.notes ?? existing.notes,
    updated: new Date().toISOString()
  };
  await fileAccess.writeJson(filePath, updated, { schema: 'schemas/milestone.json' });
  await upsertIndexEntry(fileAccess, {
    milestone_id: milestoneId,
    title: updated.title,
    status: updated.status,
    qa_status: String(updated.qa_review?.status ?? 'not_started'),
    qa_required: Boolean(updated.tasks?.some((task) => task.qa_required !== false)),
    task_ids: (updated.tasks ?? []).map((task) => task.task_id)
  });
  return updated;
}

export async function appendMilestoneLog(
  fileAccess: FileAccess,
  milestoneId: string,
  entry: Record<string, unknown>
) {
  const milestone = await readMilestoneFile(fileAccess, milestoneId);
  const logPath = String(milestone.qa_review?.log_path ?? '');
  if (!logPath) {
    throw new FileAccessError('Milestone missing qa_review.log_path', 'VALIDATION_FAILED', {
      relativePath: path.posix.join(MILESTONE_DIR, milestoneId, 'milestone.json'),
      absolutePath: fileAccess.resolve(path.posix.join(MILESTONE_DIR, milestoneId, 'milestone.json')),
      mode: fileAccess.getMode()
    });
  }
  await fileAccess.appendNdjson(
    logPath,
    {
      ...entry,
      milestone_id: milestoneId
    },
    { schema: 'schemas/progress_event.json' }
  );
}

export async function getNextMilestoneId(fileAccess: FileAccess) {
  let files: string[] = [];
  try {
    files = await fileAccess.list(MILESTONE_DIR);
  } catch {
    return formatMilestoneId(1);
  }
  let max = 0;
  for (const file of files) {
    const match = file.match(MILESTONE_PATTERN);
    if (match) {
      const id = match[1];
      const numberMatch = id.match(MILESTONE_ID_PATTERN);
      if (numberMatch) {
        const value = Number.parseInt(numberMatch[1], 10);
        if (!Number.isNaN(value)) {
          max = Math.max(max, value);
        }
      }
    }
  }
  return formatMilestoneId(max + 1);
}

export async function getTaskMilestoneMap(fileAccess: FileAccess): Promise<Record<string, string>> {
  const index = await loadMilestoneIndex(fileAccess);
  const mapping: Record<string, string> = {};
  index.milestones.forEach((entry) => {
    entry.task_ids.forEach((taskId) => {
      mapping[taskId] = entry.milestone_id;
    });
  });
  return mapping;
}

export async function syncMilestoneProgress(fileAccess: FileAccess, taskId: string) {
  const milestoneMap = await getTaskMilestoneMap(fileAccess);
  const milestoneId = milestoneMap[taskId];
  if (!milestoneId) {
    return;
  }
  const milestone = await readMilestoneFile(fileAccess, milestoneId);
  const blockingTasks = (milestone.tasks ?? []).filter((task) => task.blocking !== false);
  if (blockingTasks.length === 0) {
    return;
  }
  const completionStates = await Promise.all(
    blockingTasks.map((task) => isTaskChecklistCompleteForMilestone(fileAccess, task.task_id))
  );
  const allComplete = completionStates.every(Boolean);
  const anyComplete = completionStates.some(Boolean);
  const lockedStatuses = new Set(['qa_in_progress', 'completed']);
  const currentStatus = String(milestone.status ?? 'pending');
  let targetStatus = currentStatus;
  let logDetails: string | null = null;

  if (allComplete) {
    if (!lockedStatuses.has(currentStatus) && currentStatus !== 'qa_pending') {
      targetStatus = 'qa_pending';
      logDetails = `All blocking tasks completed; milestone ${milestoneId} requires QA review.`;
    }
  } else {
    const fallbackStatus = anyComplete ? 'active' : 'pending';
    if (!lockedStatuses.has(currentStatus) && currentStatus !== fallbackStatus) {
      targetStatus = fallbackStatus;
      logDetails =
        fallbackStatus === 'active'
          ? `Milestone ${milestoneId} moved to active after ${taskId} progress.`
          : `Milestone ${milestoneId} reset to pending because a blocking task reopened.`;
    }
  }

  if (targetStatus === currentStatus || lockedStatuses.has(currentStatus)) {
    return;
  }

  const patch: MilestoneUpdateInput = { status: targetStatus };
  if (targetStatus === 'qa_pending') {
    patch.qa_review = { status: 'not_started' };
  }
  await updateMilestone(fileAccess, milestoneId, patch);
  await appendMilestoneLog(fileAccess, milestoneId, {
    ts: new Date().toISOString(),
    event: 'milestone_status_changed',
    status: targetStatus,
    agent: 'system',
    details: logDetails ?? `Milestone ${milestoneId} status updated to ${targetStatus} after ${taskId} change.`
  });
}

async function seedChecklist(fileAccess: FileAccess, milestoneId: string, title: string, checklistPath: string) {
  const summaryBlock = `<!-- Machine Summary Block -->\n{"file":"${checklistPath}","purpose":"QA checklist for ${title} milestone."}\n\n# QA Checklist: ${title}\n\n- [ ] Review acceptance criteria for ${title}.\n- [ ] Confirm blocking tasks show checklist completion.\n- [ ] Run npm + schema validations and capture logs.\n- [ ] Append QA completion entry to qa_progress.ndjson.\n`;
  await fileAccess.writeText(checklistPath, summaryBlock);
}

async function seedQaLog(fileAccess: FileAccess, milestoneId: string, logPath: string) {
  const entry = {
    ts: new Date().toISOString(),
    milestone_id: milestoneId,
    event: 'qa_initialized',
    status: 'pending',
    agent: 'system',
    details: `Initialized QA log for ${milestoneId}`
  };
  await fileAccess.writeText(logPath, `${JSON.stringify(entry)}\n`);
}

async function readChecklistSafe(fileAccess: FileAccess, milestoneId: string, milestone: MilestoneRecord) {
  const checklistPath = String(milestone.qa_review?.checklist_path ?? '');
  if (!checklistPath) {
    return '';
  }
  try {
    return await fileAccess.readText(checklistPath);
  } catch (error) {
    if (error instanceof FileAccessError) {
      return '';
    }
    throw error;
  }
}

async function readQaProgress(fileAccess: FileAccess, milestoneId: string, milestone: MilestoneRecord) {
  const logPath = String(milestone.qa_review?.log_path ?? '');
  if (!logPath) {
    return [];
  }
  try {
    const raw = await fileAccess.readText(logPath);
    return parseNdjson(raw);
  } catch (error) {
    if (error instanceof FileAccessError) {
      return [];
    }
    throw error;
  }
}

async function readMilestoneFile(fileAccess: FileAccess, milestoneId: string): Promise<MilestoneRecord> {
  const filePath = path.posix.join(MILESTONE_DIR, milestoneId, 'milestone.json');
  return await fileAccess.readJson<MilestoneRecord>(filePath);
}

async function loadMilestoneIndex(fileAccess: FileAccess): Promise<MilestoneIndexFile> {
  try {
    return await fileAccess.readJson<MilestoneIndexFile>(MILESTONE_INDEX_PATH);
  } catch (error) {
    if (error instanceof FileAccessError) {
      return createDefaultIndex();
    }
    throw error;
  }
}

async function saveMilestoneIndex(fileAccess: FileAccess, index: MilestoneIndexFile) {
  const payload: MilestoneIndexFile = {
    ...index,
    version: index.version ?? 1,
    last_updated: new Date().toISOString(),
    milestones: index.milestones ?? [],
    unassigned_tasks: index.unassigned_tasks ?? []
  };
  await fileAccess.writeJson(MILESTONE_INDEX_PATH, payload, { schema: 'schemas/milestone_index.json' });
}

async function upsertIndexEntry(fileAccess: FileAccess, entry: MilestoneIndexEntry) {
  const index = await loadMilestoneIndex(fileAccess);
  const existing = index.milestones.find((item) => item.milestone_id === entry.milestone_id);
  const sanitizedTaskIds = Array.from(new Set(entry.task_ids));
  index.unassigned_tasks = (index.unassigned_tasks ?? []).filter((taskId) => !sanitizedTaskIds.includes(taskId));
  if (existing) {
    existing.title = entry.title ?? existing.title;
    existing.status = entry.status;
    existing.qa_status = entry.qa_status ?? existing.qa_status;
    existing.qa_required = entry.qa_required ?? existing.qa_required;
    existing.task_ids = sanitizedTaskIds;
  } else {
    index.milestones.push({
      milestone_id: entry.milestone_id,
      title: entry.title,
      status: entry.status,
      qa_status: entry.qa_status,
      qa_required: entry.qa_required,
      task_ids: sanitizedTaskIds
    });
  }
  await saveMilestoneIndex(fileAccess, index);
}

async function isTaskChecklistCompleteForMilestone(fileAccess: FileAccess, taskId: string) {
  try {
    const checklistPath = `ai/tasks/${taskId}/checklist.md`;
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

function parseNdjson(raw: string) {
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

function formatMilestoneId(value: number) {
  return `MILESTONE_${value.toString().padStart(3, '0')}`;
}
