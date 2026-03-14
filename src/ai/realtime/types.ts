import type { ILogEntry, Priority } from '../../pipeline/types.js';
import type { ReportMessage } from '../../reporting.js';

/**
 * Configuration for real-time analysis engine
 */
export interface RealtimeAnalysisConfig {
  windowSize: number;
  analysisInterval: number;
  anomalyThreshold: number;
  enableTrendAnalysis: boolean;
  enablePerformanceMonitoring: boolean;
  enableProactiveAnalysis: boolean;
  maxBufferSize: number;
}

/**
 * Result from real-time AI analysis
 */
export interface RealtimeAnalysisResult {
  timestamp: Date;
  summary: string;
  insights: string[];
  recommendations: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  entriesAnalyzed: number;
  model: string;
  trigger?: string;
  entry?: ILogEntry;
  windowSize?: number;
}

/**
 * Anomaly detection result
 */
export interface AnomalyDetectionResult {
  timestamp: Date;
  type: 'frequency' | 'pattern' | 'performance' | 'error_spike' | 'unusual_tag';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedEntries: ILogEntry[];
  confidence: number;
  metrics: Record<string, number>;
}

/**
 * Trend analysis result
 */
export interface TrendAnalysisResult {
  timestamp: Date;
  trendType:
    | 'error_increase'
    | 'warning_spike'
    | 'performance_degradation'
    | 'new_error_pattern'
    | 'tag_frequency_change';
  description: string;
  startTime: Date;
  endTime: Date;
  confidence: number;
  metrics: {
    baseline: number;
    current: number;
    change: number;
    changePercent: number;
  };
  affectedTags: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Performance insight from monitoring
 */
export interface PerformanceInsight {
  timestamp: Date;
  type:
    | 'memory_pressure'
    | 'cpu_spike'
    | 'io_bottleneck'
    | 'gc_pressure'
    | 'battery_drain'
    | 'network_issue';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  metrics: Record<string, number>;
  recommendation: string;
  affectedComponents: string[];
}

/**
 * Window analysis configuration
 */
export interface WindowAnalysisOptions {
  contextSize: number;
  priorityWeights: Record<Priority, number>;
  focusOnErrors: boolean;
  includeMetadata: boolean;
}

/**
 * Anomaly detection configuration
 */
export interface AnomalyDetectionConfig {
  frequencyThreshold: number;
  errorSpikeThreshold: number;
  patternDeviationThreshold: number;
  timeWindowMinutes: number;
  minSampleSize: number;
}

/**
 * Trend analysis configuration
 */
export interface TrendAnalysisConfig {
  timeWindowMinutes: number;
  minimumDataPoints: number;
  changeThreshold: number;
  smoothingWindow: number;
}

/**
 * Performance monitoring configuration
 */
export interface PerformanceMonitoringConfig {
  memoryThresholds: {
    warning: number;
    critical: number;
  };
  gcFrequencyThreshold: number;
  ioLatencyThreshold: number;
  batteryDrainThreshold: number;
}

/**
 * Analysis statistics
 */
export interface AnalysisStats {
  totalAnalyses: number;
  anomaliesDetected: number;
  trendsDetected: number;
  performanceIssues: number;
  avgConfidence: number;
  lastAnalysisTime?: Date;
}

export interface RealtimeEngineStats {
  isRunning: boolean;
  bufferSize: number;
  queueSize: number;
  totalAnalyses: number;
  anomaliesDetected: number;
  trendsDetected: number;
  aiAnalyses: number;
}

export interface RealtimeAnalysisEngineEvents {
  started: [];
  stopped: [];
  realtimeAnalysis: [RealtimeAnalysisResult];
  anomalyDetected: [AnomalyDetectionResult];
  trendsDetected: [TrendAnalysisResult[]];
  performanceInsight: [PerformanceInsight];
  analysisError: [unknown];
  report: [ReportMessage];
}

export interface WindowSummaryAnalysis {
  errorCount: number;
  warningCount: number;
  uniqueTags: string[];
  timeSpan: number;
  hasStackTrace: boolean;
  hasPerformanceIssues: boolean;
}

export interface AnomalyDetectorState {
  baselineMetrics: Array<[string, number]>;
  tagFrequencies: Array<[string, number[]]>;
  errorPatterns: Array<[string, number]>;
  stats: AnalysisStats;
}

export interface TrendAnalyzerTimeSeriesPoint {
  timestamp: number;
  value: number;
}

export interface TrendAnalyzerState {
  timeSeriesData: Array<[string, TrendAnalyzerTimeSeriesPoint[]]>;
  stats: AnalysisStats;
}
