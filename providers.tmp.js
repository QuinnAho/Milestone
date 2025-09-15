import path from 'path';
import fs from 'fs-extra';
import { sh, shStream } from './shell.js';
import { readJson } from './fsutil.js';
import { changedFiles, revertPaths, isGitRepo } from './git.js';
import { readWhitelist, isAllowedEdit } from './tasks.js';
import { startProcess } from './proc.js';

function nowStamp() { return new Date().toISOString().replace(/[:]/g,'-'); }

export async function runProviderCLI(repoPath, { taskIdPath, provider, prompt, dry }) {
  const taskKey = (taskIdPath||'').split('/')[0];
  const artifactsDir = path.join(repoPath, 'artifacts', taskKey || 'NO-TASK', nowStamp());
  await fs.ensureDir(artifactsDir);

  const whitelist = await readWhitelist(repoPath, taskIdPath);
  const isGit = await isGitRepo(repoPath);

  const providersCfg = await readJson(path.join(repoPath, 'ai', 'config', 'providers.json'), { default: 'claude', providers: []});
  const chosen = provider || providersCfg.default;
  // Simple command template; projects can customize later
  const cmd = chosen === 'openai' ? `echo "${prompt?.replace(/"/g,'\"')}"` : `echo "${prompt?.replace(/"/g,'\"')}"`;

  let blocked = [];
  let changed = [];

  const before = isGit ? await changedFiles(repoPath) : [];
  const res = await sh(cmd, { cwd: repoPath, timeout: 10*60_000 });
  await fs.writeFile(path.join(artifactsDir, 'run.log'), `${res.stdout || ''}\n${res.stderr || ''}`);

  if (isGit && !dry) {
    const after = await changedFiles(repoPath);
    changed = after.filter(f => !before.includes(f));
    const disallowed = changed.filter(f => !isAllowedEdit(f, whitelist));
    if (disallowed.length) {
      await revertPaths(repoPath, disallowed);
      blocked = disallowed;
    }
  }

  return { ok: res.ok, provider: chosen, artifactsDir: path.relative(repoPath, artifactsDir), changed, blocked };
}

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function simulateStreaming({ provider, onOutput, steps, delayMs = 1000 }) {
  let log = '';
  for (const line of steps) {
    const text = String(line);
    const data = text.endsWith('\n') ? text : text + '\n';
    log += data;
    if (onOutput) {
      onOutput({ type: 'stdout', data, timestamp: new Date().toISOString() });
    }
    // Small delay between steps
    // eslint-disable-next-line no-await-in-loop
    await delay(delayMs);
  }
  return { ok: true, stdout: log, stderr: '' };
}

export async function runProviderCLIStreaming(repoPath, { taskIdPath, provider, prompt, dry, onOutput }) {
  const taskKey = (taskIdPath||'').split('/')[0];
  const artifactsDir = path.join(repoPath, 'artifacts', taskKey || 'NO-TASK', nowStamp());
  await fs.ensureDir(artifactsDir);

  const whitelist = await readWhitelist(repoPath, taskIdPath);
  const isGit = await isGitRepo(repoPath);

  const providersCfg = await readJson(path.join(repoPath, 'ai', 'config', 'providers.json'), { default: 'claude', providers: []});
  const chosen = provider || providersCfg.default;

  // For demo purposes, simulate AI output with Node timers.
  // Real implementation would call actual AI providers/CLIs.
  const simulateAI = chosen === 'claude' || chosen === 'openai' || chosen === 'codex';
  const simulationSteps = chosen === 'codex'
    ? [
        'Initializing Codex...',
        'Processing request...',
        'Generating code...',
        'Codex analysis complete.'
      ]
    : chosen === 'claude'
    ? [
        'Starting Claude analysis...',
        'Analyzing codebase...',
        'Generating suggestions...',
        'Claude analysis complete.'
      ]
    : [
        'Starting OpenAI analysis...',
        'Processing with GPT...',
        'Generating response...',
        'OpenAI analysis complete.'
      ];
  const cmd = `echo "${prompt?.replace(/"/g,'\"')}"`;

  let blocked = [];
  let changed = [];
  let logContent = '';

  const before = isGit ? await changedFiles(repoPath) : [];

  const res = simulateAI
    ? await simulateStreaming({ provider: chosen, onOutput, steps: simulationSteps, delayMs: 1000 }).then((r) => {
        logContent += r.stdout;
        return r;
      })
    : await shStream(cmd, {
        cwd: repoPath,
        timeout: 10*60_000,
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
    const disallowed = changed.filter(f => !isAllowedEdit(f, whitelist));
    if (disallowed.length) {
      await revertPaths(repoPath, disallowed);
      blocked = disallowed;
    }
  }

  return { ok: res.ok, provider: chosen, artifactsDir: path.relative(repoPath, artifactsDir), changed, blocked };
}

export async function runProviderCLIInteractive(repoPath, { taskIdPath, provider, prompt, env, onOutput }) {
  const providersCfg = await readJson(path.join(repoPath, 'ai', 'config', 'providers.json'), { default: 'claude', providers: []});
  const chosen = provider || providersCfg.default;
  const entry = (providersCfg.providers || []).find((p) => p.name === chosen) || { name: chosen, cli: chosen };

  const basePrompt = prompt || 'Read the task from the ai/tasks folder and start or continue the implementation using strong software engineering principles. Update necessary files and documentation after completion.';

  // Spawn provider CLI in repo root and feed initial prompt via stdin
  const command = entry.cli || chosen;

  const { session } = await startProcess({
    command,
    cwd: repoPath,
    env,
    onOutput,
    onStarted: async (child) => {
      // Send initial prompt and an extra newline to ensure submission
      child.stdin?.write(basePrompt + '\n');
    }
  });

  return { ok: true, session, provider: chosen };
}
