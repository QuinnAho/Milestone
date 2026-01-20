#!/usr/bin/env node
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { FileAccess } from '../src/fs/fileAccess';
import { generateStructuredPrompt } from '../src/prompts/structuredPromptGenerator';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const {
    values: { blueprint, vars, out, task, dryRun, set }
  } = parseArgs({
    options: {
      blueprint: { type: 'string', short: 'b' },
      vars: { type: 'string', short: 'v' },
      out: { type: 'string', short: 'o' },
      task: { type: 'string', short: 't' },
      dryRun: { type: 'boolean', short: 'd', default: false },
      set: { type: 'string', multiple: true }
    },
    allowPositionals: false
  });

  if (!blueprint) {
    console.error('Missing --blueprint argument (e.g., structured_checklist)');
    process.exit(1);
  }

  const rootDir = path.resolve(__dirname, '..');
  const fileAccess = new FileAccess({
    rootDir,
    mode: 'read_write',
    logToFilePath: path.join(rootDir, 'logs', 'file_access.log')
  });

  const variables = loadVariables(vars, set);
  const persist = !dryRun;
  const { prompt, outputPath } = await generateStructuredPrompt(fileAccess, {
    blueprintId: blueprint,
    variables,
    outputPath: out,
    persist,
    taskId: task ?? undefined
  });

  if (dryRun) {
    console.log(JSON.stringify(prompt, null, 2));
  } else if (outputPath) {
    console.log(`Prompt stored at ${outputPath}`);
  }
}

function loadVariables(varsPath?: string, inline?: string[]) {
  const variables: Record<string, string> = {};
  if (varsPath) {
    const resolved = path.resolve(process.cwd(), varsPath);
    const data = JSON.parse(readFileSync(resolved, 'utf8'));
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        variables[key] = String(value);
      }
    });
  }

  inline?.forEach((entry) => {
    const [key, ...rest] = entry.split('=');
    if (!key || rest.length === 0) {
      throw new Error(`Invalid --set entry "${entry}". Use key=value.`);
    }
    variables[key] = rest.join('=');
  });

  return variables;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
