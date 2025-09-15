import path from 'path';
import fs from 'fs-extra';
import { readJson } from './fsutil.js';
import { changedFiles, revertPaths, isGitRepo } from './git.js';
import { readWhitelist, isAllowedEdit } from './tasks.js';
import { runOnce } from './proc.js';
import { execa } from 'execa';

function nowStamp() { return new Date().toISOString().replace(/[:]/g,'-'); }

export async function runProviderStreamingReal(repoPath, { taskIdPath, provider, prompt, dry, env, onOutput }) {
  const taskKey = (taskIdPath||'').split('/')[0];
  const artifactsDir = path.join(repoPath, 'artifacts', taskKey || 'NO-TASK', nowStamp());
  await fs.ensureDir(artifactsDir);

  const whitelist = await readWhitelist(repoPath, taskIdPath);
  const isGit = await isGitRepo(repoPath);

  const providersCfg = await readJson(path.join(repoPath, 'ai', 'config', 'providers.json'), { default: 'claude', providers: []});
  const chosen = provider || providersCfg.default;
  const entry = (providersCfg.providers || []).find((p) => p.name === chosen) || { name: chosen, cli: chosen };
  const cmd = entry.cli || chosen;

  let blocked = [];
  let changed = [];
  let logContent = '';

  const before = isGit ? await changedFiles(repoPath) : [];

  const initialPrompt = (prompt && prompt.trim().length)
    ? prompt
    : 'Read the task from the ai/tasks folder and start or continue the implementation using strong software engineering principles. Update necessary files and documentation after completion.';

  const res = await runOnce({
    command: cmd,
    cwd: repoPath,
    env,
    input: initialPrompt + '\n',
    onOutput: (output) => {
      logContent += output.data;
      if (onOutput) {
        onOutput({
          type: output.type,
          data: output.data,
          timestamp: new Date().toISOString()
        });
      }
    }
  });

  await fs.writeFile(path.join(artifactsDir, 'run.log'), logContent);

  if (isGit && !dry) {
    const after = await changedFiles(repoPath);
    changed = after.filter(f => !before.includes(f));

    // Only revert files if whitelist has specific entries
    // If whitelist is empty (default), allow all changes
    if (whitelist && whitelist.length > 0) {
      const disallowed = changed.filter(f => !isAllowedEdit(f, whitelist));
      if (disallowed.length) {
        await revertPaths(repoPath, disallowed);
        blocked = disallowed;
      }
    }
    // If whitelist is empty or doesn't exist, allow all changes (don't revert anything)
  }

  return { ok: res.ok, provider: chosen, artifactsDir: path.relative(repoPath, artifactsDir), changed, blocked };
}

export async function runProviderExternal(repoPath, { taskIdPath, provider, prompt }) {
  const providersCfg = await readJson(path.join(repoPath, 'ai', 'config', 'providers.json'), { default: 'claude', providers: []});
  const chosen = provider || providersCfg.default;
  const entry = (providersCfg.providers || []).find((p) => p.name === chosen) || { name: chosen, cli: chosen };
  const cli = entry.cli || chosen;

  const safePrompt = (prompt && prompt.trim().length)
    ? prompt
    : 'Read the task from the ai/tasks folder and start or continue the implementation using strong software engineering principles. Update necessary files and documentation after completion.';

  // Write prompt to a temp file under artifacts
  const taskKey = (taskIdPath||'').split('/')[0] || 'NO-TASK';
  const artifactsDir = path.join(repoPath, 'artifacts', taskKey, nowStamp());
  await fs.ensureDir(artifactsDir);
  const promptFile = path.join(artifactsDir, 'prompt.txt');
  await fs.writeFile(promptFile, safePrompt, 'utf8');

  // Launch external PowerShell window piping prompt to the CLI
  const psCmd = `cd '${repoPath}'; $p = Get-Content -Raw '${promptFile}'; $p | ${cli}`;
  const cmd = `start "AI Implementation - ${chosen}" powershell.exe -NoLogo -NoProfile -NoExit -Command "${psCmd.replace(/"/g, '\\"')}"`;
  // Use cmd.exe start via shell to ensure a new window
  await execa(cmd, { cwd: repoPath, shell: true, windowsHide: false, detached: true });

  return { ok: true, provider: chosen, artifactsDir: path.relative(repoPath, artifactsDir) };
}

export async function runProviderCLIInteractive(repoPath, { taskIdPath, provider, prompt, env, onOutput }) {
  const providersCfg = await readJson(path.join(repoPath, 'ai', 'config', 'providers.json'), { default: 'claude', providers: []});
  const chosen = provider || providersCfg.default;
  const entry = (providersCfg.providers || []).find((p) => p.name === chosen) || { name: chosen, cli: chosen };

  const basePrompt = prompt || 'Read the task from the ai/tasks folder and start or continue the implementation using strong software engineering principles. Update necessary files and documentation after completion.';

  const { startProcess } = await import('./proc.js');
  const { session } = await startProcess({
    command: entry.cli || chosen,
    cwd: repoPath,
    env,
    onOutput,
    onStarted: async (child) => {
      child.stdin?.write(basePrompt + '\n');
    }
  });

  return { ok: true, session, provider: chosen };
}
