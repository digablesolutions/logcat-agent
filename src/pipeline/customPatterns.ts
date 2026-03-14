import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getErrorMessage } from '../errors.js';
import type { IPattern } from './types.js';

export type SerializedPattern = Readonly<{
  name: string;
  regex: string;
  flags?: string;
  severity: IPattern['severity'];
  description?: string;
}>;

export const loadPatternsFromFile = async (filePath: string): Promise<ReadonlyArray<IPattern>> => {
  const abs = resolve(process.cwd(), filePath);
  const raw = await readFile(abs, 'utf8');
  const data = JSON.parse(raw) as ReadonlyArray<SerializedPattern>;

  if (!Array.isArray(data)) throw new Error('patterns file must contain an array');

  return data.reduce<IPattern[]>((acc, p) => {
    if (!p?.name || !p?.regex || !p?.severity) return acc;
    try {
      const re = new RegExp(p.regex, p.flags || 'm');
      acc.push({
        name: p.name,
        regex: re,
        severity: p.severity,
        description: p.description ?? '',
      });
    } catch {
      // skip invalid regex
    }
    return acc;
  }, []);
};

export const resolveActivePatterns = async (
  defaultPatterns: ReadonlyArray<IPattern>,
  explicitFile?: string,
  mode?: 'merge' | 'custom' | 'builtin'
): Promise<ReadonlyArray<IPattern>> => {
  const file = explicitFile || process.env['LOGCAT_PATTERNS_FILE'];
  const envMode = (process.env['LOGCAT_PATTERNS_MODE'] || '').toLowerCase();

  const effectiveMode = mode || (
    (envMode === 'custom' || envMode === 'builtin') ? envMode : 'merge'
  );

  if (effectiveMode === 'builtin') return defaultPatterns;

  if (effectiveMode === 'custom') {
    if (!file) {
      console.warn('[patterns] custom mode requested but no patterns file provided; falling back to builtin');
      return defaultPatterns;
    }
    try {
      return await loadPatternsFromFile(file);
    } catch (error: unknown) {
      console.error(`[patterns] failed to load custom patterns from ${file}:`, getErrorMessage(error));
      return defaultPatterns;
    }
  }

  // merge
  if (!file) return defaultPatterns;
  try {
    const custom = await loadPatternsFromFile(file);
    return [...defaultPatterns, ...custom];
  } catch (error: unknown) {
    console.error(`[patterns] failed to load custom patterns from ${file}:`, getErrorMessage(error));
    return defaultPatterns;
  }
};
