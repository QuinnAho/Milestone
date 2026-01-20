#!/usr/bin/env node
/**
 * Lightweight schema validation runner for AI Task Monitor artifacts.
 * Supports a limited subset of JSON Schema keywords used in this repository.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const schemaDir = path.join(repoRoot, 'schemas');
const machineSummarySchema = loadSchema('machine_summary.json');
const results = [];
let failureCount = 0;

function loadSchema(name) {
  const schemaPath = path.join(schemaDir, name);
  const contents = readFileSync(schemaPath, 'utf8');
  return JSON.parse(contents);
}

function validateAgainstSchema(schema, data, pointer = '#') {
  const errors = [];
  if (schema.type) {
    const typeOk =
      (schema.type === 'object' && typeof data === 'object' && data !== null && !Array.isArray(data)) ||
      (schema.type === 'array' && Array.isArray(data)) ||
      (schema.type === 'string' && typeof data === 'string') ||
      (schema.type === 'number' && typeof data === 'number') ||
      (schema.type === 'integer' && Number.isInteger(data)) ||
      (schema.type === 'boolean' && typeof data === 'boolean');
    if (!typeOk) {
      errors.push(`${pointer}: Expected type ${schema.type}`);
      return errors;
    }
  }

  if (schema.enum && !schema.enum.includes(data)) {
    errors.push(`${pointer}: Value "${data}" not in enum ${JSON.stringify(schema.enum)}`);
  }

  if (typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push(`${pointer}: String shorter than minLength ${schema.minLength}`);
    }
    if (schema.pattern) {
      const re = new RegExp(schema.pattern);
      if (!re.test(data)) {
        errors.push(`${pointer}: Value "${data}" does not match pattern ${schema.pattern}`);
      }
    }
  }

  if (Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      errors.push(`${pointer}: Array shorter than minItems ${schema.minItems}`);
    }
    if (schema.items) {
      data.forEach((item, idx) => {
        errors.push(...validateAgainstSchema(schema.items, item, `${pointer}/${idx}`));
      });
    }
  }

  if (schema.type === 'object' && typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const props = schema.properties || {};
    const required = schema.required || [];
    required.forEach((key) => {
      if (!(key in data)) {
        errors.push(`${pointer}: Missing required property "${key}"`);
      }
    });
    Object.entries(data).forEach(([key, value]) => {
      if (props[key]) {
        errors.push(...validateAgainstSchema(props[key], value, `${pointer}/${key}`));
      } else if (schema.additionalProperties === false) {
        errors.push(`${pointer}: Additional property "${key}" not allowed`);
      } else if (typeof schema.additionalProperties === 'object') {
        errors.push(...validateAgainstSchema(schema.additionalProperties, value, `${pointer}/${key}`));
      }
    });
  }

  return errors;
}

function validateJsonFile(filePath, schemaName) {
  const schema = loadSchema(schemaName);
  const data = JSON.parse(readFileSync(filePath, 'utf8'));
  const errors = validateAgainstSchema(schema, data, '#');
  reportResult(errors, `Schema ${schemaName} -> ${path.relative(repoRoot, filePath)}`);
}

function validateNdjsonFile(filePath, schemaName) {
  const schema = loadSchema(schemaName);
  const lines = readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  lines.forEach((line, idx) => {
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      reportResult([`Line ${idx + 1}: ${err.message}`], `${path.relative(repoRoot, filePath)} (parse)`);
      return;
    }
    const errors = validateAgainstSchema(schema, parsed, `#${idx + 1}`);
    reportResult(errors, `Schema ${schemaName} -> ${path.relative(repoRoot, filePath)} line ${idx + 1}`);
  });
}

function reportResult(errors, label) {
  if (errors.length === 0) {
    results.push({ label, ok: true });
  } else {
    failureCount += 1;
    results.push({ label, ok: false, errors });
  }
}

function walkDir(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  const ignore = new Set(['.git', 'node_modules', '.venv', '.idea', '.vs']);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignore.has(entry.name)) {
        files.push(...walkDir(fullPath));
      }
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function listFilesByExt(rootDir, ext) {
  if (!existsSync(rootDir)) {
    return [];
  }
  return walkDir(rootDir).filter((filePath) => path.extname(filePath).toLowerCase() === ext);
}

function validateMachineSummaryBlocks(markdownFiles) {
  markdownFiles.forEach((filePath) => {
    const rel = path.relative(repoRoot, filePath);
    const contents = readFileSync(filePath, 'utf8');
    const lines = contents.split(/\r?\n/);
    let idx = 0;
    while (idx < lines.length && lines[idx].trim().length === 0) {
      idx += 1;
    }
    const errors = [];
    if (idx >= lines.length || lines[idx].trim() !== '<!-- Machine Summary Block -->') {
      errors.push('Missing Machine Summary Block marker on first non-blank line');
      reportResult(errors, `${rel} summary block`);
      return;
    }
    idx += 1;
    while (idx < lines.length && lines[idx].trim().length === 0) {
      idx += 1;
    }
    if (idx >= lines.length) {
      errors.push('Machine Summary JSON missing after marker');
      reportResult(errors, `${rel} summary block`);
      return;
    }
    let summary;
    try {
      summary = JSON.parse(lines[idx].trim());
    } catch (err) {
      errors.push(`Invalid JSON in Machine Summary Block: ${err.message}`);
      reportResult(errors, `${rel} summary block`);
      return;
    }
    const summaryErrors = validateAgainstSchema(machineSummarySchema, summary, '#');
    reportResult(summaryErrors, `${rel} summary block`);
  });
}

// Validate task.json files
const taskJsonFiles = walkDir(path.join(repoRoot, 'ai', 'tasks'))
  .filter((filePath) => filePath.endsWith('task.json'));
taskJsonFiles.forEach((filePath) => validateJsonFile(filePath, 'task.json'));

// Validate template task.json
validateJsonFile(path.join(repoRoot, 'ai', 'templates', 'task.json'), 'task.json');
validateJsonFile(path.join(repoRoot, 'ai', 'tasks', 'templates', 'task.json'), 'task.json');

// Validate current index
validateJsonFile(path.join(repoRoot, 'ai', 'tasks', 'current_index.json'), 'current_index.json');

// Validate progress logs
const progressFiles = walkDir(path.join(repoRoot, 'ai', 'tasks'))
  .filter((filePath) => filePath.endsWith('progress.ndjson'));
const templateProgress = path.join(repoRoot, 'ai', 'templates', 'progress.ndjson');
if (existsSync(templateProgress)) {
  progressFiles.push(templateProgress);
}
progressFiles.forEach((filePath) => validateNdjsonFile(filePath, 'progress_event.json'));

// Validate prompt templates
const promptTemplates = [path.join(repoRoot, 'ai', 'templates', 'prompt_template.json')];
promptTemplates.forEach((filePath) => validateJsonFile(filePath, 'prompt_template.json'));

// Validate prompt blueprints
const blueprintDir = path.join(repoRoot, 'ai', 'templates', 'prompt_blueprints');
if (existsSync(blueprintDir)) {
  const blueprintFiles = walkDir(blueprintDir).filter((filePath) => filePath.endsWith('.json'));
  blueprintFiles.forEach((filePath) => validateJsonFile(filePath, 'prompt_blueprint.json'));
}

// Validate Machine Summary Blocks on Markdown files
const markdownFiles = [
  ...listFilesByExt(path.join(repoRoot, 'docs'), '.md'),
  ...listFilesByExt(path.join(repoRoot, 'ai'), '.md')
];
validateMachineSummaryBlocks(markdownFiles);

// Report results
results.forEach((result) => {
  if (result.ok) {
    console.log(`[OK] ${result.label}`);
  } else {
    console.error(`[FAIL] ${result.label}`);
    result.errors.forEach((err) => console.error(`  - ${err}`));
  }
});

if (failureCount > 0) {
  console.error(`Schema validation failed with ${failureCount} error group(s).`);
  process.exit(1);
} else {
  console.log('All schema validations passed.');
}
