import { mkdir, readdir, stat, readFile, unlink } from 'node:fs/promises';
import { createWriteStream, createReadStream } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type { ILogEntry } from '../../pipeline/types.js';
import type { LogBuffer } from './logBuffer.js';

interface BufferFile {
  id: number;
  path: string;
  startTime: number;
  endTime: number;
  count: number;
}

export class FileLogBuffer implements LogBuffer {
  private bufferDir: string;
  private maxFileSize: number;
  private maxTotalSize: number;
  private currentFile: {
    stream: NodeJS.WritableStream & { bytesWritten: number; close?: () => void };
    id: number;
    count: number;
    entries: ILogEntry[];
    startTime: number;
    openPromise: Promise<void>;
  } | null = null;
  private files: BufferFile[] = [];
  private totalSize = 0;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(bufferDir: string, maxFileSize = 5 * 1024 * 1024, maxTotalSize = 100 * 1024 * 1024) {
    this.bufferDir = bufferDir;
    this.maxFileSize = maxFileSize;
    this.maxTotalSize = maxTotalSize;
  }

  async init(): Promise<void> {
    await mkdir(this.bufferDir, { recursive: true });
    await this.scanFiles();
  }

  async add(entry: ILogEntry): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      if (!this.currentFile) {
        await this.rotateFile(entry.timestamp.getTime());
      }

      await this.currentFile!.openPromise;

      const line = JSON.stringify(entry) + '\n';
      const buffer = Buffer.from(line);

      if (this.currentFile!.stream.bytesWritten + buffer.length > this.maxFileSize) {
        await this.rotateFile(entry.timestamp.getTime());
      }

      if (!this.currentFile!.stream.write(line)) {
        await new Promise<void>(resolve => {
          this.currentFile!.stream.once('drain', resolve);
        });
      }

      this.currentFile!.count++;
      this.currentFile!.entries.push(entry);
      this.totalSize += buffer.length;

      // Update current file metadata in memory (will be finalized on rotate)
      const currentFileIdx = this.files.findIndex(f => f.id === this.currentFile!.id);
      if (currentFileIdx !== -1) {
        this.files[currentFileIdx]!.endTime = entry.timestamp.getTime();
        this.files[currentFileIdx]!.count = this.currentFile!.count;
      }

      await this.enforceLimits();
    });
    return this.writeQueue;
  }

  async getRecent(count: number): Promise<ILogEntry[]> {
    await this.writeQueue;

    const result: ILogEntry[] = [];
    // Read from current file first, then backwards through files
    // Note: This is a simplified implementation. For strict correctness we might need to flush current stream.

    // We need to read files in reverse order
    const currentFileId = this.currentFile?.id;
    const allFiles = [...this.files]
      .filter((file) => file.id !== currentFileId)
      .sort((a, b) => b.id - a.id);

    if (this.currentFile) {
      for (let i = this.currentFile.entries.length - 1; i >= 0; i--) {
        result.push(this.currentFile.entries[i]!);
        if (result.length >= count) {
          return result.reverse();
        }
      }
    }

    for (const file of allFiles) {
      if (result.length >= count) break;

      const entries = await this.readEntriesFromFile(file.path);
      // entries are in chronological order, we want recent first
      for (let i = entries.length - 1; i >= 0; i--) {
        result.push(entries[i]!);
        if (result.length >= count) break;
      }
    }

    return result.reverse(); // Return in chronological order
  }

  async getWindow(start: Date, end: Date): Promise<ILogEntry[]> {
    await this.writeQueue;

    const startTime = start.getTime();
    const endTime = end.getTime();
    const result: ILogEntry[] = [];
    const currentFileId = this.currentFile?.id;

    const relevantFiles = this.files.filter(f =>
      (f.startTime <= endTime && f.endTime >= startTime)
    ).filter((file) => file.id !== currentFileId).sort((a, b) => a.id - b.id);

    for (const file of relevantFiles) {
      const entries = await this.readEntriesFromFile(file.path);
      for (const entry of entries) {
        const t = new Date(entry.timestamp).getTime();
        if (t >= startTime && t <= endTime) {
          result.push(entry);
        }
      }
    }

    if (this.currentFile) {
      for (const entry of this.currentFile.entries) {
        const time = entry.timestamp.getTime();
        if (time >= startTime && time <= endTime) {
          result.push(entry);
        }
      }
    }

    return result;
  }

  async clear(): Promise<void> {
    await this.close();
    await this.scanFiles();
    for (const file of this.files) {
      await unlink(file.path).catch(() => {
        /* ignore */
      });
    }
    this.files = [];
    this.totalSize = 0;
  }

  async close(): Promise<void> {
    await this.writeQueue;
    if (this.currentFile) {
      await this.closeCurrentFile();
      this.currentFile = null;
    }
  }

  async size(): Promise<number> {
    await this.writeQueue;
    return this.files.reduce((acc, f) => acc + f.count, 0);
  }

  private async scanFiles() {
    const fileNames = await readdir(this.bufferDir);
    const logFiles = fileNames.filter(f => f.endsWith('.jsonl')).sort();

    this.files = [];
    this.totalSize = 0;

    for (const name of logFiles) {
      const path = join(this.bufferDir, name);
      const stats = await stat(path);
      this.totalSize += stats.size;

      // Extract ID from filename (assuming format timestamp-id.jsonl or similar)
      // Actually, let's just use simple incrementing ID
      const id = parseInt(name.split('.')[0]!, 10) || 0;

      // We need to read first and last line to get start/end time
      // This is expensive on startup, maybe we can optimize later or store metadata
      const { start, end, count } = await this.getFileMetadata(path);

      this.files.push({
        id,
        path,
        startTime: start,
        endTime: end,
        count
      });
    }
  }

  private async getFileMetadata(path: string): Promise<{ start: number; end: number; count: number }> {
    // Simplified: read whole file. Optimization: read first/last bytes.
    const content = await readFile(path, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    if (lines.length === 0) return { start: 0, end: 0, count: 0 };

    const first = JSON.parse(lines[0]!);
    const last = JSON.parse(lines[lines.length - 1]!);

    return {
      start: new Date(first.timestamp).getTime(),
      end: new Date(last.timestamp).getTime(),
      count: lines.length
    };
  }

  private async rotateFile(timestamp: number) {
    if (this.currentFile) {
      await this.closeCurrentFile();
    }

    const latestKnownId = this.files[this.files.length - 1]?.id ?? 0;
    const id = Math.max(Date.now(), latestKnownId + 1);
    const filename = `${id}.jsonl`;
    const path = join(this.bufferDir, filename);
    const stream = createWriteStream(path, { flags: 'a' });
    const openPromise = new Promise<void>((resolve, reject) => {
      stream.once('open', () => resolve());
      stream.once('error', reject);
    });

    this.currentFile = {
      stream,
      id,
      count: 0,
      entries: [],
      startTime: timestamp,
      openPromise,
    };

    this.files.push({
      id,
      path,
      startTime: timestamp,
      endTime: timestamp,
      count: 0,
    });
  }

  private async closeCurrentFile(): Promise<void> {
    if (!this.currentFile) return;

    await this.currentFile.openPromise.catch(() => undefined);

    const stream = this.currentFile.stream;
    await new Promise<void>((resolve, reject) => {
      stream.once('finish', resolve);
      stream.once('error', reject);
      stream.end();
    });
  }

  private async enforceLimits() {
    while (this.totalSize > this.maxTotalSize && this.files.length > 1) {
      const oldest = this.files.shift();
      if (oldest) {
        // Don't delete if it's the current file (shouldn't happen due to length > 1 check)
        if (this.currentFile && oldest.id === this.currentFile.id) {
          this.files.unshift(oldest);
          break;
        }

        try {
          const stats = await stat(oldest.path);
          this.totalSize -= stats.size;
          await unlink(oldest.path);
        } catch (e) {
          console.error(`Failed to delete old buffer file ${oldest.path}:`, e);
        }
      }
    }
  }

  private async readEntriesFromFile(path: string): Promise<ILogEntry[]> {
    const entries: ILogEntry[] = [];
    const stream = createReadStream(path);
    const rl = createInterface({
      input: stream,
      crlfDelay: Infinity
    });

    try {
      for await (const line of rl) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          // Revive date
          entry.timestamp = new Date(entry.timestamp);
          entries.push(entry);
        } catch {
          // Ignore malformed lines
        }
      }
    } catch (error: unknown) {
      const enoent = typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
      if (!enoent) {
        throw error;
      }
    }

    return entries;
  }
}
