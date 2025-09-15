import fs from 'fs-extra';
import path from 'path';
import { bootstrapAiTree } from '../server/lib/aiRepo.js';
import { computeStatus } from '../server/lib/status.js';
import { createTask, switchTask } from '../server/lib/tasks.js';
import { runPrompt } from '../server/lib/run.js';
import { runQa } from '../server/lib/qa.js';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.replace(/^--/, '');
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      args[key] = val;
    } else if (!args._) {
      args._ = [a];
    } else {
      args._.push(a);
    }
  }
  args._ = args._ || [];
  return args;
}

export async function runCli(argv) {
  const args = parseArgs(argv);
  const [cmd, subcmd] = args._;

  if (cmd === 'init') {
    const repoPath = args.path || args._[1];
    if (!repoPath) throw new Error('Usage: aidash init <path>');
    await bootstrapAiTree(repoPath);
    console.log('Initialized ai/ tree at', repoPath);
    return;
  }

  if (cmd === 'status') {
    const repoPath = args.path;
    if (!repoPath) throw new Error('Usage: aidash status --path <repo>');
    const st = await computeStatus(repoPath);
    console.log(JSON.stringify(st, null, 2));
    return;
  }

  if (cmd === 'task' && subcmd === 'new') {
    const repoPath = args.path;
    const id = args.id;
    const title = args.title || '';
    const priority = args.priority || 'medium';
    const deps = args.deps ? String(args.deps).split(',') : [];
    if (!repoPath || !id || !title) throw new Error('Usage: aidash task new --path <repo> --id FEAT-0001 --title "..."');
    const t = await createTask(repoPath, { id, title, priority, deps });
    console.log('Created task', t.id);
    return;
  }

  if (cmd === 'task' && subcmd === 'switch') {
    const repoPath = args.path;
    const idPath = args.idPath;
    if (!repoPath || !idPath) throw new Error('Usage: aidash task switch --path <repo> --idPath FEAT-0001/PR1');
    await switchTask(repoPath, idPath);
    console.log('Switched CURRENT to', idPath);
    return;
  }

  if (cmd === 'run') {
    const repoPath = args.path;
    const task = args.task || args.taskIdPath;
    const provider = args.provider || 'claude';
    const dry = !!args.dry;
    const prompt = args.prompt || args._.slice(1).join(' ');
    if (!repoPath || !task || !prompt) throw new Error('Usage: aidash run --path <repo> --task FEAT-0001/PR1 --provider claude --dry --prompt "..."');
    const result = await runPrompt({ repoPath, taskIdPath: task, provider, prompt, dry });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === 'qa') {
    const repoPath = args.path;
    if (!repoPath) throw new Error('Usage: aidash qa --path <repo> --all or --scripts build,test');
    const scripts = args.all ? ['build', 'test', 'lint'] : (args.scripts ? String(args.scripts).split(',') : ['build', 'test', 'lint']);
    const results = await runQa(repoPath, scripts);
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  console.log(`aidash commands:
  init <path>
  status --path <repo>
  task new --path <repo> --id FEAT-0001 --title "..."
  task switch --path <repo> --idPath FEAT-0001/PR1
  run --path <repo> --task FEAT-0001/PR1 --provider claude --dry --prompt "..."
  qa --path <repo> --all`);
}

