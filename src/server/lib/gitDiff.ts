import { execSync } from 'node:child_process';

export interface DiffSnapshot {
  summary: string;
  files?: string[];
  patch?: string;
  commit?: string;
}

interface CaptureOptions {
  cwd?: string;
  patchLimit?: number;
  fileLimit?: number;
}

function runGit(command: string, cwd: string) {
  return execSync(`git ${command}`, { cwd, encoding: 'utf8' }).trim();
}

function truncateText(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit - 3)}...`;
}

function parseStatus(output: string, limit: number) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      if (line.length <= 3) {
        return line;
      }
      const candidate = line.slice(3);
      const renameParts = candidate.split('->').map((part) => part.trim());
      return renameParts[renameParts.length - 1];
    })
    .filter((line, index, array) => line.length > 0 && array.indexOf(line) === index)
    .slice(0, limit);
}

export function captureDiffSnapshot(options: CaptureOptions = {}): DiffSnapshot {
  const cwd = options.cwd ?? process.cwd();
  const patchLimit = options.patchLimit ?? 4000;
  const fileLimit = options.fileLimit ?? 20;
  try {
    const status = runGit('status --porcelain', cwd);
    const isClean = status.length === 0;
    if (isClean) {
      try {
        const summary = runGit('show --stat --oneline -1 HEAD --no-patch', cwd);
        const commit = runGit('rev-parse HEAD', cwd);
        return {
          summary: summary || 'Working tree clean (no diff)',
          commit: commit.slice(0, 40)
        };
      } catch (error) {
        return { summary: `diff unavailable: ${(error as Error).message}` };
      }
    }
    const files = parseStatus(status, fileLimit);
    let summary: string;
    try {
      summary = runGit('diff --stat HEAD', cwd);
    } catch {
      summary = runGit('diff --stat', cwd);
    }
    let patch: string | undefined;
    try {
      patch = truncateText(runGit('diff --unified=3 HEAD', cwd), patchLimit);
    } catch {
      patch = truncateText(runGit('diff --unified=3', cwd), patchLimit);
    }
    return {
      summary: summary || 'diff generated but summary empty',
      files: files.length > 0 ? files : undefined,
      patch
    };
  } catch (error) {
    return { summary: `diff unavailable: ${(error as Error).message}` };
  }
}
