import type { ILogEntry } from '../../pipeline/types.js';
import type {
  AnomalyDetectionResult,
  AnomalyDetectionConfig,
  AnalysisStats,
  AnomalyDetectorState,
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

const parseStringNumberEntries = (value: unknown): Array<[string, number]> => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap(entry => {
    if (
      Array.isArray(entry) &&
      entry.length === 2 &&
      typeof entry[0] === 'string' &&
      isFiniteNumber(entry[1])
    ) {
      return [[entry[0], entry[1]]];
    }

    return [];
  });
};

const parseStringNumberArrayEntries = (value: unknown): Array<[string, number[]]> => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap(entry => {
    if (
      Array.isArray(entry) &&
      entry.length === 2 &&
      typeof entry[0] === 'string' &&
      Array.isArray(entry[1]) &&
      entry[1].every(isFiniteNumber)
    ) {
      return [[entry[0], [...entry[1]]]];
    }

    return [];
  });
};

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

/**
 * Detects anomalies in log streams using statistical analysis and pattern recognition
 */
export class AnomalyDetector {
  private config: AnomalyDetectionConfig;
  private baselineMetrics: Map<string, number> = new Map();
  private recentEntries: ILogEntry[] = [];
  private tagFrequencies: Map<string, number[]> = new Map();
  private errorPatterns: Map<string, number> = new Map();
  private stats: AnalysisStats;

  constructor(threshold: number, config?: Partial<AnomalyDetectionConfig>) {
    this.config = {
      frequencyThreshold: threshold,
      errorSpikeThreshold: 0.5,
      patternDeviationThreshold: 0.6,
      timeWindowMinutes: 5,
      minSampleSize: 20,
      ...config,
    };

    this.stats = createEmptyStats();
  }

  /**
   * Detect anomalies in a new log entry
   */
  detect(entry: ILogEntry): AnomalyDetectionResult | null {
    this.stats.totalAnalyses++;
    this.addToHistory(entry);
    this.updateMetrics(entry);

    // Only start detecting after we have enough data
    if (this.recentEntries.length < this.config.minSampleSize) {
      return null;
    }

    const anomalies: AnomalyDetectionResult[] = [];

    // Check for frequency anomalies
    const frequencyAnomaly = this.detectFrequencyAnomaly(entry);
    if (frequencyAnomaly) anomalies.push(frequencyAnomaly);

    // Check for error spikes
    const errorSpike = this.detectErrorSpike();
    if (errorSpike) anomalies.push(errorSpike);

    // Check for unusual tag patterns
    const tagAnomaly = this.detectUnusualTagPattern(entry);
    if (tagAnomaly) anomalies.push(tagAnomaly);

    // Check for new error patterns
    const patternAnomaly = this.detectNewErrorPattern(entry);
    if (patternAnomaly) anomalies.push(patternAnomaly);

    // Return the highest severity anomaly
    if (anomalies.length > 0) {
      this.stats.anomaliesDetected++;
      return (
        anomalies.sort(
          (a, b) => this.getSeverityScore(b.severity) - this.getSeverityScore(a.severity)
        )[0] ?? null
      );
    }

    return null;
  }

  /**
   * Detect frequency anomalies for tags
   */
  private detectFrequencyAnomaly(entry: ILogEntry): AnomalyDetectionResult | null {
    const tag = entry.tag;
    const recentCount = this.recentEntries.filter(e => e.tag === tag).length;
    const baseline = this.baselineMetrics.get(`tag_${tag}`) || 0;

    if (baseline > 0 && recentCount > baseline * (1 + this.config.frequencyThreshold)) {
      const confidence = Math.min((recentCount - baseline) / baseline, 1.0);

      return {
        timestamp: new Date(),
        type: 'frequency',
        severity: this.calculateSeverity(confidence),
        description: `Tag "${tag}" frequency spike: ${recentCount} vs baseline ${baseline.toFixed(1)}`,
        affectedEntries: this.recentEntries.filter(e => e.tag === tag),
        confidence,
        metrics: {
          current: recentCount,
          baseline,
          increase: ((recentCount - baseline) / baseline) * 100,
        },
      };
    }

    return null;
  }

  /**
   * Detect spikes in error/fatal messages
   */
  private detectErrorSpike(): AnomalyDetectionResult | null {
    const timeWindow = this.config.timeWindowMinutes * 60 * 1000;
    const cutoff = new Date(Date.now() - timeWindow);

    const recentErrors = this.recentEntries.filter(
      e => e.timestamp >= cutoff && (e.priority === 'E' || e.priority === 'F')
    );

    const errorRate = recentErrors.length / this.recentEntries.length;
    const baselineErrorRate = this.baselineMetrics.get('error_rate') || 0.05;

    if (errorRate > baselineErrorRate * (1 + this.config.errorSpikeThreshold) && errorRate > 0.1) {
      const confidence = Math.min((errorRate - baselineErrorRate) / baselineErrorRate, 1.0);

      return {
        timestamp: new Date(),
        type: 'error_spike',
        severity: this.calculateSeverity(confidence),
        description: `Error spike detected: ${(errorRate * 100).toFixed(1)}% vs baseline ${(baselineErrorRate * 100).toFixed(1)}%`,
        affectedEntries: recentErrors,
        confidence,
        metrics: {
          current: errorRate,
          baseline: baselineErrorRate,
          count: recentErrors.length,
        },
      };
    }

    return null;
  }

  /**
   * Detect unusual tag activity patterns
   */
  private detectUnusualTagPattern(entry: ILogEntry): AnomalyDetectionResult | null {
    const tag = entry.tag;
    const frequencies = this.tagFrequencies.get(tag) || [];

    if (frequencies.length < 5) return null; // Need more data

    const current = frequencies[frequencies.length - 1];
    if (current === undefined) return null;
    const average = frequencies.reduce((sum, f) => sum + f, 0) / frequencies.length;
    const stdDev = Math.sqrt(
      frequencies.reduce((sum, f) => sum + Math.pow(f - average, 2), 0) / frequencies.length
    );

    // Check if current frequency is significantly different from pattern
    if (stdDev > 0 && Math.abs(current - average) > stdDev * 2) {
      const confidence = Math.min(Math.abs(current - average) / (stdDev * 2), 1.0);

      return {
        timestamp: new Date(),
        type: 'unusual_tag',
        severity: this.calculateSeverity(confidence * 0.7), // Lower severity for tag patterns
        description: `Unusual activity pattern for tag "${tag}": ${current} vs average ${average.toFixed(1)}`,
        affectedEntries: [entry],
        confidence,
        metrics: {
          current,
          average,
          standardDeviation: stdDev,
          deviation: Math.abs(current - average),
        },
      };
    }

    return null;
  }

  /**
   * Detect new or unusual error patterns
   */
  private detectNewErrorPattern(entry: ILogEntry): AnomalyDetectionResult | null {
    if (entry.priority !== 'E' && entry.priority !== 'F') return null;

    // Extract error signature (first few words of message)
    const signature = entry.message.split(/\s+/).slice(0, 5).join(' ');
    const currentCount = this.errorPatterns.get(signature) || 0;

    if (currentCount === 0) {
      // New error pattern
      return {
        timestamp: new Date(),
        type: 'pattern',
        severity: 'medium',
        description: `New error pattern detected: "${signature}"`,
        affectedEntries: [entry],
        confidence: 0.8,
        metrics: {
          occurrences: 1,
          isNew: 1,
        },
      };
    }

    return null;
  }

  /**
   * Add entry to history and maintain window size
   */
  private addToHistory(entry: ILogEntry): void {
    this.recentEntries.push(entry);

    // Maintain time window
    const cutoff = new Date(Date.now() - this.config.timeWindowMinutes * 60 * 1000);
    this.recentEntries = this.recentEntries.filter(e => e.timestamp >= cutoff);
  }

  /**
   * Update baseline metrics
   */
  private updateMetrics(entry: ILogEntry): void {
    // Update tag frequency baselines
    const tag = entry.tag;
    const tagKey = `tag_${tag}`;
    const currentBaseline = this.baselineMetrics.get(tagKey) || 0;
    const newBaseline = currentBaseline * 0.9 + 1 * 0.1; // Exponential moving average
    this.baselineMetrics.set(tagKey, newBaseline);

    // Update error rate baseline
    const isError = entry.priority === 'E' || entry.priority === 'F';
    const errorRate = this.baselineMetrics.get('error_rate') || 0.05;
    const newErrorRate = errorRate * 0.95 + (isError ? 1 : 0) * 0.05;
    this.baselineMetrics.set('error_rate', newErrorRate);

    // Update tag frequency tracking
    if (!this.tagFrequencies.has(tag)) {
      this.tagFrequencies.set(tag, []);
    }
    const frequencies = this.tagFrequencies.get(tag)!;
    frequencies.push(1);
    if (frequencies.length > 20) frequencies.shift(); // Keep only recent data

    // Update error patterns
    if (isError) {
      const signature = entry.message.split(/\s+/).slice(0, 5).join(' ');
      this.errorPatterns.set(signature, (this.errorPatterns.get(signature) || 0) + 1);
    }
  }

  /**
   * Calculate severity based on confidence
   */
  private calculateSeverity(confidence: number): 'low' | 'medium' | 'high' | 'critical' {
    if (confidence >= 0.9) return 'critical';
    if (confidence >= 0.7) return 'high';
    if (confidence >= 0.5) return 'medium';
    return 'low';
  }

  /**
   * Get numeric score for severity
   */
  private getSeverityScore(severity: string): number {
    switch (severity) {
      case 'critical':
        return 4;
      case 'high':
        return 3;
      case 'medium':
        return 2;
      case 'low':
        return 1;
      default:
        return 0;
    }
  }

  /**
   * Get current statistics
   */
  getStats(): AnalysisStats {
    return { ...this.stats };
  }

  /**
   * Reset baseline metrics (useful for new sessions)
   */
  reset(): void {
    this.baselineMetrics.clear();
    this.recentEntries = [];
    this.tagFrequencies.clear();
    this.errorPatterns.clear();
    this.stats = createEmptyStats();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AnomalyDetectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Export current state for persistence
   */
  getState(): AnomalyDetectorState {
    return {
      baselineMetrics: Array.from(this.baselineMetrics.entries()),
      tagFrequencies: Array.from(this.tagFrequencies.entries()),
      errorPatterns: Array.from(this.errorPatterns.entries()),
      stats: this.stats,
    };
  }

  /**
   * Restore state from persistence
   */
  restoreState(state: AnomalyDetectorState | null | undefined): void {
    if (!state) return;

    this.baselineMetrics = new Map(parseStringNumberEntries(state.baselineMetrics));
    this.tagFrequencies = new Map(parseStringNumberArrayEntries(state.tagFrequencies));
    this.errorPatterns = new Map(parseStringNumberEntries(state.errorPatterns));
    this.stats = normalizeStats(state.stats);
  }
}
