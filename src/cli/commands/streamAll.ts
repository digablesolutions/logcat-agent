import { Command } from 'commander';
import { listDevices, spawnLogcatBinary, type Device } from '../../adb/adbClient.js';
import { attachLogcatParser } from '../../adb/logcatStream.js';
import { makeFilter } from '../../pipeline/filters.js';
import { defaultPatterns } from '../../pipeline/patterns.js';
import { resolveActivePatterns } from '../../pipeline/customPatterns.js';
import { detectPatterns, type SignatureMode } from '../../pipeline/dispatcher.js';
import { createSinkFanout } from '../../ingest/sinks.js';
import { startRetentionWorker } from '../../ingest/retention.js';
import { makeLimiter } from '../../ai/rateLimiter.js';
import { getErrorMessage } from '../../errors.js';
import { createConsoleLogRenderer, type LogRenderer } from '../../logRenderer.js';
import { renderReport, type ReportLevel } from '../../reporting.js';
import {
  createMultiDeviceSessionStats,
  getSessionRuntimeSeconds,
  markMultiDeviceClosed,
  recordMultiDeviceAiAnalysis,
  recordMultiDeviceEntry,
  recordMultiDevicePattern,
} from '../../sessionStats.js';
import type { ILogEntry, Priority } from '../../pipeline/types.js';
import {
  createAiProvider,
  parseBuffers,
  parseFloatFlagValue,
  parseIntegerFlagValue,
  parseOptionalIntegerFlagValue,
  parseTagMap,
  requirePriority,
  requireSignatureMode,
} from '../logCommandSupport.js';
import { createSessionController } from '../sessionSupport.js';
import { resolveConfiguredProvider } from '../../ai/modelDefaults.js';

type DroppablePriority = Extract<Priority, 'V' | 'D' | 'I'>;

const isDroppablePriority = (value: string): value is DroppablePriority =>
  value === 'V' || value === 'D' || value === 'I';

const parseDropPriorities = (value: string | undefined): DroppablePriority[] => {
  const parsed = value
    ?.split(',')
    .map((part) => part.trim().toUpperCase())
    .filter(isDroppablePriority);

  return parsed && parsed.length > 0 ? parsed : ['V', 'D'];
};

type StreamAllOptions = Readonly <{
  buffers?: string;
  minPriority?: string;
  tags?: string;
  filterExpr?: string[];
  noAi?: boolean;
  model?: string;
  provider?: 'openai' | 'gemini';
  aiSamplePerSignature?: string;
  aiDailyBudget?: string;
  exportJsonl?: string;
  retentionDays?: number;
  retentionSize?: number;
  lokiUrl?: string;
  lokiTenant?: string;
  lokiBatchMs?: string;
  lokiBatchSize?: string;
  patternsFile?: string;
  customPatternsOnly?: boolean;
  signatureMode?: string;
  maxRate?: string;
  dropVerbosity?: string;
  tagThrottle?: string;
}>;

interface NormalizedDevice extends Device {
  readonly displaySerial: string;
}

interface DeviceBundle {
  readonly serial: string;
  readonly stop: () => void;
  readonly close: () => Promise<void>;
}

const createCloseOnce = (close: () => Promise<void>): (() => Promise<void>) => {
  let closePromise: Promise<void> | null = null;

  return async (): Promise<void> => {
    if (!closePromise) {
      closePromise = close();
    }

    await closePromise;
  };
};

const normalizeDevices = (devices: ReadonlyArray<Device>): ReadonlyArray<NormalizedDevice> =>
  devices.map((device) => {
    const serial = device.serial;
    const ipMatch = /^((\d{1,3}\.){3}\d{1,3})(:(\d+))?$/.exec(serial);

    if (ipMatch) {
      const ip = ipMatch[1]!;
      const port = ipMatch[4] || '5555';
      return {
        ...device,
        serial: `${ip}:${port}`,
        displaySerial: ip,
      };
    }

    return {
      ...device,
      displaySerial: serial,
    };
  });

const performStreamAllAction = async (
  opts: StreamAllOptions,
  renderer: LogRenderer
): Promise<void> => {
  const report = (level: ReportLevel, message: string): void => {
    renderReport(renderer, { level, message });
  };

  const reportDevice = (deviceSerial: string, level: ReportLevel, message: string): void => {
    report(level, `[${deviceSerial}] ${message}`);
  };

  const requestedSignatureMode = opts.signatureMode || process.env['LOGCAT_SIGNATURE_MODE'] || 'hash';
  const sigMode: SignatureMode = requireSignatureMode(requestedSignatureMode);
  const allDevices = await listDevices();
  const devices = allDevices.filter((d) => d.status === 'device');
  const minPriority = requirePriority(opts.minPriority);

  if (devices.length === 0) {
    report('error', 'No devices in status "device".');
    process.exit(1);
  }

  const normalizedDevices = normalizeDevices(devices);
  const activePatterns = await resolveActivePatterns(
    defaultPatterns,
    opts.patternsFile,
    opts.customPatternsOnly ? 'custom' : 'merge'
  );

  const buffers = parseBuffers(opts.buffers);
  const maxRate = parseIntegerFlagValue(opts.maxRate || '50', '--max-rate', { minimum: 1 });
  const dropOrder = parseDropPriorities(opts.dropVerbosity);
  const tagMap = parseTagMap(opts.tags);

  const aiEnabled = opts.noAi !== true;
  const perSigMs = parseIntegerFlagValue(
    opts.aiSamplePerSignature || '28800000',
    '--ai-sample-per-signature',
    { minimum: 0 }
  );
  const dailyBudget = parseIntegerFlagValue(
    opts.aiDailyBudget || process.env['LOGCAT_AI_BUDGET_PER_DAY'] || '50',
    '--ai-daily-budget',
    { minimum: 0 }
  );
  const lokiBatchMs = parseIntegerFlagValue(opts.lokiBatchMs || '1000', '--loki-batch-ms', {
    minimum: 0,
  });
  const lokiBatchSize = parseIntegerFlagValue(
    opts.lokiBatchSize || '500',
    '--loki-batch-size',
    { minimum: 1 }
  );
  const tagThrottle = parseOptionalIntegerFlagValue(opts.tagThrottle, '--tag-throttle', {
    minimum: 1,
  });
  const limiter = makeLimiter(1);
  const resolvedProvider = resolveConfiguredProvider(opts.provider);

  const aiProvider = aiEnabled
    ? createAiProvider({
        provider: resolvedProvider,
        model: opts.model,
        openaiApiKey: process.env['OPENAI_API_KEY'],
        geminiApiKey: process.env['GEMINI_API_KEY'],
      })
    : undefined;

  renderer.renderMultiDeviceHeader({
    deviceCount: normalizedDevices.length,
    buffers,
    minPriority: minPriority || 'I',
    tags: opts.tags,
    aiEnabled: !!aiProvider,
  });
  report('info', `🎛️  Starting stream-all for ${normalizedDevices.length} device(s)`);

  if (opts.exportJsonl) {
    report('gray', `📝 JSONL export enabled to: ${opts.exportJsonl}`);
    if (opts.retentionDays || opts.retentionSize) {
      report(
        'gray',
        `🧹 Retention policy enabled: ${opts.retentionDays || '∞'} days, ${opts.retentionSize || '∞'} GB`
      );
      startRetentionWorker(opts.exportJsonl, {
        maxAgeDays: opts.retentionDays,
        maxSizeGb: opts.retentionSize,
      });
    }
  }

  const stats = createMultiDeviceSessionStats(
    normalizedDevices.map((device) => device.displaySerial)
  );
  const statsInterval = setInterval(() => {
    const runtime = getSessionRuntimeSeconds(stats.startTime);
    renderer.renderMultiDeviceStats(stats, runtime);
  }, 30000);

  const bundles: DeviceBundle[] = [];
  const lastAnalyzedAt = new Map<string, number>();
  let dailyCount = 0;
  let budgetDay = new Date().toISOString().slice(0, 10);
  const recentByDevice = new Map<string, ILogEntry[]>();
  let activeBundles = normalizedDevices.length;

  const session = createSessionController({
    cleanup: async (reason) => {
      clearInterval(statsInterval);

      if (reason !== 'source-close') {
        renderer.renderNewline();
        report('info', 'Stopping all devices...');
        bundles.forEach((bundle) => {
          bundle.stop();
        });
      }

      await Promise.all(bundles.map((bundle) => bundle.close()));

      const runtime = getSessionRuntimeSeconds(stats.startTime);
      renderer.renderMultiDeviceSummary(stats, runtime);
    },
    onError: (error: unknown) => {
      report('error', `Shutdown failed: ${getErrorMessage(error)}`);
    },
  });

  normalizedDevices.forEach((d) => {
    const { serial, displaySerial } = d;
    reportDevice(displaySerial, 'info', '📱 Starting stream...');

    const filter = makeFilter({
      minPriority,
      ...(tagMap ? { tags: tagMap } : {}),
    });

    const proc = spawnLogcatBinary({ serial, buffers, filterExpr: opts.filterExpr });
    const sink = createSinkFanout({
      jsonl: opts.exportJsonl ? { baseDir: opts.exportJsonl, device: displaySerial } : false,
      loki: opts.lokiUrl
        ? {
            url: opts.lokiUrl,
            tenantId: opts.lokiTenant,
            batchIntervalMs: lokiBatchMs,
            maxBatchSize: lokiBatchSize,
            labels: { job: 'logcat-agent', device: displaySerial },
          }
        : false,
    });

    recentByDevice.set(serial, []);
    let windowCount = 0;
    let windowStart = Date.now();
    const tagWindow = new Map<string, { count: number; start: number }>();
    let entryCount = 0;

    attachLogcatParser(
      proc,
      (entry) => {
        if (!filter(entry)) return;

        // Rate limiting
        const now = Date.now();
        if (now - windowStart >= 1000) {
          windowStart = now;
          windowCount = 0;
        }
        windowCount++;
        if (windowCount > maxRate && isDroppablePriority(entry.priority) && dropOrder.includes(entry.priority)) return;

        // Tag throttle
        if (tagThrottle !== undefined) {
          const maxPerTag = tagThrottle;
          const t = tagWindow.get(entry.tag) || { count: 0, start: now };
          if (now - t.start >= 1000) {
            t.start = now;
            t.count = 0;
          }
          t.count++;
          tagWindow.set(entry.tag, t);
          if (t.count > maxPerTag) return;
        }

        entryCount++;
        if (entryCount === 1 || entryCount % 500 === 0) {
          reportDevice(displaySerial, 'gray', `Processed ${entryCount} entries`);
        }

        recordMultiDeviceEntry(stats, displaySerial, entry);

        const matches = detectPatterns(entry, activePatterns, sigMode);
        matches.forEach(() => {
          recordMultiDevicePattern(stats, displaySerial);
        });
        sink?.write({
          ts: entry.timestamp.toISOString(),
          device: displaySerial,
          priority: entry.priority,
          tag: entry.tag,
          pid: entry.pid,
          message: entry.message,
          matches: matches.map((m) => ({
            name: m.pattern.name,
            severity: m.pattern.severity,
            signature: m.signature,
            fuzzySignature: m.fuzzySignature,
          })),
        });

        const recent = recentByDevice.get(serial)!;
        recent.push(entry);
        if (recent.length > 256) recent.shift();

        if (aiProvider && matches.length) {
          matches.forEach((m) => {
            const sigKey = (sigMode === 'fuzzy' ? m.fuzzySignature : m.signature) || m.signature;
            if (!sigKey) return;

            const today = new Date().toISOString().slice(0, 10);
            if (today !== budgetDay) {
              budgetDay = today;
              dailyCount = 0;
            }

            const last = lastAnalyzedAt.get(sigKey) ?? 0;
            if (now - last >= perSigMs && dailyCount < dailyBudget) {
              lastAnalyzedAt.set(sigKey, now);
              dailyCount++;
              const around = [...recent.slice(-5)];
              reportDevice(displaySerial, 'info', `🤖 Analyzing ${m.pattern.name}...`);
              void limiter(async () => {
                try {
                  const res = await aiProvider!.analyze({ match: m, surrounding: around });
                  recordMultiDeviceAiAnalysis(stats, displaySerial);
                  reportDevice(displaySerial, 'info', `🤖 AI (${aiProvider!.name()}): ${res.summary}`);
                } catch (err: unknown) {
                  reportDevice(displaySerial, 'error', `❌ AI analysis failed: ${getErrorMessage(err)}`);
                }
              });
            }
          });
        }
      },
      (err) => reportDevice(displaySerial, 'error', `parser error: ${getErrorMessage(err)}`)
    );

    const close = createCloseOnce(async () => {
      if (sink?.close) {
        await sink.close();
      }
    });

    proc.on('close', () => {
      void close()
        .catch((error: unknown) => {
          reportDevice(displaySerial, 'error', `close failed: ${getErrorMessage(error)}`);
        })
        .finally(() => {
          activeBundles--;
          markMultiDeviceClosed(stats, displaySerial);
          reportDevice(displaySerial, 'gray', 'Stream closed.');

          if (activeBundles === 0) {
            void session.shutdown('source-close');
          }
        });
    });

    bundles.push({
      serial: displaySerial,
      stop: () => proc.kill('SIGINT'),
      close,
    });
  });

  await session.completion;
};

export const streamAllCmd = new Command('stream-all')
  .description('Stream adb logcat from all connected devices concurrently')
  .option('-b, --buffers <list>', 'comma-separated buffers (main,crash,system)', 'main,crash')
  .option('-p, --min-priority <P>', 'min priority V|D|I|W|E|F', 'I')
  .option('-t, --tags <list>', 'comma-separated include tags')
  .option('--filter-expr <expr...>', 'raw logcat filter expression segments')
  .option('--no-ai', 'disable AI analysis (default recommended for 24h ingestion)')
  .option('--model <name>', 'AI model to use')
  .option('--provider <provider>', 'AI provider to use (openai or gemini)')
  .option(
    '--ai-sample-per-signature <ms>',
    'min milliseconds between AI analyses for the same signature (default 8h)',
    '28800000'
  )
  .option(
    '--ai-daily-budget <n>',
    'max AI analyses per calendar day across all devices (env LOGCAT_AI_BUDGET_PER_DAY)',
    () => process.env['LOGCAT_AI_BUDGET_PER_DAY'] ?? '50'
  )
  .option('--export-jsonl <dir>', 'export logs and matches to JSONL under this directory')
  .option('--retention-days <n>', 'delete logs older than N days', (v) => parseIntegerFlagValue(v, '--retention-days', { minimum: 1 }))
  .option('--retention-size <n>', 'delete oldest logs when total size exceeds N GB', (v) => parseFloatFlagValue(v, '--retention-size', { minimum: 0 }))
  .option(
    '--loki-url <url>',
    'push logs to Grafana Loki at this URL (e.g., http://localhost:3100/loki/api/v1/push)'
  )
  .option('--loki-tenant <id>', 'optional Loki tenant ID header (X-Scope-OrgID)')
  .option('--loki-batch-ms <ms>', 'Loki batch interval ms', '1000')
  .option('--loki-batch-size <n>', 'Loki max batch size', '500')
  .option('--patterns-file <path>', 'JSON file with custom patterns to extend defaults')
  .option('--custom-patterns-only', 'use only patterns from --patterns-file (no built-ins)')
  .option(
    '--signature-mode <mode>',
    'signature mode: hash|fuzzy|both (default hash)',
    () => process.env['LOGCAT_SIGNATURE_MODE'] ?? 'hash'
  )
  .option('--max-rate <n>', 'max lines/sec per device before dropping', '50')
  .option('--drop-verbosity <levels>', 'drop when throttling, comma list of V,D,I in order', 'V,D')
  .option('--tag-throttle <n>', 'optional per-tag moving window max lines/sec; drop when exceeded')
  .action((opts: StreamAllOptions) => {
    const renderer = createConsoleLogRenderer();

    void performStreamAllAction(opts, renderer).catch((err: unknown) => {
      renderer.renderError(`Stream-all failed: ${getErrorMessage(err)}`);
      process.exit(1);
    });
  });
