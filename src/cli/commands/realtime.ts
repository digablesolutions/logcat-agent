import { Command } from 'commander';
import chalk from 'chalk';
import { listDevices, spawnLogcatBinary, type Device } from '../../adb/adbClient.js';
import { attachLogcatParser } from '../../adb/logcatStream.js';
import { makeFilter } from '../../pipeline/filters.js';
import { RealtimeAnalysisEngine } from '../../ai/realtime/index.js';
import type {
  RealtimeAnalysisResult,
  AnomalyDetectionResult,
  TrendAnalysisResult,
  PerformanceInsight,
} from '../../ai/realtime/index.js';
import {
  getAnalysisProfile,
  listAnalysisProfiles,
  getProfileDescription,
} from '../../ai/profiles.js';
import { getErrorMessage } from '../../errors.js';
import { createConsoleLogRenderer } from '../../logRenderer.js';
import { renderReport } from '../../reporting.js';
import { createBaseSessionStats, getSessionRuntimeSeconds, recordEntryStats } from '../../sessionStats.js';
import {
  createAiProvider,
  parseBuffers,
  parseOptionalFloatFlagValue,
  parseOptionalIntegerFlagValue,
  parseTagMap,
  requirePriority,
} from '../logCommandSupport.js';
import { createSessionController, logSelectedDevice, selectStreamingDevice } from '../sessionSupport.js';

type RealtimeOptions = Readonly<{
  serial?: string;
  interactive?: boolean;
  buffers?: string;
  minPriority?: string;
  tags?: string;
  filterExpr?: string[];
  model?: string;
  provider?: 'openai' | 'gemini';
  openaiBaseUrl?: string;
  profile: string;
  windowSize?: string;
  analysisInterval?: string;
  anomalyThreshold?: string;
  disableTrends?: boolean;
  disablePerformance?: boolean;
  disableProactive?: boolean;
  listProfiles?: boolean;
}>;

const performRealtimeAction = async (opts: RealtimeOptions): Promise<void> => {
  if (opts.listProfiles) {
    console.log(chalk.cyan('📊 Available Analysis Profiles:'));
    console.log();
    listAnalysisProfiles().forEach((profile) => {
      console.log(chalk.cyan(`  ${profile}:`));
      console.log(chalk.gray(`    ${getProfileDescription(profile)}`));
      console.log();
    });
    process.exit(0);
  }

  const allDevices = await listDevices();
  const devices: ReadonlyArray<Device> = allDevices;
  const selectedDevice = selectStreamingDevice(devices, { serial: opts.serial });
  const serial = selectedDevice.serial;
  logSelectedDevice(selectedDevice, console.log);
  const minPriority = requirePriority(opts.minPriority);
  const tagMap = parseTagMap(opts.tags);

  const filter = makeFilter({
    minPriority,
    tags: tagMap,
  });

  const buffers = parseBuffers(opts.buffers);

  const aiProvider = createAiProvider({
    provider: opts.provider,
    model: opts.model,
    openaiApiKey: process.env['OPENAI_API_KEY'],
    openaiBaseUrl:
      opts.openaiBaseUrl || process.env['LOGCAT_OPENAI_BASE_URL'] || process.env['OPENAI_BASE_URL'],
    geminiApiKey: process.env['GEMINI_API_KEY'],
  });
  const profileConfig = getAnalysisProfile(opts.profile);
  const renderer = createConsoleLogRenderer();
  const normalizedWindowSize = parseOptionalIntegerFlagValue(opts.windowSize, '--window-size', {
    minimum: 1,
  });
  const normalizedAnalysisInterval = parseOptionalIntegerFlagValue(
    opts.analysisInterval,
    '--analysis-interval',
    { minimum: 1 }
  );
  const normalizedAnomalyThreshold = parseOptionalFloatFlagValue(
    opts.anomalyThreshold,
    '--anomaly-threshold',
    { minimum: 0, maximum: 1 }
  );
  const realtimeConfig = {
    ...profileConfig,
    ...(normalizedWindowSize !== undefined && { windowSize: normalizedWindowSize }),
    ...(normalizedAnalysisInterval !== undefined && { analysisInterval: normalizedAnalysisInterval }),
    ...(normalizedAnomalyThreshold !== undefined && { anomalyThreshold: normalizedAnomalyThreshold }),
    ...(opts.disableTrends && { enableTrendAnalysis: false }),
    ...(opts.disablePerformance && { enablePerformanceMonitoring: false }),
    ...(opts.disableProactive && { enableProactiveAnalysis: false }),
  };

  const realtimeEngine = new RealtimeAnalysisEngine(aiProvider, realtimeConfig);

  // Set up event handlers
  realtimeEngine.on('realtimeAnalysis', (analysis: RealtimeAnalysisResult) => {
    renderer.renderRealtimeAnalysis(analysis);
  });

  realtimeEngine.on('anomalyDetected', (anomaly: AnomalyDetectionResult) => {
    renderer.renderAnomaly(anomaly);
  });

  realtimeEngine.on('trendsDetected', (trends: TrendAnalysisResult[]) => {
    renderer.renderTrends(trends);
  });

  realtimeEngine.on('performanceInsight', (insight: PerformanceInsight) => {
    renderer.renderPerformanceInsight(insight);
  });

  realtimeEngine.on('analysisError', (error: unknown) => {
    renderer.renderError(`❌ Analysis error: ${getErrorMessage(error)}`);
  });

  realtimeEngine.on('report', (report) => {
    renderReport(renderer, report);
  });

  renderer.renderRealtimeHeader({
    deviceSerial: serial,
    model: selectedDevice.model,
    buffers,
    minPriority: minPriority || 'I',
    aiModel: opts.model || 'default',
    profileName: opts.profile,
    profileDescription: getProfileDescription(opts.profile),
    windowSize: realtimeConfig.windowSize,
    analysisIntervalMs: realtimeConfig.analysisInterval,
    anomalyThreshold: realtimeConfig.anomalyThreshold,
    trendAnalysisEnabled: realtimeConfig.enableTrendAnalysis,
    performanceMonitoringEnabled: realtimeConfig.enablePerformanceMonitoring,
    proactiveAnalysisEnabled: realtimeConfig.enableProactiveAnalysis,
  });

  await realtimeEngine.start();

  const proc = spawnLogcatBinary({ serial, buffers, filterExpr: opts.filterExpr });
  const stats = createBaseSessionStats();

  const statsInterval = setInterval(() => {
    void (async () => {
      const runtime = getSessionRuntimeSeconds(stats.startTime);
      const analysisStats = await realtimeEngine.getStats();

      renderer.renderRealtimeStats(stats, analysisStats, runtime);
    })();
  }, 30000);

  attachLogcatParser(
    proc,
    (entry) => {
      if (!filter(entry)) return;

      recordEntryStats(stats, entry);
      renderer.renderEntry(entry);

      void realtimeEngine.processLogEntry(entry);
    },
    (err) => {
      renderer.renderError(`Parser error: ${getErrorMessage(err)}`);
    }
  );

  proc.stderr?.on('data', (d) => {
    const s = d.toString();
    if (s.includes('device unauthorized')) {
      renderer.renderWarning('Device unauthorized. Please accept ADB authorization on the device.');
    } else {
      renderer.renderGray(`[adb] ${s.trim()}`);
    }
  });

  const session = createSessionController({
    cleanup: async (reason) => {
      clearInterval(statsInterval);
      await realtimeEngine.stop();

      const runtime = getSessionRuntimeSeconds(stats.startTime);
      const analysisStats = await realtimeEngine.getStats();

      renderer.renderRealtimeSummary(stats, analysisStats, runtime);

      if (reason !== 'source-close') {
        proc.kill('SIGINT');
      }
    },
    onError: (error: unknown) => {
      renderer.renderError(`Shutdown failed: ${getErrorMessage(error)}`);
      proc.kill('SIGINT');
    },
  });

  proc.on('close', () => {
    void session.shutdown('source-close');
  });

  await session.completion;
};

export const realtimeCmd = new Command('realtime')
  .description('Real-time AI analysis of logcat streams with proactive insights')
  .option('-s, --serial <serial>', 'device serial')
  .option('-i, --interactive', 'interactively select device')
  .option('-b, --buffers <list>', 'comma-separated buffers (main,crash,system)', 'main,crash')
  .option('-p, --min-priority <P>', 'min priority V|D|I|W|E|F', 'I')
  .option('-t, --tags <list>', 'comma-separated include tags')
  .option('--filter-expr <expr...>', 'raw logcat filter expression segments')
  .option('--model <name>', 'AI model to use')
  .option('--provider <provider>', 'AI provider to use (openai or gemini)', 'openai')
  .option(
    '--openai-base-url <url>',
    'OpenAI-compatible API base URL (e.g., http://localhost:11434/v1)'
  )
  .option(
    '--profile <name>',
    'analysis profile (development, production, debug, performance, minimal)',
    'development'
  )
  .option('--window-size <number>', 'analysis window size (overrides profile)')
  .option('--analysis-interval <ms>', 'analysis interval in milliseconds (overrides profile)')
  .option('--anomaly-threshold <number>', 'anomaly detection threshold 0-1 (overrides profile)')
  .option('--disable-trends', 'disable trend analysis')
  .option('--disable-performance', 'disable performance monitoring')
  .option('--disable-proactive', 'disable proactive analysis')
  .option('--list-profiles', 'list available analysis profiles and exit')
  .action((opts: RealtimeOptions) => {
    void performRealtimeAction(opts).catch((err: unknown) => {
      console.error(chalk.red(`Real-time analysis failed: ${getErrorMessage(err)}`));
      process.exit(1);
    });
  });
