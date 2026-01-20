export type FileAccessMode = 'read_only' | 'read_write';

export interface SchemaValidationRequest {
  schema?: string;
  data: unknown;
  filePath: string;
}

export type SchemaValidator = (request: SchemaValidationRequest) => Promise<void> | void;

export interface FileAccessLogger {
  info(message: string, details?: Record<string, unknown>): void;
  warn(message: string, details?: Record<string, unknown>): void;
  error(message: string, details?: Record<string, unknown>): void;
}

export interface FileAccessOptions {
  rootDir: string;
  mode?: FileAccessMode;
  logger?: FileAccessLogger;
  schemaValidator?: SchemaValidator;
  logToFilePath?: string;
}

export interface WriteOptions {
  schema?: string;
  pretty?: boolean;
  encoding?: BufferEncoding;
}

export interface AppendOptions extends WriteOptions {
  separator?: string;
}

export interface ReadOptions {
  encoding?: BufferEncoding;
}

export interface FileAccessOperationContext {
  relativePath: string;
  absolutePath: string;
  mode: FileAccessMode;
}

export class FileAccessError extends Error {
  public readonly code: 'READ_ONLY' | 'OUT_OF_BOUNDS' | 'VALIDATION_FAILED' | 'IO_ERROR';
  public readonly context?: FileAccessOperationContext;

  constructor(message: string, code: FileAccessError['code'], context?: FileAccessOperationContext) {
    super(message);
    this.name = 'FileAccessError';
    this.code = code;
    this.context = context;
  }
}
