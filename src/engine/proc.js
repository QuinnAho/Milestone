import { execa } from 'execa';

const sessions = new Map();

function stripAnsi(text) {
  if (!text) return text;
  // Remove ESC-based ANSI sequences (CSI, OSC, etc.)
  const ESC = /\u001B|\u009B/g; // anchor
  let out = String(text);
  out = out.replace(/\u001B\[[0-9;?]*[ -\/]*[@-~]/g, ''); // CSI
  out = out.replace(/\u001B\][^\u0007]*(\u0007|\u001B\\)/g, ''); // OSC
  out = out.replace(/\u001B[PX^_].*?\u001B\\/g, ''); // DCS/PM/APC
  out = out.replace(/\u001B\([A-Za-z0-9]|\u001B\)[A-Za-z0-9]/g, ''); // Charset
  // Remove stray bracket-style control codes sometimes emitted without ESC
  out = out.replace(/\[(?:\??[0-9;]{1,10})[A-Za-z]/g, '');
  // Normalize line endings
  out = out.replace(/\r\n?/g, '\n');
  return out;
}

function makeId() {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function listSessions() {
  return Array.from(sessions.keys());
}

export async function startProcess({ command, cwd, onOutput, onExit, onStarted, env }) {
  const id = makeId();
  const child = execa(command, {
    cwd,
    shell: true,
    env,
    stdout: 'pipe',
    stderr: 'pipe'
  });

  sessions.set(id, child);

  const forward = (type, data) => {
    const text = data.toString();
    const clean = stripAnsi(text);
    if (onOutput) onOutput({ session: id, type, data: clean, timestamp: new Date().toISOString() });
  };

  child.stdout?.on('data', (d) => forward('stdout', d));
  child.stderr?.on('data', (d) => forward('stderr', d));

  if (onStarted) {
    try { await onStarted(child, id); } catch { /* ignore */ }
  }

  child.finally(() => {
    sessions.delete(id);
    if (onExit) onExit({ session: id });
  }).catch(() => {});

  return { session: id };
}

export async function writeProcess(session, input) {
  const child = sessions.get(session);
  if (!child) throw new Error('Session not found');
  child.stdin?.write(input);
  return { ok: true };
}

export async function killProcess(session) {
  const child = sessions.get(session);
  if (!child) return { ok: true };
  child.kill('SIGINT', { forceKillAfterTimeout: 2000 });
  sessions.delete(session);
  return { ok: true };
}

export async function runOnce({ command, cwd, input, env, onOutput }) {
  const child = execa(command, { cwd, shell: true, env, stdout: 'pipe', stderr: 'pipe' });

  let stdout = '';
  let stderr = '';

  const forward = (type, data) => {
    const text = data.toString();
    const clean = stripAnsi(text);
    if (type === 'stdout') stdout += clean; else stderr += clean;
    if (onOutput) onOutput({ type, data: clean, timestamp: new Date().toISOString() });
  };

  child.stdout?.on('data', (d) => forward('stdout', d));
  child.stderr?.on('data', (d) => forward('stderr', d));

  if (input) {
    child.stdin?.write(input);
    child.stdin?.end();
  }

  try {
    const res = await child;
    return { ok: true, stdout, stderr, code: res.exitCode };
  } catch (e) {
    return { ok: false, stdout: stdout || e.stdout || '', stderr: stderr || e.stderr || String(e), code: e.exitCode ?? -1 };
  }
}
