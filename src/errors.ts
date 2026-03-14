type ErrorLike = Readonly<Record<string, unknown>>;

const isErrorLike = (value: unknown): value is ErrorLike =>
  typeof value === 'object' && value !== null;

export interface AppErrorOptions {
  readonly cause?: unknown;
  readonly code?: string;
  readonly exitCode?: number;
}

export class AppError extends Error {
  readonly code: string;
  readonly exitCode: number;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.code = options.code ?? 'APP_ERROR';
    this.exitCode = options.exitCode ?? 1;
  }
}

export class AdbError extends AppError {
  constructor(message: string, options: Omit<AppErrorOptions, 'code'> = {}) {
    super(message, { ...options, code: 'ADB_ERROR' });
  }
}

export class AiProviderError extends AppError {
  constructor(message: string, options: Omit<AppErrorOptions, 'code'> = {}) {
    super(message, { ...options, code: 'AI_PROVIDER_ERROR' });
  }
}

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;

  if (isErrorLike(error) && typeof error['message'] === 'string') {
    return error['message'];
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

export const getErrorStatus = (error: unknown): number | undefined => {
  if (!isErrorLike(error)) return undefined;
  if (typeof error['status'] === 'number') return error['status'];

  const response = error['response'];
  if (isErrorLike(response) && typeof response['status'] === 'number') {
    return response['status'];
  }

  return undefined;
};

export const getErrorCode = (error: unknown): string | undefined => {
  if (!isErrorLike(error)) return undefined;
  return typeof error['code'] === 'string' ? error['code'] : undefined;
};

export const formatCliError = (error: unknown): string => {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error) return error.message;
  return getErrorMessage(error);
};
