import type { ILogEntry } from '../../pipeline/types.js';
import type {
  TrendAnalysisResult,
  TrendAnalysisConfig,
  AnalysisStats,
  TrendAnalyzerState,
  TrendAnalyzerTimeSeriesPoint,
} from './types.js';

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const createEmptyStats = (): AnalysisStats => ({
  totalAnalyses: 0,
  anomaliesDetected: 0,
  trendsDetected: 0,
  performanceIssues: 0,
  avgConfidence: 0,
});

const normalizeStats = (value: unknown): AnalysisStats => {
  if (!value || typeof value !== 'object') {
    return createEmptyStats();
  }

  const stats = value as Partial<Record<keyof AnalysisStats, unknown>>;
  const lastAnalysisTimeRaw = stats.lastAnalysisTime;
  const lastAnalysisTime =
    lastAnalysisTimeRaw instanceof Date
      ? lastAnalysisTimeRaw
      : typeof lastAnalysisTimeRaw === 'string' || typeof lastAnalysisTimeRaw === 'number'
        ? new Date(lastAnalysisTimeRaw)
        : undefined;

  return {
    totalAnalyses: isFiniteNumber(stats.totalAnalyses) ? stats.totalAnalyses : 0,
    anomaliesDetected: isFiniteNumber(stats.anomaliesDetected) ? stats.anomaliesDetected : 0,
    trendsDetected: isFiniteNumber(stats.trendsDetected) ? stats.trendsDetected : 0,
    performanceIssues: isFiniteNumber(stats.performanceIssues) ? stats.performanceIssues : 0,
    avgConfidence: isFiniteNumber(stats.avgConfidence) ? stats.avgConfidence : 0,
    ...(lastAnalysisTime && !Number.isNaN(lastAnalysisTime.getTime()) ? { lastAnalysisTime } : {}),
  };
};

const isTrendAnalyzerPoint = (value: unknown): value is TrendAnalyzerTimeSeriesPoint =>
  Boolean(
    value &&
      typeof value === 'object' &&
      isFiniteNumber((value as Record<string, unknown>)['timestamp']) &&
      isFiniteNumber((value as Record<string, unknown>)['value'])
  );

const parseTimeSeriesEntries = (
  value: unknown
): Array<[string, TrendAnalyzerTimeSeriesPoint[]]> => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap(entry => {
    if (
      Array.isArray(entry) &&
      entry.length === 2 &&
      typeof entry[0] === 'string' &&
      Array.isArray(entry[1])
    ) {
      const points = entry[1].filter(isTrendAnalyzerPoint);
      return [[entry[0], points]];
    }

    return [];
  });
};

/**
 * Analyzes trends in log data over time to identify patterns and changes
 */
export class TrendAnalyzer {
  private config: TrendAnalysisConfig;
  private timeSeriesData: Map<string, TrendAnalyzerTimeSeriesPoint[]> = new Map();
  private stats: AnalysisStats;

  constructor(config?: Partial<TrendAnalysisConfig>) {
    this.config = {
      timeWindowMinutes: 15,
      minimumDataPoints: 10,
      changeThreshold: 0.3,
      smoothingWindow: 5,
      ...config,
    };

    this.stats = createEmptyStats();
  }

  /**
   * Analyze trends in the provided log buffer
   */
  analyze(logBuffer: ILogEntry[]): TrendAnalysisResult[] {
    if (logBuffer.length < this.config.minimumDataPoints) {
      return [];
    }

    this.stats.totalAnalyses++;
    this.updateTimeSeries(logBuffer);
    const trends: TrendAnalysisResult[] = [];

    // Analyze error rate trends
    const errorTrend = this.analyzeErrorRateTrend(logBuffer);
    if (errorTrend) trends.push(errorTrend);

    // Analyze warning trends
    const warningTrend = this.analyzeWarningTrend(logBuffer);
    if (warningTrend) trends.push(warningTrend);

    // Analyze tag frequency trends
    const tagTrends = this.analyzeTagFrequencyTrends(logBuffer);
    trends.push(...tagTrends);

    // Analyze performance trends
    const perfTrends = this.analyzePerformanceTrends(logBuffer);
    trends.push(...perfTrends);

    this.stats.trendsDetected += trends.length;
    return trends;
  }

  /**
   * Analyze error rate trends over time
   */
  private analyzeErrorRateTrend(logBuffer: ILogEntry[]): TrendAnalysisResult | null {
    const timeWindow = this.config.timeWindowMinutes * 60 * 1000;
    const now = Date.now();
    const cutoff = now - timeWindow;

    // Split into time buckets
    const bucketSize = timeWindow / 10; // 10 buckets
    const buckets = Array(10)
      .fill(0)
      .map((_, i) => ({
        startTime: cutoff + i * bucketSize,
        endTime: cutoff + (i + 1) * bucketSize,
        errors: 0,
        total: 0,
      }));

    // Fill buckets with data
    logBuffer.forEach(entry => {
      const timestamp = entry.timestamp.getTime();
      if (timestamp >= cutoff) {
        const bucketIndex = Math.floor((timestamp - cutoff) / bucketSize);
        if (bucketIndex >= 0 && bucketIndex < buckets.length) {
          const bucket = buckets[bucketIndex]!;
          bucket.total++;
          if (entry.priority === 'E' || entry.priority === 'F') {
            bucket.errors++;
          }
        }
      }
    });

    // Calculate error rates
    const errorRates = buckets.map(bucket => (bucket.total > 0 ? bucket.errors / bucket.total : 0));

    // Smooth the data
    const smoothedRates = this.smoothTimeSeries(errorRates);

    // Detect trend
    const trend = this.detectTrend(smoothedRates);
    if (trend.isSignificant) {
      const baseline = smoothedRates.slice(0, 5).reduce((sum, rate) => sum + rate, 0) / 5;
      const current = smoothedRates.slice(-5).reduce((sum, rate) => sum + rate, 0) / 5;

      return {
        timestamp: new Date(),
        trendType: 'error_increase',
        description: `Error rate ${trend.direction === 'increasing' ? 'increasing' : 'decreasing'}: ${(current * 100).toFixed(1)}% vs ${(baseline * 100).toFixed(1)}%`,
        startTime: new Date(cutoff),
        endTime: new Date(now),
        confidence: trend.confidence,
        metrics: {
          baseline,
          current,
          change: current - baseline,
          changePercent: baseline > 0 ? ((current - baseline) / baseline) * 100 : 0,
        },
        affectedTags: this.getTopErrorTags(logBuffer),
        severity: this.calculateTrendSeverity(trend.confidence, current - baseline),
      };
    }

    return null;
  }

  /**
   * Analyze warning trends
   */
  private analyzeWarningTrend(logBuffer: ILogEntry[]): TrendAnalysisResult | null {
    const recentWarnings = logBuffer.filter(entry => entry.priority === 'W');
    if (recentWarnings.length < this.config.minimumDataPoints / 2) {
      return null;
    }

    // Group warnings by time intervals
    const intervals = this.groupByTimeIntervals(recentWarnings, 5); // 5-minute intervals
    if (intervals.length < 3) return null;

    const counts = intervals.map(interval => interval.length);
    const trend = this.detectTrend(counts);

    if (trend.isSignificant && trend.direction === 'increasing') {
      const baseline =
        counts.slice(0, Math.floor(counts.length / 2)).reduce((sum, c) => sum + c, 0) /
        Math.floor(counts.length / 2);
      const current =
        counts.slice(-Math.floor(counts.length / 2)).reduce((sum, c) => sum + c, 0) /
        Math.floor(counts.length / 2);

      return {
        timestamp: new Date(),
        trendType: 'warning_spike',
        description: `Warning frequency increasing: ${current.toFixed(1)}/interval vs ${baseline.toFixed(1)}/interval`,
        startTime: recentWarnings[0]!.timestamp,
        endTime: recentWarnings[recentWarnings.length - 1]!.timestamp,
        confidence: trend.confidence,
        metrics: {
          baseline,
          current,
          change: current - baseline,
          changePercent: baseline > 0 ? ((current - baseline) / baseline) * 100 : 0,
        },
        affectedTags: [...new Set(recentWarnings.map(w => w.tag))],
        severity: this.calculateTrendSeverity(trend.confidence, (current - baseline) / 10),
      };
    }

    return null;
  }

  /**
   * Analyze tag frequency trends
   */
  private analyzeTagFrequencyTrends(logBuffer: ILogEntry[]): TrendAnalysisResult[] {
    const trends: TrendAnalysisResult[] = [];
    const tagCounts = new Map<string, number>();

    // Count occurrences by tag
    logBuffer.forEach(entry => {
      tagCounts.set(entry.tag, (tagCounts.get(entry.tag) || 0) + 1);
    });

    // Focus on tags with significant activity
    const significantTags = Array.from(tagCounts.entries())
      .filter(([_, count]) => count >= this.config.minimumDataPoints / 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5); // Top 5 most active tags

    for (const [tag, _] of significantTags) {
      const tagEntries = logBuffer.filter(entry => entry.tag === tag);
      const intervals = this.groupByTimeIntervals(tagEntries, 3); // 3-minute intervals

      if (intervals.length >= 5) {
        const counts = intervals.map(interval => interval.length);
        const trend = this.detectTrend(counts);

        if (trend.isSignificant) {
          const baseline =
            counts.slice(0, Math.floor(counts.length / 2)).reduce((sum, c) => sum + c, 0) /
            Math.floor(counts.length / 2);
          const current =
            counts.slice(-Math.floor(counts.length / 2)).reduce((sum, c) => sum + c, 0) /
            Math.floor(counts.length / 2);

          trends.push({
            timestamp: new Date(),
            trendType: 'tag_frequency_change',
            description: `Tag "${tag}" frequency ${trend.direction}: ${current.toFixed(1)}/interval vs ${baseline.toFixed(1)}/interval`,
            startTime: tagEntries[0]!.timestamp,
            endTime: tagEntries[tagEntries.length - 1]!.timestamp,
            confidence: trend.confidence,
            metrics: {
              baseline,
              current,
              change: current - baseline,
              changePercent: baseline > 0 ? ((current - baseline) / baseline) * 100 : 0,
            },
            affectedTags: [tag],
            severity: this.calculateTrendSeverity(
              trend.confidence,
              Math.abs(current - baseline) / 5
            ),
          });
        }
      }
    }

    return trends;
  }

  /**
   * Analyze performance-related trends
   */
  private analyzePerformanceTrends(logBuffer: ILogEntry[]): TrendAnalysisResult[] {
    const trends: TrendAnalysisResult[] = [];

    // Look for performance-related log entries
    const perfEntries = logBuffer.filter(
      entry =>
        entry.message.toLowerCase().includes('gc') ||
        entry.message.toLowerCase().includes('memory') ||
        entry.message.toLowerCase().includes('anr') ||
        entry.message.toLowerCase().includes('timeout') ||
        entry.message.toLowerCase().includes('slow') ||
        entry.message.toLowerCase().includes('lag')
    );

    if (perfEntries.length >= this.config.minimumDataPoints / 3) {
      const intervals = this.groupByTimeIntervals(perfEntries, 5);

      if (intervals.length >= 3) {
        const counts = intervals.map(interval => interval.length);
        const trend = this.detectTrend(counts);

        if (trend.isSignificant && trend.direction === 'increasing') {
          const baseline =
            counts.slice(0, Math.floor(counts.length / 2)).reduce((sum, c) => sum + c, 0) /
            Math.floor(counts.length / 2);
          const current =
            counts.slice(-Math.floor(counts.length / 2)).reduce((sum, c) => sum + c, 0) /
            Math.floor(counts.length / 2);

          trends.push({
            timestamp: new Date(),
            trendType: 'performance_degradation',
            description: `Performance issues increasing: ${current.toFixed(1)}/interval vs ${baseline.toFixed(1)}/interval`,
            startTime: perfEntries[0]!.timestamp,
            endTime: perfEntries[perfEntries.length - 1]!.timestamp,
            confidence: trend.confidence,
            metrics: {
              baseline,
              current,
              change: current - baseline,
              changePercent: baseline > 0 ? ((current - baseline) / baseline) * 100 : 0,
            },
            affectedTags: [...new Set(perfEntries.map(e => e.tag))],
            severity: this.calculateTrendSeverity(trend.confidence, current - baseline),
          });
        }
      }
    }

    return trends;
  }

  /**
   * Detect trend in a time series
   */
  private detectTrend(values: number[]): {
    isSignificant: boolean;
    direction: 'increasing' | 'decreasing' | 'stable';
    confidence: number;
  } {
    if (values.length < 3) {
      return { isSignificant: false, direction: 'stable', confidence: 0 };
    }

    // Calculate linear regression slope
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + i * val, 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    // Calculate correlation coefficient
    const avgY = sumY / n;
    const avgX = sumX / n;

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const v = values[i]!;
      numerator += (i - avgX) * (v - avgY);
      denomX += Math.pow(i - avgX, 2);
      denomY += Math.pow(v - avgY, 2);
    }

    const correlation = numerator / Math.sqrt(denomX * denomY);
    const confidence = Math.abs(correlation);

    const isSignificant = confidence > this.config.changeThreshold;
    const direction = slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'stable';

    return { isSignificant, direction, confidence };
  }

  /**
   * Smooth time series data using moving average
   */
  private smoothTimeSeries(values: number[]): number[] {
    const windowSize = Math.min(this.config.smoothingWindow, values.length);
    const smoothed: number[] = [];

    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(values.length, start + windowSize);
      const window = values.slice(start, end);
      const average = window.reduce((sum, val) => sum + val, 0) / window.length;
      smoothed.push(average);
    }

    return smoothed;
  }

  /**
   * Group log entries by time intervals
   */
  private groupByTimeIntervals(entries: ILogEntry[], intervalMinutes: number): ILogEntry[][] {
    if (entries.length === 0) return [];

    const intervalMs = intervalMinutes * 60 * 1000;
    const firstTime = entries[0]!.timestamp.getTime();
    const intervals: ILogEntry[][] = [];

    let currentInterval: ILogEntry[] = [];
    let currentIntervalStart = firstTime;

    for (const entry of entries) {
      const entryTime = entry.timestamp.getTime();

      if (entryTime >= currentIntervalStart + intervalMs) {
        if (currentInterval.length > 0) {
          intervals.push(currentInterval);
        }
        currentInterval = [entry];
        currentIntervalStart = Math.floor(entryTime / intervalMs) * intervalMs;
      } else {
        currentInterval.push(entry);
      }
    }

    if (currentInterval.length > 0) {
      intervals.push(currentInterval);
    }

    return intervals;
  }

  /**
   * Get top tags generating errors
   */
  private getTopErrorTags(logBuffer: ILogEntry[]): string[] {
    const errorTagCounts = new Map<string, number>();

    logBuffer
      .filter(entry => entry.priority === 'E' || entry.priority === 'F')
      .forEach(entry => {
        errorTagCounts.set(entry.tag, (errorTagCounts.get(entry.tag) || 0) + 1);
      });

    return Array.from(errorTagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, _]) => tag);
  }

  /**
   * Calculate trend severity
   */
  private calculateTrendSeverity(
    confidence: number,
    changeValue: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    const severity = confidence * Math.abs(changeValue);

    if (severity >= 0.8) return 'critical';
    if (severity >= 0.6) return 'high';
    if (severity >= 0.4) return 'medium';
    return 'low';
  }

  /**
   * Update time series data
   */
  private updateTimeSeries(_logBuffer: ILogEntry[]): void {
    // This could be expanded to maintain more detailed time series data
    // For now, we process the data on-demand in the analysis methods
  }

  /**
   * Get analysis statistics
   */
  getStats(): AnalysisStats {
    return { ...this.stats };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TrendAnalysisConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Export current state for persistence
   */
  getState(): TrendAnalyzerState {
    return {
      timeSeriesData: Array.from(this.timeSeriesData.entries()),
      stats: this.stats,
    };
  }

  /**
   * Restore state from persistence
   */
  restoreState(state: TrendAnalyzerState | null | undefined): void {
    if (!state) return;

    this.timeSeriesData = new Map(parseTimeSeriesEntries(state.timeSeriesData));
    this.stats = normalizeStats(state.stats);
  }
}
