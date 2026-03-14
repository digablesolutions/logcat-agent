import { readdir, stat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { getErrorMessage } from '../errors.js';

export type RetentionPolicy = Readonly<{
  maxAgeDays?: number | undefined;
  maxSizeGb?: number | undefined;
  dryRun?: boolean | undefined;
}>;

export type RetentionResult = Readonly<{
  deletedDirs: ReadonlyArray<string>;
  totalDeletedBytes: number;
}>;

const getDirSize = async (dirPath: string): Promise<number> => {
  let size = 0;
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      size += await getDirSize(fullPath);
    } else {
      const s = await stat(fullPath);
      size += s.size;
    }
  }

  return size;
};

/**
 * Scans the base directory for date-indexed folders (YYYY-MM-DD)
 * and applies retention policies (age and size).
 */
export const runRetention = async (baseDir: string, policy: RetentionPolicy): Promise<RetentionResult> => {
  const result: { deletedDirs: string[]; totalDeletedBytes: number } = {
    deletedDirs: [],
    totalDeletedBytes: 0,
  };

  if (!policy.maxAgeDays && !policy.maxSizeGb) {
    return result;
  }

  type Entry = { readonly name: string; readonly path: string; readonly mtime: Date; readonly size: number };
  let entries: Entry[] = [];

  try {
    const dirEntries = await readdir(baseDir, { withFileTypes: true });

    for (const entry of dirEntries) {
      if (!entry.isDirectory()) continue;

      if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.name)) continue;

      const fullPath = join(baseDir, entry.name);
      const s = await stat(fullPath);
      const dirSize = await getDirSize(fullPath);

      entries.push({
        name: entry.name,
        path: fullPath,
        mtime: s.mtime,
        size: dirSize,
      });
    }
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      return result;
    }
    throw err;
  }

  // 1. Age-based retention
  if (policy.maxAgeDays) {
    const now = new Date();
    const cutoff = new Date(now.getTime() - policy.maxAgeDays * 24 * 60 * 60 * 1000);

    const toDelete = entries.filter((e) => {
      const folderDate = new Date(e.name);
      return !isNaN(folderDate.getTime()) && folderDate < cutoff;
    });

    for (const e of toDelete) {
      if (!policy.dryRun) {
        await rm(e.path, { recursive: true, force: true });
      }
      result.deletedDirs.push(e.name);
      result.totalDeletedBytes += e.size;
    }

    const deletedNames = new Set(result.deletedDirs);
    entries = entries.filter((e) => !deletedNames.has(e.name));
  }

  // 2. Size-based retention
  if (policy.maxSizeGb) {
    const maxSizeBytes = policy.maxSizeGb * 1024 * 1024 * 1024;
    let currentTotalSize = entries.reduce((acc, e) => acc + e.size, 0);

    if (currentTotalSize > maxSizeBytes) {
      entries.sort((a, b) => a.name.localeCompare(b.name));

      for (const e of entries) {
        if (currentTotalSize <= maxSizeBytes) break;

        if (!policy.dryRun) {
          await rm(e.path, { recursive: true, force: true });
        }
        result.deletedDirs.push(e.name);
        result.totalDeletedBytes += e.size;
        currentTotalSize -= e.size;
      }
    }
  }

  return result;
};

/**
 * Starts a background interval to run retention periodically.
 */
export const startRetentionWorker = (baseDir: string, policy: RetentionPolicy, intervalMs = 3600000) => {
  const timer = setInterval(() => {
    void (async () => {
      try {
        const result = await runRetention(baseDir, policy);
        if (result.deletedDirs.length > 0) {
          const mb = (result.totalDeletedBytes / (1024 * 1024)).toFixed(2);
          console.log(`[retention] Cleaned up ${result.deletedDirs.length} directories (${mb} MB)`);
        }
      } catch (error: unknown) {
        console.error(`[retention] Error in background worker: ${getErrorMessage(error)}`);
      }
    })();
  }, intervalMs);

  return () => clearInterval(timer);
};
