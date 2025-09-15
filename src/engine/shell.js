import { execa } from 'execa';

export async function sh(command, opts = {}) {
  try {
    const res = await execa(command, { cwd: opts.cwd, shell: true, timeout: opts.timeout || 10 * 60_000 });
    return { ok: true, stdout: res.stdout, stderr: res.stderr, code: res.exitCode };
  } catch (e) {
    return { ok: false, stdout: e.stdout || '', stderr: e.stderr || String(e), code: e.exitCode ?? -1 };
  }
}
