import type { IPattern } from './types.js';

/**
 * Default pattern registry containing common exceptions and error types
 * encountered in Android applications.  These patterns are applied to
 * logcat messages and can be extended by consumers at runtime.
 */
export const defaultPatterns: ReadonlyArray<IPattern> = [
  {
    name: 'NullPointerException',
    regex: /(?:FATAL EXCEPTION|java\.lang\.)?NullPointerException\b[\s\S]*/m,
    severity: 'error',
    description: 'Null reference dereferenced',
  },
  {
    name: 'ArrayIndexOutOfBoundsException',
    regex: /ArrayIndexOutOfBoundsException\b[\s\S]*/m,
    severity: 'error',
  },
  {
    name: 'IllegalArgumentException',
    regex: /IllegalArgumentException\b[\s\S]*/m,
    severity: 'error',
  },
  {
    name: 'OutOfMemoryError',
    regex: /OutOfMemoryError\b[\s\S]*/m,
    severity: 'error',
  },
  {
    name: 'ANR',
    regex: /\b(Application Not Responding|android\.app\.\w*NotResponding|ANR in )/,
    severity: 'error',
  },
  {
    name: 'ClassNotFoundException',
    regex: /ClassNotFoundException\b[\s\S]*/m,
    severity: 'warning',
  },
  {
    name: 'SQLiteException',
    regex: /SQLite(?:Exception|DiskIOException|CantOpenDatabaseException)\b[\s\S]*/m,
    severity: 'error',
  },
] as const;