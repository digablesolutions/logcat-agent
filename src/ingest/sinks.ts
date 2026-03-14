import { createJsonlExporter, type ExportRecord, type IJsonlExporter } from './jsonlExporter.js';
import { createLokiSink } from './lokiSink.js';
import type { LokiSinkOptions } from './lokiSink.js';
import { globalMetrics } from './metrics.js';

export interface Sink<T> {
  readonly write: (rec: T) => void;
  readonly flush?: () => Promise<void>;
  readonly close?: () => Promise<void>;
}

export type JsonlSinkOptions = Readonly<{
  baseDir: string;
  device: string;
  flushIntervalMs?: number | undefined;
  maxBatchSize?: number | undefined;
}>;

export type FanoutOptions = Readonly<{
  jsonl?: JsonlSinkOptions | false;
  loki?: LokiSinkOptions | false;
}>;

export const createJsonlSink = (opts: JsonlSinkOptions): Sink<ExportRecord> => {
  const exporter: IJsonlExporter = createJsonlExporter(opts);
  return {
    write: (r) => {
      exporter.enqueue(r);
      globalMetrics.inc('sink_jsonl_written_total');
    },
    flush: async () => { /* no-op for jsonl sink */ },
    close: async () => exporter.close(),
  };
};

export const createSinkFanout = (opts: FanoutOptions): Sink<ExportRecord> | null => {
  const sinks: ReadonlyArray<Sink<ExportRecord>> = [
    ...(opts.jsonl ? [createJsonlSink(opts.jsonl)] : []),
    ...(opts.loki ? [createLokiSink(opts.loki)] : []),
  ];

  if (sinks.length === 0) return null;

  return {
    write: (rec) => {
      sinks.forEach((s) => s.write(rec));
    },
    flush: async () => {
      const flushes = sinks.flatMap((s) => (s.flush ? [s.flush()] : []));
      await Promise.all(flushes);
    },
    close: async () => {
      const closes = sinks.flatMap((s) => (s.close ? [s.close()] : []));
      await Promise.all(closes);
    },
  };
};
