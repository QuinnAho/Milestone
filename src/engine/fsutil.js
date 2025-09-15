import fs from 'fs-extra';
import path from 'path';

export async function ensureDir(p) { await fs.ensureDir(p); }
export async function ensureFile(p) { await fs.ensureFile(p); }
export async function writeJson(p, data) { await fs.writeJson(p, data, { spaces: 2 }); }
export async function readJson(p, fallback = undefined) { try { return await fs.readJson(p); } catch { return fallback; } }
export async function appendLine(p, line) { await fs.ensureFile(p); await fs.appendFile(p, line.endsWith('\n')?line:line+'\n'); }
export async function pathExists(p) { return fs.pathExists(p); }
export function join(...args) { return path.join(...args); }

