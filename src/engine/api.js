import path from 'path';
import { initRepo as _initRepo, listTasks, setCurrent, getCurrent } from './repo.js';
import { createTask as _createTask, switchTask as _switchTask } from './tasks.js';
import { computeStatus } from './status.js';
import { runProviderCLIInteractive } from './providers_real.js';
import { runProviderStreamingReal, runProviderExternal } from './providers_real.js';
import { writeProcess, killProcess } from './proc.js';
import { runQA as _runQA } from './qa.js';
import { computeProgressSnapshot, appendEvent } from './events.js';

export async function initRepo(repoPath) { return _initRepo(repoPath); }
export async function createTask(repoPath, payload) { const r = await _createTask(repoPath, payload); await computeProgressSnapshot(repoPath); return r; }
export async function switchTask(repoPath, idPath) { await _switchTask(repoPath, idPath); return { ok: true }; }
export async function changeTaskStatus(repoPath, taskId, status) {
  const validStatuses = ['Backlog', 'In Progress', 'Review', 'Done'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }
  await appendEvent(repoPath, taskId, { type: 'task.status', status, taskId });
  await computeProgressSnapshot(repoPath);
  return { ok: true, status };
}
export async function computeBoardState(repoPath) { return computeProgressSnapshot(repoPath); }
export async function computeProjectStatus(repoPath) { return computeStatus(repoPath); }
export async function runProviderStreaming(repoPath, payload, onOutput) { const r = await runProviderStreamingReal(repoPath, { ...payload, onOutput }); await computeProgressSnapshot(repoPath); return r; }
export async function runQA(repoPath, scripts) { return _runQA(repoPath, scripts); }
export async function startProviderInteractive(repoPath, payload, onOutput) { return runProviderCLIInteractive(repoPath, { ...payload, onOutput }); }
export async function procWrite(sessionId, data) { return writeProcess(sessionId, data); }
export async function procKill(sessionId) { return killProcess(sessionId); }
export async function startProviderExternal(repoPath, payload) { return runProviderExternal(repoPath, payload); }
