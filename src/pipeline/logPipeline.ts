import { EventEmitter } from 'eventemitter3';
import { makeFilter } from './filters.js';
import { detectPatterns, type SignatureMode } from './dispatcher.js';
import { makeLimiter } from '../ai/rateLimiter.js';
import type { AnalysisResult, IAiProvider } from '../ai/provider.js';
import type { Sink } from '../ingest/sinks.js';
import type { ExportRecord } from '../ingest/jsonlExporter.js';
import type { ILogEntry, IPattern, IPatternMatch, Priority } from './types.js';
import type { ILogSource } from '../ingest/source.js';

export type LogPipelineConfig = Readonly<{
  source: ILogSource;
  minPriority: Priority;
  tags?: Readonly<Record<string, boolean>> | undefined;
  patterns: ReadonlyArray<IPattern>;
  aiProvider?: IAiProvider | undefined;
  sink?: Sink<ExportRecord> | null | undefined;
  signatureMode: SignatureMode;
  aiSamplePerSignatureMs: number;
  aiDailyBudget: number;
  maxContextLines: number;
}>;

export interface LogPipelineEvents {
  entry: [ILogEntry];
  match: [IPatternMatch];
  'ai-analyzing': [];
  'ai-analysis': [AnalysisResult, string];
  'ai-error': [unknown];
  error: [unknown];
  close: [];
}

export interface ILogPipeline extends EventEmitter<LogPipelineEvents> {
  readonly start: () => Promise<void>;
  readonly stop: () => Promise<void>;
}

export const createLogPipeline = (config: LogPipelineConfig): ILogPipeline => {
  const emitter = new EventEmitter<LogPipelineEvents>();
  let isRunning = false;
  const recent: ILogEntry[] = [];
  const lastAnalyzedAt = new Map<string, number>();
  let budgetDay = new Date().toISOString().slice(0, 10);
  let dailyCount = 0;
  const aiLimiter = makeLimiter(1);

  const pushRecent = (entry: ILogEntry): void => {
    recent.push(entry);
    if (recent.length > config.maxContextLines) {
      recent.shift();
    }
  };

  const triggerAiAnalysis = (m: IPatternMatch): void => {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== budgetDay) {
      budgetDay = today;
      dailyCount = 0;
    }

    const sigKey = (config.signatureMode === 'fuzzy' ? m.fuzzySignature : m.signature) || m.signature || m.fuzzySignature;
    if (!sigKey) return;

    const last = lastAnalyzedAt.get(sigKey) ?? 0;
    const now = Date.now();
    const withinWindow = now - last < config.aiSamplePerSignatureMs;
    const overBudget = dailyCount >= config.aiDailyBudget;

    if (!withinWindow && !overBudget) {
      lastAnalyzedAt.set(sigKey, now);
      dailyCount++;

      const around = [...recent.slice(-5)];
      emitter.emit('ai-analyzing');

      void aiLimiter(async () => {
        try {
          if (!config.aiProvider) return;
          const res = await config.aiProvider.analyze({ match: m, surrounding: around });
          emitter.emit('ai-analysis', res, config.aiProvider.name());
        } catch (err) {
          emitter.emit('ai-error', err);
        }
      });
    }
  };

  const handleMatches = (matches: ReadonlyArray<IPatternMatch>): void => {
    matches.forEach(m => {
      emitter.emit('match', m);
      if (config.aiProvider) {
        triggerAiAnalysis(m);
      }
    });
  };

  const start = async (): Promise<void> => {
    if (isRunning) return;
    isRunning = true;

    const filter = makeFilter({
      minPriority: config.minPriority,
      tags: config.tags,
    });

    config.source.on('entry', (entry) => {
      if (!filter(entry)) return;

      emitter.emit('entry', entry);

      const matches = detectPatterns(entry, config.patterns, config.signatureMode);
      if (matches.length > 0) {
        handleMatches(matches);
      }

      pushRecent(entry);

      if (config.sink) {
        const record: ExportRecord = {
          ts: entry.timestamp.toISOString(),
          device: config.source.deviceId || 'unknown',
          priority: entry.priority,
          tag: entry.tag,
          pid: entry.pid,
          message: entry.message,
          matches: matches.map(m => ({
            name: m.pattern.name,
            severity: m.pattern.severity,
            signature: m.signature ?? undefined,
            fuzzySignature: m.fuzzySignature ?? undefined,
          })),
        };
        config.sink.write(record);
      }
    });

    config.source.on('error', (err) => {
      emitter.emit('error', err);
    });

    config.source.on('close', () => {
      emitter.emit('close');
    });

    await config.source.connect();
  };

  const stop = async (): Promise<void> => {
    isRunning = false;
    await config.source.disconnect();
    if (config.sink?.close) {
      await config.sink.close();
    }
  };

  return Object.assign(emitter, {
    start,
    stop,
  }) as ILogPipeline;
};
