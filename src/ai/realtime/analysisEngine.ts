import { EventEmitter } from 'eventemitter3';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { getErrorMessage } from '../../errors.js';
import type { ReportLevel } from '../../reporting.js';
import type { ILogEntry, IPatternMatch } from '../../pipeline/types.js';
import type { IAiProvider, AnalysisResult } from '../provider.js';
import type {
  RealtimeAnalysisConfig,
  RealtimeAnalysisResult,
  AnomalyDetectorState,
  TrendAnalyzerState,
  RealtimeEngineStats,
  RealtimeAnalysisEngineEvents,
} from './types.js';
import { createWindowAnalyzer, type WindowAnalyzer } from './windowAnalyzer.js';
import { AnomalyDetector } from './anomalyDetector.js';
import { createPerformanceMonitor, type PerformanceMonitor } from './performanceMonitor.js';
import { TrendAnalyzer } from './trendAnalyzer.js';
import { makeLimiter } from '../rateLimiter.js';
import type { LogBuffer } from './logBuffer.js';
import { FileLogBuffer } from './fileLogBuffer.js';
import type { StatePersistence } from './statePersistence.js';
import { FileStatePersistence } from './statePersistence.js';

type InitializableLogBuffer = LogBuffer & {
  init(): Promise<void>;
};

const isInitializableLogBuffer = (buffer: LogBuffer): buffer is InitializableLogBuffer => {
  const candidate = buffer as Partial<InitializableLogBuffer>;
  return typeof candidate.init === 'function';
};

/**
 * Real-time AI analysis engine that continuously processes log streams
 * and provides proactive insights, anomaly detection, and trend analysis.
 */
export class RealtimeAnalysisEngine extends EventEmitter<RealtimeAnalysisEngineEvents> {
  private aiProvider: IAiProvider;
  private config: RealtimeAnalysisConfig;
  private windowAnalyzer: WindowAnalyzer;
  private anomalyDetector: AnomalyDetector;
  private trendAnalyzer: TrendAnalyzer;
  private performanceMonitor: PerformanceMonitor;
  private isRunning = false;
  private logBuffer: LogBuffer;
  private statePersistence: StatePersistence;
  private analysisQueue: ILogEntry[] = [];
  private lastAnalysisTime = 0;
  private aiLimiter: <T>(task: () => Promise<T>) => Promise<T>;
  private aiRequestQueue: Set<string> = new Set();
  private aiAnalysisCount = 0;
  private stateSaveInterval: NodeJS.Timeout | null = null;

  private emitReport(level: ReportLevel, message: string): void {
    this.emit('report', { level, message });
  }

  constructor(
    aiProvider: IAiProvider,
    config?: Partial<RealtimeAnalysisConfig>,
    logBuffer?: LogBuffer,
    statePersistence?: StatePersistence
  ) {
    super();
    this.aiProvider = aiProvider;
    this.config = {
      windowSize: 50,
      analysisInterval: 5000,
      anomalyThreshold: 0.7,
      enableTrendAnalysis: true,
      enablePerformanceMonitoring: true,
      enableProactiveAnalysis: true,
      maxBufferSize: 1000,
      ...config,
    };

    // Initialize rate limiter with conservative concurrency
    this.aiLimiter = makeLimiter(1);

    this.windowAnalyzer = createWindowAnalyzer(this.config.windowSize);
    this.anomalyDetector = new AnomalyDetector(this.config.anomalyThreshold);
    this.trendAnalyzer = new TrendAnalyzer();
    this.performanceMonitor = createPerformanceMonitor();

    const baseDir = join(homedir(), '.logcat-agent', 'data');
    this.logBuffer = logBuffer || new FileLogBuffer(join(baseDir, 'buffer'));
    this.statePersistence = statePersistence || new FileStatePersistence(join(baseDir, 'state'));

    this.setupAnalysisLoop();
  }

  /**
   * Start the real-time analysis engine
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // Initialize buffer if needed (FileLogBuffer needs init)
    if (isInitializableLogBuffer(this.logBuffer)) {
      await this.logBuffer.init();
    }

    await this.loadState();

    // Setup periodic state saving
    this.stateSaveInterval = setInterval(() => {
      void this.saveState();
    }, 60000); // Save every minute

    this.emit('started');
    this.emitReport('info', '🤖 Real-time AI analysis engine started');
  }

  /**
   * Stop the real-time analysis engine
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.stateSaveInterval) {
      clearInterval(this.stateSaveInterval);
      this.stateSaveInterval = null;
    }

    await this.saveState();
    await this.logBuffer.close();

    this.emit('stopped');
    this.emitReport('info', '🤖 Real-time AI analysis engine stopped');
  }

  /**
   * Process a new log entry for real-time analysis
   */
  async processLogEntry(entry: ILogEntry): Promise<void> {
    if (!this.isRunning) return;

    // Load shedding: if queue is too full, drop low priority logs
    if (this.analysisQueue.length > this.config.maxBufferSize * 0.8) {
      if (entry.priority === 'V' || entry.priority === 'D') {
        return; // Drop verbose/debug logs when under pressure
      }
    }

    // Add to buffer
    await this.logBuffer.add(entry);

    // Add to analysis queue
    this.analysisQueue.push(entry);

    // Immediate processing for critical entries
    if (entry.priority === 'E' || entry.priority === 'F') {
      await this.processImmediateAnalysis(entry);
    }

    // Performance monitoring
    if (this.config.enablePerformanceMonitoring) {
      const perfInsight = this.performanceMonitor.analyze(entry);
      if (perfInsight) {
        this.emit('performanceInsight', perfInsight);
      }
    }

    // Anomaly detection
    const anomaly = this.anomalyDetector.detect(entry);
    if (anomaly) {
      this.emit('anomalyDetected', anomaly);
    }
  }

  /**
   * Setup the periodic analysis loop
   */
  private setupAnalysisLoop(): void {
    setInterval(() => {
      if (!this.isRunning || this.analysisQueue.length === 0) return;

      const now = Date.now();
      if (now - this.lastAnalysisTime < this.config.analysisInterval) return;

      // Trigger analysis without returning a promise to the interval callback
      this.lastAnalysisTime = now;
      void this.performPeriodicAnalysis();
    }, 1000);
  }

  /**
   * Perform immediate analysis for critical log entries
   */
  private async processImmediateAnalysis(entry: ILogEntry): Promise<void> {
    try {
      // Fetch recent context from buffer
      const recent = await this.logBuffer.getRecent(this.config.windowSize);
      const window = this.windowAnalyzer.getWindow(recent, entry);
      const analysis = await this.analyzeWindow(window, 'critical');

      if (analysis) {
        this.emit('realtimeAnalysis', {
          ...analysis,
          trigger: 'immediate',
          entry,
        });
      }
    } catch (error) {
      this.emit('analysisError', error);
    }
  }

  /**
   * Perform periodic analysis of accumulated logs
   */
  private async performPeriodicAnalysis(): Promise<void> {
    if (this.analysisQueue.length === 0) return;

    try {
      // Process queued entries in windows
      while (this.analysisQueue.length > 0) {
        const windowEntries = this.analysisQueue.splice(0, this.config.windowSize);
        const analysis = await this.analyzeWindow(windowEntries, 'periodic');

        if (analysis) {
          this.emit('realtimeAnalysis', {
            ...analysis,
            trigger: 'periodic',
            windowSize: windowEntries.length,
          });
        }
      }

      // Trend analysis
      if (this.config.enableTrendAnalysis) {
        // Fetch larger window for trend analysis
        const trendWindow = await this.logBuffer.getRecent(1000);
        const trends = this.trendAnalyzer.analyze(trendWindow);
        if (trends.length > 0) {
          this.emit('trendsDetected', trends);
        }
      }
    } catch (error) {
      this.emit('analysisError', error);
    }
  }

  /**
   * Save analysis state
   */
  private async saveState(): Promise<void> {
    try {
      await this.statePersistence.save('anomalyDetector', this.anomalyDetector.getState());
      await this.statePersistence.save('trendAnalyzer', this.trendAnalyzer.getState());
    } catch (error) {
      this.emitReport('error', `Failed to save analysis state: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Load analysis state
   */
  private async loadState(): Promise<void> {
    try {
      const anomalyState = await this.statePersistence.load<AnomalyDetectorState>('anomalyDetector');
      if (anomalyState) this.anomalyDetector.restoreState(anomalyState);

      const trendState = await this.statePersistence.load<TrendAnalyzerState>('trendAnalyzer');
      if (trendState) this.trendAnalyzer.restoreState(trendState);
    } catch (error) {
      this.emitReport('error', `Failed to load analysis state: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Analyze a window of log entries using AI with rate limiting
   */
  private async analyzeWindow(
    entries: ILogEntry[],
    trigger: string
  ): Promise<RealtimeAnalysisResult | null> {
    if (entries.length === 0) return null;

    // Skip analysis if window doesn't contain interesting patterns
    if (!this.config.enableProactiveAnalysis && !this.hasInterestingPatterns(entries)) {
      return null;
    }

    // Create a unique signature to prevent duplicate analyses
    const last = entries[entries.length - 1];
    if (!last) return null;
    const windowSignature = `${trigger}-${entries.length}-${last.timestamp.getTime()}`;
    if (this.aiRequestQueue.has(windowSignature)) {
      return null; // Skip duplicate analysis
    }

    try {
      this.aiRequestQueue.add(windowSignature);

      // Create synthetic pattern match for AI analysis
      const syntheticRegExpMatch = /.*/u.exec('');
      if (!syntheticRegExpMatch) {
        return null;
      }

      const syntheticMatch: IPatternMatch = {
        pattern: {
          name: `Real-time Analysis (${trigger})`,
          regex: /.*/u,
          severity: 'info' as const,
          description: 'Real-time log stream analysis',
        },
        entry: last, // Use last entry as primary
        match: syntheticRegExpMatch,
        signature: windowSignature,
      };

      // Use rate limiter for AI analysis
      const aiResult = await this.aiLimiter(async () => {
        this.emitReport('info', '🤖 Analyzing with AI...');
        this.aiAnalysisCount++;
        return await this.aiProvider.analyze({
          match: syntheticMatch,
          surrounding: entries.slice(0, -1),
        });
      });

      return {
        timestamp: new Date(),
        summary: aiResult.summary,
        insights: aiResult.likelyCauses || [],
        recommendations: aiResult.suggestedNextSteps || [],
        severity: aiResult.severity || 'medium',
        confidence: this.calculateConfidence(entries, aiResult),
        entriesAnalyzed: entries.length,
        model: aiResult.model || this.aiProvider.name(),
      };
    } catch (error) {
      this.emitReport('error', `Real-time analysis failed: ${getErrorMessage(error)}`);
      return null;
    } finally {
      // Clean up queue to prevent memory leaks
      this.aiRequestQueue.delete(windowSignature);

      // Limit queue size to prevent memory issues
      if (this.aiRequestQueue.size > 100) {
        const firstKey = this.aiRequestQueue.values().next().value;
        if (firstKey) {
          this.aiRequestQueue.delete(firstKey);
        }
      }
    }
  }

  /**
   * Check if a window contains patterns worth analyzing
   */
  private hasInterestingPatterns(entries: ILogEntry[]): boolean {
    const errorCount = entries.filter(e => e.priority === 'E' || e.priority === 'F').length;
    const warningCount = entries.filter(e => e.priority === 'W').length;

    // Analyze if there are multiple errors/warnings or unusual activity
    return errorCount > 1 || warningCount > 3 || this.hasUnusualActivity(entries);
  }

  /**
   * Detect unusual activity patterns in log entries
   */
  private hasUnusualActivity(entries: ILogEntry[]): boolean {
    // Check for high frequency from same tag
    const tagCounts = new Map<string, number>();
    entries.forEach(entry => {
      tagCounts.set(entry.tag, (tagCounts.get(entry.tag) || 0) + 1);
    });

    // Flag if any tag appears more than 20% of the window
    const threshold = Math.ceil(entries.length * 0.2);
    return Array.from(tagCounts.values()).some(count => count > threshold);
  }

  /**
   * Calculate confidence score for analysis results
   */
  private calculateConfidence(entries: ILogEntry[], aiResult: AnalysisResult): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence for more entries analyzed
    confidence += Math.min(entries.length / 100, 0.2);

    // Increase confidence for error entries
    const errorRatio =
      entries.filter(e => e.priority === 'E' || e.priority === 'F').length / entries.length;
    confidence += errorRatio * 0.2;

    // Increase confidence if AI provided detailed insights
    if (aiResult.likelyCauses && aiResult.likelyCauses.length > 0) confidence += 0.1;
    if (aiResult.suggestedNextSteps && aiResult.suggestedNextSteps.length > 0) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  /**
   * Get current analysis statistics
   */
  async getStats(): Promise<RealtimeEngineStats> {
    return {
      isRunning: this.isRunning,
      bufferSize: await this.logBuffer.size(),
      queueSize: this.analysisQueue.length,
      totalAnalyses: this.anomalyDetector.getStats().totalAnalyses,
      anomaliesDetected: this.anomalyDetector.getStats().anomaliesDetected,
      trendsDetected: this.trendAnalyzer.getStats().trendsDetected,
      aiAnalyses: this.aiAnalysisCount,
    };
  }
}
