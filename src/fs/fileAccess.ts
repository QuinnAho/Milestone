import { promises as fs } from 'node:fs';
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  AppendOptions,
  FileAccessError,
  FileAccessLogger,
  FileAccessMode,
  FileAccessOperationContext,
  FileAccessOptions,
  ReadOptions,
  SchemaValidator,
  WriteOptions
} from './types';

const defaultLogger: FileAccessLogger = {
  info(message, details) {
    console.log(`[file-access] ${message}`, details ?? '');
  },
  warn(message, details) {
    console.warn(`[file-access][warn] ${message}`, details ?? '');
  },
  error(message, details) {
    console.error(`[file-access][error] ${message}`, details ?? '');
  }
};

const DEFAULT_ENCODING: BufferEncoding = 'utf8';

export class FileAccess {
  private readonly rootDir: string;
  private mode: FileAccessMode;
  private readonly logger: FileAccessLogger;
  private readonly schemaValidator?: SchemaValidator;
  private readonly logFilePath?: string;

  constructor(options: FileAccessOptions) {
    if (!options.rootDir) {
      throw new Error('rootDir is required');
    }
    this.rootDir = path.resolve(options.rootDir);
    this.mode = options.mode ?? 'read_write';
    this.logger = options.logger ?? defaultLogger;
    this.schemaValidator = options.schemaValidator;
    this.logFilePath = options.logToFilePath;
  }

  public setMode(mode: FileAccessMode) {
    this.mode = mode;
    this.log('info', `Switched mode to ${mode}`, {});
  }

  public getMode(): FileAccessMode {
    return this.mode;
  }

  public resolve(relativePath: string): string {
    const absolute = path.resolve(this.rootDir, relativePath);
    if (!absolute.startsWith(this.rootDir)) {
      const context: FileAccessOperationContext = {
        relativePath,
        absolutePath: absolute,
        mode: this.mode
      };
      throw new FileAccessError('Attempted to access path outside root directory', 'OUT_OF_BOUNDS', context);
    }
    return absolute;
  }

  public async readText(relativePath: string, options?: ReadOptions): Promise<string> {
    const absolute = this.resolve(relativePath);
    const encoding = options?.encoding ?? DEFAULT_ENCODING;
    this.log('info', 'Reading text file', { relativePath });
    try {
      return await fs.readFile(absolute, { encoding });
    } catch (error) {
      this.log('error', 'Failed to read text file', { relativePath, error });
      throw new FileAccessError((error as Error).message, 'IO_ERROR', {
        relativePath,
        absolutePath: absolute,
        mode: this.mode
      });
    }
  }

  public async readJson<T>(relativePath: string): Promise<T> {
    const raw = await this.readText(relativePath);
    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      this.log('error', 'Failed to parse JSON', { relativePath, error });
      throw error;
    }
  }

  public async list(relativeDir = '.'): Promise<string[]> {
    const absoluteDir = this.resolve(relativeDir);
    const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
    const results: string[] = [];
    for (const entry of entries) {
      const childRel = this.normalizeRelativePath(path.join(relativeDir, entry.name));
      if (entry.isDirectory()) {
        results.push(...(await this.list(childRel)));
      } else {
        results.push(childRel);
      }
    }
    return results;
  }

  public async writeText(relativePath: string, contents: string, options?: WriteOptions): Promise<void> {
    this.ensureWritable(relativePath);
    const absolute = this.resolve(relativePath);
    const encoding = options?.encoding ?? DEFAULT_ENCODING;
    await this.ensureParentDir(absolute);
    await this.validateBeforeWrite(relativePath, contents, options?.schema);
    const tempFile = this.buildTempPath(absolute);
    try {
      await fs.writeFile(tempFile, contents, { encoding });
      await fs.rename(tempFile, absolute);
      this.log('info', 'Wrote text file atomically', { relativePath });
    } catch (error) {
      await this.safeUnlink(tempFile);
      this.log('error', 'Failed to write text file', { relativePath, error });
      throw new FileAccessError((error as Error).message, 'IO_ERROR', {
        relativePath,
        absolutePath: absolute,
        mode: this.mode
      });
    }
  }

  public async writeJson(relativePath: string, data: unknown, options?: WriteOptions): Promise<void> {
    const pretty = options?.pretty ?? true;
    const payload = JSON.stringify(data, null, pretty ? 2 : undefined);
    await this.validateBeforeWrite(relativePath, data, options?.schema);
    await this.writeText(relativePath, `${payload}\n`, { ...options, schema: undefined });
  }

  public async appendText(relativePath: string, contents: string, options?: AppendOptions): Promise<void> {
    this.ensureWritable(relativePath);
    const absolute = this.resolve(relativePath);
    const encoding = options?.encoding ?? DEFAULT_ENCODING;
    await this.ensureParentDir(absolute);
    await this.validateBeforeWrite(relativePath, contents, options?.schema);
    const payload = options?.separator ? `${contents}${options.separator}` : contents;
    try {
      await fs.appendFile(absolute, payload, { encoding });
      this.log('info', 'Appended text file', { relativePath });
    } catch (error) {
      this.log('error', 'Failed to append text file', { relativePath, error });
      throw new FileAccessError((error as Error).message, 'IO_ERROR', {
        relativePath,
        absolutePath: absolute,
        mode: this.mode
      });
    }
  }

  public async appendNdjson(relativePath: string, data: unknown, options?: AppendOptions): Promise<void> {
    const payload = JSON.stringify(data);
    await this.appendText(relativePath, payload, { ...options, separator: '\n' });
  }

  private ensureWritable(relativePath: string) {
    if (this.mode === 'read_only') {
      this.log('warn', 'Write attempt rejected in read-only mode', { relativePath });
      throw new FileAccessError('Read-only mode: write attempts are disabled', 'READ_ONLY', {
        relativePath,
        absolutePath: this.resolve(relativePath),
        mode: this.mode
      });
    }
  }

  private async ensureParentDir(absolutePath: string) {
    const dir = path.dirname(absolutePath);
    await fs.mkdir(dir, { recursive: true });
  }

  private buildTempPath(targetPath: string) {
    const dir = path.dirname(targetPath);
    const unique = `${Date.now()}-${process.pid}-${Math.round(Math.random() * 1e6)}`;
    return path.join(dir, `.tmp-${unique}`);
  }

  private async safeUnlink(filePath: string) {
    try {
      await fs.unlink(filePath);
    } catch {
      // ignore – best effort cleanup
    }
  }

  private async validateBeforeWrite(relativePath: string, payload: unknown, schema?: string) {
    if (!schema) {
      return;
    }
    if (!this.schemaValidator) {
      this.log('warn', 'Schema provided but no validator configured', { relativePath, schema });
      return;
    }
    try {
      await this.schemaValidator({ schema, data: payload, filePath: relativePath });
    } catch (error) {
      this.log('error', 'Schema validation failed', { relativePath, schema, error });
      throw new FileAccessError((error as Error).message, 'VALIDATION_FAILED', {
        relativePath,
        absolutePath: this.resolve(relativePath),
        mode: this.mode
      });
    }
  }

  private log(level: keyof FileAccessLogger, message: string, details?: Record<string, unknown>) {
    const enriched = { ...details, mode: this.mode };
    this.logger[level](message, enriched);
    if (this.logFilePath) {
      const record = JSON.stringify({
        ts: new Date().toISOString(),
        level,
        message,
        details: enriched
      });
      appendFileSafe(this.logFilePath, `${record}\n`);
    }
  }

  private normalizeRelativePath(relPath: string): string {
    return relPath.split(path.sep).join('/');
  }
}

function appendFileSafe(filePath: string, contents: string) {
  try {
    mkdirSync(path.dirname(filePath), { recursive: true });
    appendFileSync(filePath, contents, { encoding: 'utf8' });
  } catch (error) {
    defaultLogger.error('Unable to append to log file', { logFilePath: filePath, error });
  }
}
