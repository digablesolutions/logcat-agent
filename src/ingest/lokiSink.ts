import { gzipSync } from 'node:zlib';
import { setTimeout as delay } from 'node:timers/promises';
import type { ExportRecord } from './jsonlExporter.js';
import { getErrorMessage } from '../errors.js';
import { globalMetrics } from './metrics.js';

export type LokiSinkOptions = Readonly<{
  url: string; // http(s)://host:3100/loki/api/v1/push
  labels?: Record<string, string> | undefined;
  batchIntervalMs?: number | undefined;
  maxBatchSize?: number | undefined;
  timeoutMs?: number | undefined;
  tenantId?: string | undefined;
}>;

export type LokiLine = Readonly<{
  tsNs: string; // nanoseconds since epoch as string
  line: string; // text line
  labels: Record<string, string>;
}>;

export interface ILokiSink {
  readonly write: (rec: ExportRecord) => void;
  readonly flush: () => Promise<void>;
  readonly close: () => Promise<void>;
}

export const createLokiSink = (opts: LokiSinkOptions): ILokiSink => {
  const batchInterval = opts.batchIntervalMs ?? 1000;
  const maxBatch = opts.maxBatchSize ?? 500;
  const queue: LokiLine[] = [];
  let timer: NodeJS.Timeout | null = null;

  const reportBackgroundFlushFailure = (error: unknown): void => {
    console.error(`[loki] flush failed: ${getErrorMessage(error)}`);
  };

  const groupByLabels = (lines: ReadonlyArray<LokiLine>) => {
    const groups = new Map<
      string,
      { labels: Record<string, string>; values: [string, string][] }
    >();

    lines.forEach((l) => {
      const labels = { ...(opts.labels || {}), ...l.labels };
      const sorted = Object.keys(labels)
        .sort()
        .map((k) => [k, labels[k]] as const);
      const key = JSON.stringify(sorted);
      if (!groups.has(key)) groups.set(key, { labels, values: [] });
      groups.get(key)!.values.push([l.tsNs, l.line]);
    });

    return Array.from(groups.values());
  };

  const pushToLoki = async (lines: ReadonlyArray<LokiLine>): Promise<void> => {
    if (lines.length === 0) return;
    const streams = groupByLabels(lines).map((g) => ({ stream: g.labels, values: g.values }));
    const body = JSON.stringify({ streams });
    const gz = gzipSync(Buffer.from(body));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000);

    try {
      const res = await fetch(opts.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Encoding': 'gzip',
          ...(opts.tenantId ? { 'X-Scope-OrgID': opts.tenantId } : {}),
        },
        body: gz,
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Loki push failed: ${res.status} ${res.statusText}`);
      globalMetrics.inc('sink_loki_pushed_lines_total', lines.length);
    } finally {
      clearTimeout(timeout);
    }
  };

  const flush = async (): Promise<void> => {
    if (queue.length === 0) return;
    const batch = queue.splice(0, Math.min(maxBatch, queue.length));

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await pushToLoki(batch);
        return;
      } catch {
        globalMetrics.inc('sink_loki_push_failures_total');
        if (attempt === 2) break;
        await delay(250 * (attempt + 1));
      }
    }

    throw new Error(`Failed to push ${batch.length} log lines to Loki after retries.`);
  };

  const schedule = (): void => {
    if (timer) return;
    timer = setInterval(() => {
      void flush().catch(reportBackgroundFlushFailure);
    }, batchInterval);
  };

  const write = (rec: ExportRecord): void => {
    const ts = new Date(rec.ts);
    const tsNs = (BigInt(ts.getTime()) * 1000000n).toString();
    const line = JSON.stringify(rec);
    const firstMatch = rec.matches?.[0];
    const pattern = firstMatch?.name ?? 'none';
    const severity = firstMatch?.severity ?? 'none';
    const labels = {
      job: 'logcat-agent',
      device: String(rec.device ?? 'unknown'),
      priority: String(rec.priority ?? 'I'),
      tag: String(rec.tag ?? 'unknown'),
      pat: String(pattern),
      severity: String(severity),
    };
    queue.push({ tsNs, line, labels });
    if (queue.length >= maxBatch) {
      void flush().catch(reportBackgroundFlushFailure);
    }
    schedule();
  };

  const close = async (): Promise<void> => {
    if (timer) clearInterval(timer);
    timer = null;
    await flush();
  };

  return {
    write,
    flush,
    close,
  };
};
