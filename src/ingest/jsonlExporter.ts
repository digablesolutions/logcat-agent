import { mkdir } from 'node:fs/promises';
import { createWriteStream, existsSync, type WriteStream } from 'node:fs';
import { join } from 'node:path';
import { getErrorMessage } from '../errors.js';
import { globalMetrics } from './metrics.js';

export type JsonlExporterOptions = Readonly <{
  baseDir: string;
  device: string;
  flushIntervalMs?: number | undefined;
  maxBatchSize?: number | undefined;
}>;

export type ExportRecord = Readonly <{
  ts: string;
  device: string;
  priority: string;
  tag: string;
  pid: number;
  message: string;
  matches?: ReadonlyArray <{
    readonly name: string;
    readonly severity: string;
    readonly signature?: string | undefined;
    readonly fuzzySignature?: string | undefined;
  }> | undefined;
}>;

const dateKey = (d = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export interface IJsonlExporter {
  readonly enqueue: (record: ExportRecord) => void;
  readonly close: () => Promise<void>;
}

export const createJsonlExporter = (opts: JsonlExporterOptions): IJsonlExporter => {
  const flushInterval = opts.flushIntervalMs ?? 1000;
  const maxBatchSize = opts.maxBatchSize ?? 500;
  let currentKey = '';
  let stream: WriteStream | null = null;
  const queue: ExportRecord[] = [];
  let timer: NodeJS.Timeout | null = null;

  const reportBackgroundFlushFailure = (error: unknown): void => {
    globalMetrics.inc('sink_jsonl_flush_failures_total');
    console.error(`[jsonl] flush failed: ${getErrorMessage(error)}`);
  };

  const ensureStream = async (now = new Date()): Promise<void> => {
    const key = dateKey(now);
    if (key !== currentKey || !stream) {
      currentKey = key;
      if (stream) stream.end();
      const dir = join(opts.baseDir, key);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
      stream = createWriteStream(join(dir, `${opts.device}.jsonl`), { flags: 'a' });
    }
  };

  const flush = async (): Promise<void> => {
    if (queue.length === 0) return;
    await ensureStream();

    const lines = queue
      .splice(0, queue.length)
      .map((r) => JSON.stringify(r))
      .join('\n') + '\n';

    return new Promise<void>((resolve, reject) => {
      if (!stream) return reject(new Error('Stream not initialized'));
      stream.write(lines, (err) => (err ? reject(err) : resolve()));
    });
  };

  const schedule = (): void => {
    if (timer) return;
    timer = setInterval(() => {
      void flush().catch(reportBackgroundFlushFailure);
    }, flushInterval);
  };

  const enqueue = (record: ExportRecord): void => {
    queue.push(record);
    if (queue.length >= maxBatchSize) {
      void flush().catch(reportBackgroundFlushFailure);
    }
    schedule();
  };

  const close = async (): Promise<void> => {
    if (timer) clearInterval(timer);
    timer = null;
    await flush();
    if (stream) stream.end();
    stream = null;
  };

  return {
    enqueue,
    close,
  };
};
