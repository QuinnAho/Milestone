import path from 'path';
import fs from 'fs/promises';
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

export async function packMilestone(repoPath, payload) {
  const { name, description, tasks, provider } = payload;

  // Create milestones directory structure
  const milestonesDir = path.join(repoPath, 'ai', 'milestones');
  const milestoneDir = path.join(milestonesDir, name);

  try {
    await fs.mkdir(milestonesDir, { recursive: true });
    await fs.mkdir(milestoneDir, { recursive: true });
  } catch (error) {
    console.error('Error creating milestone directories:', error);
  }

  // Move task files to milestone directory
  const movedTasks = [];
  for (const task of tasks) {
    try {
      const taskDir = path.join(repoPath, 'ai', 'tasks', task.id);
      const milestoneTaskDir = path.join(milestoneDir, task.id);

      // Check if task directory exists
      try {
        await fs.access(taskDir);
        // Move the task directory
        await fs.rename(taskDir, milestoneTaskDir);
        movedTasks.push(task);
      } catch (accessError) {
        console.warn(`Task directory not found: ${task.id}, creating minimal record`);
        // Create a minimal task record if directory doesn't exist
        await fs.mkdir(milestoneTaskDir, { recursive: true });
        await fs.writeFile(
          path.join(milestoneTaskDir, 'task.json'),
          JSON.stringify(task, null, 2)
        );
        movedTasks.push(task);
      }
    } catch (error) {
      console.error(`Error moving task ${task.id}:`, error);
    }
  }

  // Generate documentation using AI
  const documentationPrompt = `Generate comprehensive documentation for this milestone pack:

Milestone Name: ${name}
${description ? `Milestone Context: ${description}` : ''}
Completed Tasks: ${movedTasks.length}

Tasks Details:
${movedTasks.map(task => `
- ID: ${task.id}
- Title: ${task.title}
- Description: ${task.description || 'No description provided'}
`).join('')}

${description ? `

Additional Context:
The milestone represents: ${description}

Please use this context to provide more detailed and accurate documentation that reflects the true purpose and scope of this milestone.` : ''}

Please create a comprehensive milestone summary that includes:
- Overview of what was accomplished${description ? ' (considering the milestone context provided)' : ''}
- Key features implemented and their significance
- Impact and benefits to the overall project
- Technical details and approaches used
- How the completed tasks work together to achieve the milestone goals
${description ? '- How the implemented features align with the milestone context' : ''}

Focus on creating documentation that helps future developers understand not just what was done, but why it was done and how it fits into the larger project vision.`;

  let documentationGenerated = false;
  try {
    const docResult = await runProviderStreamingReal(repoPath, {
      provider: provider || 'claude',
      prompt: documentationPrompt,
      dry: false,
      onOutput: null
    });

    // Save human-readable documentation
    const readmeContent = `# Milestone: ${name}

*Generated on ${new Date().toISOString()}*

## Overview
This milestone packages ${movedTasks.length} completed tasks that represent a significant development iteration.
${description ? `

### Milestone Context
${description}` : ''}

## Completed Tasks
${movedTasks.map(task => `
### ${task.id}: ${task.title}
${task.description || 'No description provided'}
`).join('')}

## AI-Generated Summary
${docResult.output || 'Documentation generation in progress...'}

---
*This milestone was automatically packed by the AI Task Dashboard*
`;

    await fs.writeFile(path.join(milestoneDir, 'README.md'), readmeContent);

    // Save machine-readable manifest
    const manifest = {
      name,
      description: description || null,
      createdAt: new Date().toISOString(),
      taskCount: movedTasks.length,
      tasks: movedTasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        completedAt: new Date().toISOString(),
        status: 'Done'
      })),
      generator: {
        tool: 'AI Task Dashboard',
        provider: provider || 'claude',
        version: '1.0.0'
      }
    };

    await fs.writeFile(
      path.join(milestoneDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    documentationGenerated = true;
  } catch (docError) {
    console.error('Error generating documentation:', docError);
  }

  // Mark tasks as packed (add milestone metadata to events)
  for (const task of movedTasks) {
    try {
      await appendEvent(repoPath, task.id, {
        type: 'task.packed',
        milestone: name,
        taskId: task.id,
        packedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error marking task ${task.id} as packed:`, error);
    }
  }

  // Refresh board state
  await computeProgressSnapshot(repoPath);

  return {
    success: true,
    milestone: name,
    tasksPackaged: movedTasks.length,
    documentationGenerated,
    milestoneDir
  };
}

export async function getAvailableMilestones(repoPath) {
  const milestonesDir = path.join(repoPath, 'ai', 'milestones');

  try {
    const entries = await fs.readdir(milestonesDir, { withFileTypes: true });
    const milestones = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort();

    return milestones;
  } catch (error) {
    // Directory doesn't exist or other error
    return [];
  }
}

export async function loadMilestone(repoPath, milestoneName) {
  const milestoneDir = path.join(repoPath, 'ai', 'milestones', milestoneName);
  const tasksDir = path.join(repoPath, 'ai', 'tasks');

  // Read milestone manifest
  let manifest;
  try {
    const manifestContent = await fs.readFile(path.join(milestoneDir, 'manifest.json'), 'utf8');
    manifest = JSON.parse(manifestContent);
  } catch (error) {
    throw new Error(`Could not read milestone manifest: ${error.message}`);
  }

  // Ensure tasks directory exists
  try {
    await fs.mkdir(tasksDir, { recursive: true });
  } catch (error) {
    console.error('Error creating tasks directory:', error);
  }

  // Move tasks back to main tasks directory
  const restoredTasks = [];
  for (const task of manifest.tasks) {
    try {
      const milestoneTaskDir = path.join(milestoneDir, task.id);
      const mainTaskDir = path.join(tasksDir, task.id);

      // Check if milestone task directory exists
      try {
        await fs.access(milestoneTaskDir);
        // Move back to main tasks
        await fs.rename(milestoneTaskDir, mainTaskDir);
        restoredTasks.push(task);
      } catch (accessError) {
        console.warn(`Milestone task directory not found: ${task.id}`);
      }
    } catch (error) {
      console.error(`Error restoring task ${task.id}:`, error);
    }
  }

  // Mark tasks as restored and set status to Done
  for (const task of restoredTasks) {
    try {
      await appendEvent(repoPath, task.id, {
        type: 'task.restored',
        milestone: milestoneName,
        taskId: task.id,
        restoredAt: new Date().toISOString()
      });
      await appendEvent(repoPath, task.id, {
        type: 'task.status',
        status: 'Done',
        taskId: task.id
      });
    } catch (error) {
      console.error(`Error marking task ${task.id} as restored:`, error);
    }
  }

  // Remove empty milestone directory if all tasks were restored
  try {
    const remainingEntries = await fs.readdir(milestoneDir);
    const remainingTaskDirs = remainingEntries.filter(entry =>
      entry !== 'README.md' && entry !== 'manifest.json'
    );

    if (remainingTaskDirs.length === 0) {
      // Only documentation files remain, milestone is now empty
      console.log(`Milestone ${milestoneName} is now empty after restoring all tasks`);
    }
  } catch (error) {
    console.error('Error checking milestone directory:', error);
  }

  // Refresh board state
  await computeProgressSnapshot(repoPath);

  return {
    success: true,
    milestone: milestoneName,
    tasksLoaded: restoredTasks.length
  };
}
