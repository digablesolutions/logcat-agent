import chalk from 'chalk';
import type { ILogEntry, IPatternMatch } from './pipeline/types.js';
import type { AnalysisResult } from './ai/provider.js';
import type {
  RealtimeAnalysisResult,
  AnomalyDetectionResult,
  TrendAnalysisResult,
  PerformanceInsight,
  RealtimeEngineStats,
} from './ai/realtime/index.js';
import type { CounterMap } from './ingest/metrics.js';
import { getLogsPerMinute } from './sessionStats.js';
import type { BaseSessionStats, LogSessionStats, MultiDeviceSessionStats } from './sessionStats.js';

export type {
  BaseSessionStats,
  LogSessionStats,
  RealtimeSessionStats,
  MultiDeviceSessionStats,
  MultiDeviceSessionDeviceStats,
} from './sessionStats.js';

export type LogMetrics = Readonly<CounterMap>;

export interface RealtimeHeaderOptions {
  deviceSerial: string;
  model?: string | undefined;
  buffers: ReadonlyArray<string>;
  minPriority: string;
  aiModel: string;
  profileName: string;
  profileDescription: string;
  windowSize: number;
  analysisIntervalMs: number;
  anomalyThreshold: number;
  trendAnalysisEnabled: boolean;
  performanceMonitoringEnabled: boolean;
  proactiveAnalysisEnabled: boolean;
}

export interface MultiDeviceHeaderOptions {
  deviceCount: number;
  buffers: ReadonlyArray<string>;
  minPriority: string;
  tags?: string | undefined;
  aiEnabled: boolean;
}

export interface LogRenderer {
  renderHeader(deviceSerial: string, model: string | undefined, buffers: ReadonlyArray<string>, minPriority: string, tags?: string, aiEnabled?: boolean): void;
  renderRealtimeHeader(options: RealtimeHeaderOptions): void;
  renderMultiDeviceHeader(options: MultiDeviceHeaderOptions): void;
  renderEntry(entry: ILogEntry): void;
  renderMatch(match: IPatternMatch): void;
  renderAiAnalysis(providerName: string, result: AnalysisResult): void;
  renderRealtimeAnalysis(result: RealtimeAnalysisResult): void;
  renderAnomaly(anomaly: AnomalyDetectionResult): void;
  renderTrends(trends: ReadonlyArray<TrendAnalysisResult>): void;
  renderPerformanceInsight(insight: PerformanceInsight): void;
  renderStats(stats: LogSessionStats, runtime: number, metrics: LogMetrics): void;
  renderRealtimeStats(stats: BaseSessionStats, analysisStats: RealtimeEngineStats, runtime: number): void;
  renderMultiDeviceStats(stats: MultiDeviceSessionStats, runtime: number): void;
  renderSummary(stats: LogSessionStats, runtime: number): void;
  renderRealtimeSummary(stats: BaseSessionStats, analysisStats: RealtimeEngineStats, runtime: number): void;
  renderMultiDeviceSummary(stats: MultiDeviceSessionStats, runtime: number): void;
  renderError(message: string): void;
  renderWarning(message: string): void;
  renderInfo(message: string): void;
  renderSuccess(message: string): void;
  renderGray(message: string): void;
  renderNewline(): void;
}

const bannerDivider = chalk.cyan('━'.repeat(80));
const sectionDivider = chalk.gray('─'.repeat(60));

const renderBanner = (title: string, lines: ReadonlyArray<string>): void => {
  console.log(bannerDivider);
  console.log(chalk.cyan(title));
  lines.forEach((line) => {
    console.log(chalk.cyan(line));
  });
  console.log(bannerDivider);
  console.log();
};

const formatTimestamp = (timestamp: Date): string => {
  return (
    timestamp.toLocaleTimeString('en-GB', {
      hour12: false,
    }) +
    '.' +
    timestamp.getMilliseconds().toString().padStart(3, '0')
  );
};

const getPriorityColor = (entry: ILogEntry) => {
  return entry.priority === 'E' || entry.priority === 'F'
    ? chalk.red
    : entry.priority === 'W'
      ? chalk.yellow
      : entry.priority === 'D'
        ? chalk.blue
        : entry.priority === 'V'
          ? chalk.gray
          : chalk.white;
};

const getPriorityIcon = (entry: ILogEntry): string => {
  return entry.priority === 'E'
    ? '❌'
    : entry.priority === 'F'
      ? '💀'
      : entry.priority === 'W'
        ? '⚠️ '
        : entry.priority === 'I'
          ? 'ℹ️ '
          : entry.priority === 'D'
            ? '🐛'
            : '📝';
};

const renderHeader: LogRenderer['renderHeader'] = (deviceSerial, model, buffers, minPriority, tags, aiEnabled) => {
  renderBanner('🔍 Logcat Agent Session Started', [
    `📱 Device: ${deviceSerial}${model ? ` (${model})` : ''}`,
    `📊 Buffers: ${buffers.join(', ')}`,
    `🎯 Min Priority: ${minPriority}`,
    ...(tags ? [`🏷️  Tags: ${tags}`] : []),
    `🤖 AI Analysis: ${aiEnabled ? 'Enabled' : 'Disabled'}`,
  ]);
};

const renderRealtimeHeader: LogRenderer['renderRealtimeHeader'] = (options) => {
  renderBanner('🔮 Real-time AI Analysis Session Started', [
    `📱 Device: ${options.deviceSerial}${options.model ? ` (${options.model})` : ''}`,
    `📊 Buffers: ${options.buffers.join(', ')}`,
    `🎯 Min Priority: ${options.minPriority}`,
    `🤖 AI Model: ${options.aiModel}`,
    `📄 Profile: ${options.profileName} (${options.profileDescription})`,
    `📏 Window Size: ${options.windowSize}`,
    `⏱️  Analysis Interval: ${options.analysisIntervalMs}ms`,
    `🚨 Anomaly Threshold: ${options.anomalyThreshold}`,
    `📈 Trend Analysis: ${options.trendAnalysisEnabled ? 'Enabled' : 'Disabled'}`,
    `⚡ Performance Monitoring: ${options.performanceMonitoringEnabled ? 'Enabled' : 'Disabled'}`,
    `🔮 Proactive Analysis: ${options.proactiveAnalysisEnabled ? 'Enabled' : 'Disabled'}`,
  ]);
};

const renderMultiDeviceHeader: LogRenderer['renderMultiDeviceHeader'] = (options) => {
  renderBanner('📡 Multi-device Logcat Session Started', [
    `📱 Devices: ${options.deviceCount}`,
    `📊 Buffers: ${options.buffers.join(', ')}`,
    `🎯 Min Priority: ${options.minPriority}`,
    ...(options.tags ? [`🏷️  Tags: ${options.tags}`] : []),
    `🤖 AI Analysis: ${options.aiEnabled ? 'Enabled' : 'Disabled'}`,
  ]);
};

const renderEntry: LogRenderer['renderEntry'] = (entry) => {
  console.log(
    getPriorityColor(entry)(
      `${chalk.gray(formatTimestamp(entry.timestamp))} ${getPriorityIcon(entry)} [${entry.priority}] ${chalk.bold(entry.tag)}(${entry.pid}): ${entry.message.trim()}`
    )
  );
};

const renderMatch: LogRenderer['renderMatch'] = (match) => {
  console.log(chalk.bgRed.white(` 🚨 DETECTED: ${match.pattern.name} `));
};

const renderAiAnalysis: LogRenderer['renderAiAnalysis'] = (providerName, result) => {
  console.log(chalk.magenta(`🤖 AI (${providerName}): ${result.summary}`));
  if (result.likelyCauses?.length) {
    console.log(chalk.magenta('💡 Likely causes:'));
    for (const cause of result.likelyCauses) console.log(chalk.magenta(`   • ${cause}`));
  }
  if (result.suggestedNextSteps?.length) {
    console.log(chalk.magenta('🔧 Next steps:'));
    for (const step of result.suggestedNextSteps) {
      console.log(chalk.magenta(`   • ${step}`));
    }
  }
  console.log(sectionDivider);
};

const renderRealtimeAnalysis: LogRenderer['renderRealtimeAnalysis'] = (result) => {
  console.log(chalk.magenta('🔮 '), chalk.bold('Real-time AI Analysis'));
  console.log(chalk.magenta(`📊 Summary: ${result.summary}`));
  console.log(
    chalk.magenta(
      `⚡ Trigger: ${result.trigger}, Confidence: ${(result.confidence * 100).toFixed(1)}%`
    )
  );

  if (result.insights.length > 0) {
    console.log(chalk.magenta('💡 Insights:'));
    result.insights.forEach((insight) => console.log(chalk.magenta(`   • ${insight}`)));
  }

  if (result.recommendations.length > 0) {
    console.log(chalk.magenta('🔧 Recommendations:'));
    result.recommendations.forEach((recommendation) => {
      console.log(chalk.magenta(`   • ${recommendation}`));
    });
  }

  console.log(sectionDivider);
};

const renderAnomaly: LogRenderer['renderAnomaly'] = (anomaly) => {
  const severityColor =
    anomaly.severity === 'critical'
      ? chalk.red
      : anomaly.severity === 'high'
        ? chalk.yellow
        : chalk.cyan;

  console.log(severityColor('🚨 '), chalk.bold(`Anomaly Detected - ${anomaly.type}`));
  console.log(severityColor(`📋 ${anomaly.description}`));
  console.log(
    severityColor(
      `⚠️  Severity: ${anomaly.severity}, Confidence: ${(anomaly.confidence * 100).toFixed(1)}%`
    )
  );

  if (Object.keys(anomaly.metrics).length > 0) {
    console.log(severityColor('📈 Metrics:'));
    Object.entries(anomaly.metrics).forEach(([key, value]) => {
      console.log(severityColor(`   ${key}: ${String(value)}`));
    });
  }

  console.log(sectionDivider);
};

const renderTrends: LogRenderer['renderTrends'] = (trends) => {
  trends.forEach((trend) => {
    const trendColor =
      trend.severity === 'critical'
        ? chalk.red
        : trend.severity === 'high'
          ? chalk.yellow
          : chalk.blue;

    console.log(trendColor('📈 '), chalk.bold(`Trend Detected - ${trend.trendType}`));
    console.log(trendColor(`📊 ${trend.description}`));
    console.log(
      trendColor(
        `⏱️  Duration: ${Math.round((trend.endTime.getTime() - trend.startTime.getTime()) / 1000)}s`
      )
    );
    console.log(trendColor(`🎯 Confidence: ${(trend.confidence * 100).toFixed(1)}%`));

    if (trend.affectedTags.length > 0) {
      console.log(trendColor(`🏷️  Affected tags: ${trend.affectedTags.join(', ')}`));
    }
  });

  console.log(sectionDivider);
};

const renderPerformanceInsight: LogRenderer['renderPerformanceInsight'] = (insight) => {
  const performanceColor =
    insight.severity === 'critical'
      ? chalk.red
      : insight.severity === 'high'
        ? chalk.yellow
        : chalk.green;

  console.log(performanceColor('⚡ '), chalk.bold(`Performance Insight - ${insight.type}`));
  console.log(performanceColor(`📋 ${insight.description}`));
  console.log(performanceColor(`💡 ${insight.recommendation}`));

  if (Object.keys(insight.metrics).length > 0) {
    console.log(performanceColor('📊 Metrics:'));
    Object.entries(insight.metrics).forEach(([key, value]) => {
      console.log(performanceColor(`   ${key}: ${String(value)}`));
    });
  }

  console.log(sectionDivider);
};

const renderStats: LogRenderer['renderStats'] = (stats, runtime, metrics) => {
  const rate = getLogsPerMinute(stats.total, runtime);
  const pushedLoki = metrics['sink_loki_pushed_lines_total'] ?? 0;
  const writtenJsonl = metrics['sink_jsonl_written_total'] ?? 0;
  console.log(
    chalk.blue(
      `📊 [${runtime}s] ${stats.total} total | ${stats.errors}E ${stats.warnings}W | ${stats.patterns} patterns | ${stats.aiAnalyses} AI | ${rate}/min | 📦 JSONL ${writtenJsonl} | 📤 Loki ${pushedLoki}`
    )
  );
};

const renderRealtimeStats: LogRenderer['renderRealtimeStats'] = (stats, analysisStats, runtime) => {
  const rate = getLogsPerMinute(stats.total, runtime);
  console.log(
    chalk.blue(
      `📊 [${runtime}s] ${stats.total} logs | ${stats.errors}E ${stats.warnings}W | ${analysisStats.anomaliesDetected} anomalies | ${analysisStats.trendsDetected} trends | ${analysisStats.aiAnalyses} AI | ${rate}/min`
    )
  );
};

const renderMultiDeviceStats: LogRenderer['renderMultiDeviceStats'] = (stats, runtime) => {
  const rate = getLogsPerMinute(stats.total, runtime);
  console.log(
    chalk.blue(
      `📊 [${runtime}s] ${stats.total} logs | ${stats.activeDeviceCount}/${stats.deviceCount} devices active | ${stats.errors}E ${stats.warnings}W | ${stats.patterns} patterns | ${stats.aiAnalyses} AI | ${rate}/min`
    )
  );
};

const renderSummary: LogRenderer['renderSummary'] = (stats, runtime) => {
  console.log(`\n${bannerDivider}`);
  console.log(chalk.cyan('📊 Session Summary:'));
  console.log(chalk.cyan(`⏱️  Runtime: ${Math.floor(runtime / 60)}m ${runtime % 60}s`));
  console.log(chalk.cyan(`📝 Total logs: ${stats.total}`));
  console.log(chalk.cyan(`❌ Errors: ${stats.errors}`));
  console.log(chalk.cyan(`⚠️  Warnings: ${stats.warnings}`));
  console.log(chalk.cyan(`🚨 Patterns detected: ${stats.patterns}`));
  console.log(chalk.cyan(`🤖 AI analyses: ${stats.aiAnalyses}`));
  if (stats.total > 0) {
    const rate = getLogsPerMinute(stats.total, runtime);
    console.log(chalk.cyan(`📈 Average rate: ${rate} logs/min`));
  }
  console.log(bannerDivider);
};

const renderRealtimeSummary: LogRenderer['renderRealtimeSummary'] = (stats, analysisStats, runtime) => {
  console.log(`\n${bannerDivider}`);
  console.log(chalk.cyan('📊 Real-time Analysis Session Summary:'));
  console.log(chalk.cyan(`⏱️  Runtime: ${Math.floor(runtime / 60)}m ${runtime % 60}s`));
  console.log(chalk.cyan(`📝 Total logs: ${stats.total}`));
  console.log(chalk.cyan(`❌ Errors: ${stats.errors}`));
  console.log(chalk.cyan(`⚠️  Warnings: ${stats.warnings}`));
  console.log(chalk.cyan(`🚨 Anomalies detected: ${analysisStats.anomaliesDetected}`));
  console.log(chalk.cyan(`📈 Trends detected: ${analysisStats.trendsDetected}`));
  console.log(chalk.cyan(`🤖 AI analyses: ${analysisStats.aiAnalyses}`));
  console.log(chalk.cyan(`📊 Analysis queue: ${analysisStats.queueSize}`));
  if (stats.total > 0) {
    const rate = getLogsPerMinute(stats.total, runtime);
    console.log(chalk.cyan(`📈 Average rate: ${rate} logs/min`));
  }
  console.log(bannerDivider);
};

const renderMultiDeviceSummary: LogRenderer['renderMultiDeviceSummary'] = (stats, runtime) => {
  console.log(`\n${bannerDivider}`);
  console.log(chalk.cyan('📊 Multi-device Session Summary:'));
  console.log(chalk.cyan(`⏱️  Runtime: ${Math.floor(runtime / 60)}m ${runtime % 60}s`));
  console.log(chalk.cyan(`📱 Devices: ${stats.deviceCount} total, ${stats.activeDeviceCount} active`));
  console.log(chalk.cyan(`📝 Total logs: ${stats.total}`));
  console.log(chalk.cyan(`❌ Errors: ${stats.errors}`));
  console.log(chalk.cyan(`⚠️  Warnings: ${stats.warnings}`));
  console.log(chalk.cyan(`🚨 Patterns detected: ${stats.patterns}`));
  console.log(chalk.cyan(`🤖 AI analyses: ${stats.aiAnalyses}`));
  if (stats.total > 0) {
    const rate = getLogsPerMinute(stats.total, runtime);
    console.log(chalk.cyan(`📈 Average rate: ${rate} logs/min`));
  }

  Object.entries(stats.devices)
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([deviceSerial, deviceStats]) => {
      const status = deviceStats.closed ? 'closed' : 'active';
      console.log(
        chalk.cyan(
          `• ${deviceSerial}: ${deviceStats.total} logs | ${deviceStats.errors}E ${deviceStats.warnings}W | ${deviceStats.patterns} patterns | ${deviceStats.aiAnalyses} AI | ${status}`
        )
      );
    });

  console.log(bannerDivider);
};

const renderError: LogRenderer['renderError'] = (message) => {
  console.error(chalk.red(message));
};

const renderWarning: LogRenderer['renderWarning'] = (message) => {
  console.error(chalk.yellow(message));
};

const renderInfo: LogRenderer['renderInfo'] = (message) => {
  console.log(chalk.cyan(message));
};

const renderSuccess: LogRenderer['renderSuccess'] = (message) => {
  console.log(chalk.green(message));
};

const renderGray: LogRenderer['renderGray'] = (message) => {
  console.log(chalk.gray(message));
};

const renderNewline: LogRenderer['renderNewline'] = () => {
  console.log();
};

export const createConsoleLogRenderer = (): LogRenderer => {
  return {
    renderHeader,
    renderRealtimeHeader,
    renderMultiDeviceHeader,
    renderEntry,
    renderMatch,
    renderAiAnalysis,
    renderRealtimeAnalysis,
    renderAnomaly,
    renderTrends,
    renderPerformanceInsight,
    renderStats,
    renderRealtimeStats,
    renderMultiDeviceStats,
    renderSummary,
    renderRealtimeSummary,
    renderMultiDeviceSummary,
    renderError,
    renderWarning,
    renderInfo,
    renderSuccess,
    renderGray,
    renderNewline,
  };
};
