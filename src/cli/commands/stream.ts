import { Command } from 'commander';
import { listDevices, type Device } from '../../adb/adbClient.js';
import { createRequire } from 'node:module';
import { defaultPatterns } from '../../pipeline/patterns.js';
import { resolveActivePatterns } from '../../pipeline/customPatterns.js';
import { createSinkFanout } from '../../ingest/sinks.js';
import { startRetentionWorker } from '../../ingest/retention.js';
import { globalMetrics } from '../../ingest/metrics.js';
import { getConfigStore, type Config, type ConfigStore } from '../../configService.js';
import { getErrorMessage } from '../../errors.js';
import { createConsoleLogRenderer, type LogRenderer } from '../../logRenderer.js';
import { createLogPipeline } from '../../pipeline/logPipeline.js';
import { createAdbLogcatSource } from '../../ingest/adbSource.js';
import { createLogSessionStats, getSessionRuntimeSeconds, recordEntryStats } from '../../sessionStats.js';
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
import { createSessionController, logSelectedDevice, selectStreamingDevice } from '../sessionSupport.js';
import chalk from 'chalk';
import { resolveConfiguredProvider } from '../../ai/modelDefaults.js';

const require = createRequire(import.meta.url);

type StreamOptions = Readonly<{
  wifi?: boolean;
  wifiTimeout?: string;
  wifiPass?: string;
  wifiQr?: boolean;
  wifiName?: string;
  wifiPair?: string;
  wifiTarget?: string;
  serial?: string;
  interactive?: boolean;
  buffers?: string;
  minPriority?: string;
  tags?: string;
  filterExpr?: string[];
  noAi?: boolean;
  model?: string;
  provider?: 'openai' | 'gemini';
  openaiBaseUrl?: string;
  saveLogs?: boolean;
  maxLines?: string;
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
  aiSamplePerSignature?: string;
  aiDailyBudget?: string;
}>;

const handleWifiFlow = async (
  opts: StreamOptions,
  config: ConfigStore,
  renderer: LogRenderer
): Promise<string | null> => {
  const { ensureAdbSupportsWifi, wifiAutoConnect, generateRandomHex, formatAdbQr, adbPair, adbConnect } =
    await import('../../adb/wifi.js');

  try {
    const { version } = await ensureAdbSupportsWifi();
    if (version) renderer.renderGray(`adb version: ${version}`);
  } catch (error: unknown) {
    renderer.renderError(getErrorMessage(error));
    process.exit(1);
  }

  const pass = opts.wifiPass || generateRandomHex(8);
  const name = opts.wifiName || `debug-${generateRandomHex(4)}`;

  if (opts.wifiQr) {
    const qrcode = require('qrcode-terminal');
    renderer.renderInfo('━'.repeat(80));
    renderer.renderInfo('📶 Wireless debugging QR');
    renderer.renderInfo(`Name: ${name}`);
    renderer.renderInfo(`Pass: ${pass}`);
    renderer.renderGray(
      '\nScan on device: Settings → Developer options → Wireless debugging → Pair device with QR code\n'
    );
    qrcode.generate(formatAdbQr(name, pass), { small: true });
    renderer.renderNewline();
  }

  const parseHostPort = (s: string) => {
    const re = /^\s*([^:]+):(\d+)\s*$/;
    const m = re.exec(s);
    if (!m) return null;
    const port = parseIntegerFlagValue(m[2]!, '--wifi host:port', { minimum: 1, maximum: 65535 });
    return { host: m[1]!, port };
  };

  if (opts.wifiPair || opts.wifiTarget) {
    if (opts.wifiPair) {
      const hp = parseHostPort(opts.wifiPair);
      if (!hp) {
        renderer.renderError(`Invalid --wifi-pair value: ${opts.wifiPair} (expected host:port)`);
      } else {
        renderer.renderGray(`↪ adb pair ${hp.host}:${hp.port} ...`);
        const { success, message } = await adbPair(hp.host, hp.port, pass);
        if (success) renderer.renderSuccess('paired');
        else renderer.renderError('pair failed' + (message ? ` — ${message}` : ''));
      }
    }
    const targetStr = opts.wifiTarget || opts.wifiPair || '';
    const hp2 = targetStr ? parseHostPort(targetStr) : null;
    if (hp2) {
      renderer.renderGray(`↪ adb connect ${hp2.host}:${hp2.port} ...`);
      const { success, message } = await adbConnect(hp2.host, hp2.port);
      if (success) {
        renderer.renderSuccess('connected');
        return `${hp2.host}:${hp2.port}`;
      }
      renderer.renderError('connect failed' + (message ? ` — ${message}` : ''));
    }
    return null;
  }

  renderer.renderInfo('📶 Wi‑Fi discovery: looking for adb-tls-pairing / connect ...');
  const { connected } = await wifiAutoConnect({
    timeoutMs: config.get('adbWifiTimeout'),
    pass,
    onEvent: (e) => {
      if (e.kind === 'pair-attempt') renderer.renderGray(`↪ adb pair ${e.host}:${e.port} ...`);
      if (e.kind === 'pair-result') {
        if (e.ok) renderer.renderSuccess('paired');
        else renderer.renderError(`pair failed${e.message ? ` — ${e.message}` : ''}`);
      }
      if (e.kind === 'connect-attempt') renderer.renderGray(`↪ adb connect ${e.host}:${e.port} ...`);
      if (e.kind === 'connect-result') {
        if (e.ok) renderer.renderSuccess('connected');
        else renderer.renderError(`connect failed${e.message ? ` — ${e.message}` : ''}`);
      }
    },
  });

  if (!connected) {
    renderer.renderError('No Wi‑Fi ADB service found within timeout.');
    return null;
  }
  renderer.renderSuccess(`Wi‑Fi connected: ${connected}`);
  return connected;
};

const performStreamAction = async (opts: StreamOptions): Promise<void> => {
  const config = getConfigStore();
  const renderer = createConsoleLogRenderer();
  const minPriority = requirePriority(opts.minPriority);
  const configUpdates: Partial<Config> = {};

  const aiSamplePerSignatureMs = parseOptionalIntegerFlagValue(
    opts.aiSamplePerSignature,
    '--ai-sample-per-signature',
    { minimum: 0 }
  );
  const aiDailyBudget = parseOptionalIntegerFlagValue(opts.aiDailyBudget, '--ai-daily-budget', {
    minimum: 0,
  });
  const adbWifiTimeout = parseOptionalIntegerFlagValue(opts.wifiTimeout, '--wifi-timeout', {
    minimum: 0,
  });
  const logcatMaxLines = parseOptionalIntegerFlagValue(opts.maxLines, '--max-lines', {
    minimum: 1,
  });
  const lokiBatchMs = parseOptionalIntegerFlagValue(opts.lokiBatchMs, '--loki-batch-ms', {
    minimum: 0,
  });
  const lokiBatchSize = parseOptionalIntegerFlagValue(opts.lokiBatchSize, '--loki-batch-size', {
    minimum: 1,
  });
  const normalizedSignatureMode = opts.signatureMode
    ? requireSignatureMode(opts.signatureMode)
    : undefined;

  if (aiSamplePerSignatureMs !== undefined) configUpdates.aiSamplePerSignatureMs = aiSamplePerSignatureMs;
  if (aiDailyBudget !== undefined) configUpdates.aiDailyBudget = aiDailyBudget;
  if (adbWifiTimeout !== undefined) configUpdates.adbWifiTimeout = adbWifiTimeout;
  if (logcatMaxLines !== undefined) configUpdates.logcatMaxLines = logcatMaxLines;
  if (lokiBatchMs !== undefined) configUpdates.lokiBatchMs = lokiBatchMs;
  if (lokiBatchSize !== undefined) configUpdates.lokiBatchSize = lokiBatchSize;
  if (normalizedSignatureMode !== undefined) {
    configUpdates.logcatSignatureMode = normalizedSignatureMode;
  }

  if (Object.keys(configUpdates).length > 0) {
    config.update(configUpdates);
  }

  const buffers = parseBuffers(opts.buffers);
  const tagMap = parseTagMap(opts.tags);

  const wifiConnectedSerial = opts.wifi ? await handleWifiFlow(opts, config, renderer) : null;

  const allDevices = await listDevices();
  const devices: ReadonlyArray<Device> = allDevices;
  const selectedDevice = selectStreamingDevice(devices, {
    serial: opts.serial,
    preferredSerial: wifiConnectedSerial,
    preferNetworkDevice: opts.wifi,
  });
  const serial = selectedDevice.serial;
  logSelectedDevice(selectedDevice, (message) => {
    renderer.renderInfo(message);
  });

  const activePatterns = await resolveActivePatterns(
    defaultPatterns,
    opts.patternsFile,
    opts.customPatternsOnly ? 'custom' : 'merge'
  );

  const resolvedProvider = resolveConfiguredProvider(opts.provider, {
    rejectInvalidExplicit: true,
  });

  const aiProvider = !opts.noAi
    ? createAiProvider({
        provider: resolvedProvider,
        model: opts.model,
        openaiApiKey: config.get('aiApiKey'),
        openaiBaseUrl: opts.openaiBaseUrl || config.get('aiBaseUrl') || undefined,
        geminiApiKey: process.env['GEMINI_API_KEY'],
        openAiProviderOptions: {
          maxMessageChars: config.get('aiMaxMessageChars'),
          maxContextChars: config.get('aiMaxContextChars'),
          timeoutMs: config.get('aiTimeoutMs'),
          maxRetries: config.get('aiMaxRetries'),
          retryBaseMs: config.get('aiRetryBaseMs'),
          concurrency: config.get('aiConcurrency'),
        },
      })
    : undefined;

  const sink = createSinkFanout({
    jsonl: opts.exportJsonl ? { baseDir: opts.exportJsonl, device: serial } : false,
    loki: opts.lokiUrl
      ? {
          url: opts.lokiUrl,
          tenantId: opts.lokiTenant || undefined,
          batchIntervalMs: config.get('lokiBatchMs'),
          maxBatchSize: config.get('lokiBatchSize'),
          labels: { job: 'logcat-agent', device: serial },
        }
      : false,
  });

  if (opts.exportJsonl && (opts.retentionDays || opts.retentionSize)) {
    startRetentionWorker(opts.exportJsonl, {
      maxAgeDays: opts.retentionDays,
      maxSizeGb: opts.retentionSize,
    });
  }

  const source = createAdbLogcatSource({
    serial,
    buffers,
    filterExpr: opts.filterExpr,
  });

  const signatureMode = config.get('logcatSignatureMode');

  const pipeline = createLogPipeline({
    source,
    minPriority: minPriority || 'I',
    tags: tagMap,
    patterns: activePatterns,
    aiProvider,
    sink,
    signatureMode,
    aiSamplePerSignatureMs: config.get('aiSamplePerSignatureMs'),
    aiDailyBudget: config.get('aiDailyBudget'),
    maxContextLines: config.get('logcatMaxLines'),
  });

  const stats = createLogSessionStats();

  pipeline.on('entry', (entry) => {
    recordEntryStats(stats, entry);
    renderer.renderEntry(entry);
  });

  pipeline.on('match', (match) => {
    stats.patterns++;
    renderer.renderMatch(match);
  });

  pipeline.on('ai-analyzing', () => renderer.renderInfo('🤖 Analyzing with AI...'));
  pipeline.on('ai-analysis', (res, providerName) => {
    stats.aiAnalyses++;
    renderer.renderAiAnalysis(providerName, res);
  });
  pipeline.on('ai-error', (err) => renderer.renderError(`❌ AI analysis failed: ${getErrorMessage(err)}`));
  pipeline.on('error', (err) => renderer.renderError(`Pipeline error: ${getErrorMessage(err)}`));

  renderer.renderHeader(serial, selectedDevice.model, buffers, minPriority || 'I', opts.tags, !!aiProvider);

  const statsInterval = setInterval(() => {
    const runtime = getSessionRuntimeSeconds(stats.startTime);
    renderer.renderStats(stats, runtime, globalMetrics.snapshot());
  }, 30000);

  const session = createSessionController({
    cleanup: async () => {
      clearInterval(statsInterval);
      await pipeline.stop();
      const runtime = getSessionRuntimeSeconds(stats.startTime);
      renderer.renderSummary(stats, runtime);
    },
    onError: (error: unknown) => renderer.renderError(`Shutdown failed: ${getErrorMessage(error)}`),
  });

  pipeline.on('close', () => {
    void session.shutdown('source-close');
  });

  try {
    await pipeline.start();
  } catch (error) {
    session.dispose();
    clearInterval(statsInterval);
    await pipeline.stop().catch(() => undefined);
    throw error;
  }

  await session.completion;
};

export const streamCmd = new Command('stream')
  .description('Stream adb logcat with AI-assisted analysis')
  .option('--wifi', 'attempt Wi‑Fi discovery/pair/connect before streaming')
  .option('--wifi-timeout <ms>', 'Wi‑Fi discovery timeout ms', '90000')
  .option('--wifi-pass <pass>', 'Wi‑Fi pairing password to use (default random)')
  .option('--wifi-qr', 'display QR code for Wireless debugging pairing')
  .option('--wifi-name <name>', 'custom Wireless debugging name (default: debug-XXXX)')
  .option('--wifi-pair <host:port>', 'pair with a specific host:port (bypass mDNS)')
  .option('--wifi-target <host:port>', 'connect to a specific host:port (bypass mDNS)')
  .option('-s, --serial <serial>', 'device serial')
  .option('-i, --interactive', 'interactively select device')
  .option('-b, --buffers <list>', 'comma-separated buffers (main,crash,system)', 'main,crash')
  .option('-p, --min-priority <P>', 'min priority V|D|I|W|E|F', 'I')
  .option('-t, --tags <list>', 'comma-separated include tags')
  .option('--filter-expr <expr...>', 'raw logcat filter expression segments')
  .option('--no-ai', 'disable AI analysis')
  .option('--model <name>', 'AI model to use')
  .option('--provider <provider>', 'AI provider to use (openai or gemini)')
  .option(
    '--openai-base-url <url>',
    'OpenAI-compatible API base URL (e.g., http://localhost:11434/v1)'
  )
  .option('--save-logs', 'save logs to file with timestamp')
  .option('--max-lines <number>', 'maximum lines to keep in memory', '5000')
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
  .option(
    '--ai-sample-per-signature <ms>',
    'min milliseconds between AI analyses for the same signature (default 1h)',
    () => process.env['LOGCAT_AI_SAMPLE_PER_SIGNATURE_MS'] ?? '3600000'
  )
  .option(
    '--ai-daily-budget <n>',
    'max AI analyses per calendar day (env LOGCAT_AI_BUDGET_PER_DAY)',
    () => process.env['LOGCAT_AI_BUDGET_PER_DAY'] ?? '50'
  )
  .action((opts: StreamOptions) => {
    void performStreamAction(opts).catch((err: unknown) => {
      console.error(chalk.red(`Streaming failed: ${getErrorMessage(err)}`));
      process.exit(1);
    });
  });
