import type { ILogEntry } from '../../pipeline/types.js';
import type { PerformanceInsight, PerformanceMonitoringConfig } from './types.js';

type MemoryMetric = Readonly<{
  timestamp: number;
  value: number;
}>;

type GcEvent = Readonly<{
  timestamp: number;
  duration?: number;
}>;

type AnrEvent = Readonly<{
  timestamp: number;
  component: string;
}>;

type BatteryEvent = Readonly<{
  timestamp: number;
  drain?: number;
}>;

type PerformanceMonitorStats = Readonly<{
  memoryEvents: number;
  gcEvents: number;
  anrEvents: number;
  batteryEvents: number;
}>;

type InsightSeverity = PerformanceInsight['severity'];

export interface PerformanceMonitor {
  readonly analyze: (entry: ILogEntry) => PerformanceInsight | null;
  readonly getStats: () => PerformanceMonitorStats;
  readonly updateConfig: (config: Partial<PerformanceMonitoringConfig>) => void;
}

const defaultPerformanceMonitoringConfig: PerformanceMonitoringConfig = {
  memoryThresholds: {
    warning: 0.8,
    critical: 0.9,
  },
  gcFrequencyThreshold: 5,
  ioLatencyThreshold: 1000,
  batteryDrainThreshold: 10,
};

const getSeverityScore = (severity: InsightSeverity): number => {
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
};

const getMemoryRecommendation = (severity: InsightSeverity): string => {
  switch (severity) {
    case 'critical':
      return 'Immediate action required: reduce memory usage, check for memory leaks, consider app restart';
    case 'high':
      return 'Optimize memory usage: clear caches, release unused objects, review large data structures';
    case 'medium':
      return 'Monitor memory usage: consider proactive memory management';
    default:
      return 'Continue monitoring memory usage patterns';
  }
};

const getGcRecommendation = (severity: InsightSeverity, frequency: number): string => {
  if (frequency > 10) {
    return 'Excessive GC activity: review object allocation patterns, reduce object churn';
  }

  switch (severity) {
    case 'critical':
      return 'Critical GC pressure: optimize object lifecycle, consider memory pooling';
    case 'high':
      return 'High GC pressure: review allocation patterns, reduce temporary objects';
    default:
      return 'Monitor GC patterns for optimization opportunities';
  }
};

const getIoRecommendation = (message: string): string => {
  if (message.includes('database') || message.includes('sqlite')) {
    return 'Optimize database operations: use transactions, indices, async operations';
  }

  if (message.includes('file')) {
    return 'Optimize file operations: use buffered I/O, async operations, cache frequently accessed data';
  }

  return 'Optimize I/O operations: use async patterns, reduce blocking operations';
};

const getNetworkRecommendation = (message: string): string => {
  if (message.includes('timeout')) {
    return 'Review network timeouts: increase timeout values, implement retry logic';
  }

  if (message.includes('dns')) {
    return 'Check DNS configuration and network connectivity';
  }

  return 'Review network error handling and retry mechanisms';
};

export const createPerformanceMonitor = (
  configOverrides?: Partial<PerformanceMonitoringConfig>
): PerformanceMonitor => {
  let config: PerformanceMonitoringConfig = {
    ...defaultPerformanceMonitoringConfig,
    ...configOverrides,
  };
  let memoryMetrics: MemoryMetric[] = [];
  let gcEvents: GcEvent[] = [];
  let anrEvents: AnrEvent[] = [];
  let batteryEvents: BatteryEvent[] = [];

  const analyzeMemoryPressure = (entry: ILogEntry): PerformanceInsight | null => {
    const message = entry.message.toLowerCase();
    const memoryPatterns = [
      /oom killer/i,
      /out of memory/i,
      /memory pressure/i,
      /low memory/i,
      /memory usage.*?(\d+)%/i,
      /available memory.*?(\d+)/i,
      /heap.*?(\d+).*?mb/i,
    ];

    for (const pattern of memoryPatterns) {
      const match = entry.message.match(pattern);
      if (!match) {
        continue;
      }

      let severity: InsightSeverity = 'medium';
      const metrics: Record<string, number> = {};

      if (message.includes('oom') || message.includes('out of memory')) {
        severity = 'critical';
      } else if (message.includes('pressure') || message.includes('low memory')) {
        severity = 'high';
      }

      const numericMatch = match[1];
      if (numericMatch) {
        const value = Number.parseInt(numericMatch, 10);
        metrics['value'] = value;

        if (message.includes('%')) {
          if (value > config.memoryThresholds.critical * 100) {
            severity = 'critical';
          } else if (value > config.memoryThresholds.warning * 100) {
            severity = 'high';
          }
        }
      }

      memoryMetrics = [
        ...memoryMetrics,
        {
          timestamp: entry.timestamp.getTime(),
          value: Number.parseInt(numericMatch || '0', 10),
        },
      ];

      return {
        timestamp: new Date(),
        type: 'memory_pressure',
        severity,
        description: `Memory pressure detected: ${entry.message.slice(0, 100)}`,
        metrics,
        recommendation: getMemoryRecommendation(severity),
        affectedComponents: [entry.tag],
      };
    }

    return null;
  };

  const analyzeGcPressure = (entry: ILogEntry): PerformanceInsight | null => {
    const gcPatterns = [/gc.*?(\d+)ms/i, /garbage.*?collect/i, /concurrent.*?gc/i, /mark.*?sweep/i];

    for (const pattern of gcPatterns) {
      const match = entry.message.match(pattern);
      if (!match) {
        continue;
      }

      const duration = match[1] ? Number.parseInt(match[1], 10) : 0;
      gcEvents = [
        ...gcEvents,
        {
          timestamp: entry.timestamp.getTime(),
          duration,
        },
      ];

      const oneMinuteAgo = entry.timestamp.getTime() - 60000;
      const recentGcEvents = gcEvents.filter((event) => event.timestamp > oneMinuteAgo);

      let severity: InsightSeverity = 'low';
      if (recentGcEvents.length > config.gcFrequencyThreshold) {
        severity = 'high';
      } else if (duration > 100) {
        severity = 'medium';
      }

      if (duration > 500 || recentGcEvents.length > config.gcFrequencyThreshold * 2) {
        severity = 'critical';
      }

      return {
        timestamp: new Date(),
        type: 'gc_pressure',
        severity,
        description: `GC pressure: ${recentGcEvents.length} events/min, ${duration}ms duration`,
        metrics: {
          frequency: recentGcEvents.length,
          duration,
          threshold: config.gcFrequencyThreshold,
        },
        recommendation: getGcRecommendation(severity, recentGcEvents.length),
        affectedComponents: [entry.tag],
      };
    }

    return null;
  };

  const analyzeAnr = (entry: ILogEntry): PerformanceInsight | null => {
    const message = entry.message.toLowerCase();

    if (
      !message.includes('anr') &&
      !message.includes('not responding') &&
      !message.includes('application not responding') &&
      !message.includes('input dispatching timed out')
    ) {
      return null;
    }

    anrEvents = [
      ...anrEvents,
      {
        timestamp: entry.timestamp.getTime(),
        component: entry.tag,
      },
    ];

    return {
      timestamp: new Date(),
      type: 'cpu_spike',
      severity: 'critical',
      description: `ANR detected in ${entry.tag}: ${entry.message.slice(0, 100)}`,
      metrics: {
        component: entry.tag.length,
      },
      recommendation:
        'Check for blocking operations on main thread, long-running tasks, or deadlocks',
      affectedComponents: [entry.tag],
    };
  };

  const analyzeIoBottleneck = (entry: ILogEntry): PerformanceInsight | null => {
    const message = entry.message.toLowerCase();
    const ioPatterns = [
      /i\/o.*?slow/i,
      /disk.*?slow/i,
      /file.*?operation.*?(\d+)ms/i,
      /database.*?lock/i,
      /sqlite.*?busy/i,
      /read.*?timeout/i,
      /write.*?timeout/i,
    ];

    for (const pattern of ioPatterns) {
      const match = entry.message.match(pattern);
      if (!match) {
        continue;
      }

      const duration = match[1] ? Number.parseInt(match[1], 10) : 0;
      let severity: InsightSeverity = 'medium';

      if (duration > config.ioLatencyThreshold) {
        severity = 'high';
      }

      if (message.includes('timeout') || message.includes('lock')) {
        severity = 'critical';
      }

      return {
        timestamp: new Date(),
        type: 'io_bottleneck',
        severity,
        description: `I/O bottleneck detected: ${entry.message.slice(0, 100)}`,
        metrics: {
          duration,
          threshold: config.ioLatencyThreshold,
        },
        recommendation: getIoRecommendation(message),
        affectedComponents: [entry.tag],
      };
    }

    return null;
  };

  const analyzeBatteryDrain = (entry: ILogEntry): PerformanceInsight | null => {
    const batteryPatterns = [
      /battery.*?drain/i,
      /power.*?consumption/i,
      /wakelock/i,
      /cpu.*?usage.*?high/i,
      /background.*?activity/i,
    ];

    for (const pattern of batteryPatterns) {
      if (!pattern.test(entry.message)) {
        continue;
      }

      batteryEvents = [
        ...batteryEvents,
        {
          timestamp: entry.timestamp.getTime(),
        },
      ];

      return {
        timestamp: new Date(),
        type: 'battery_drain',
        severity: 'medium',
        description: `Battery drain issue: ${entry.message.slice(0, 100)}`,
        metrics: {},
        recommendation: 'Review background tasks, wakelocks, and CPU-intensive operations',
        affectedComponents: [entry.tag],
      };
    }

    return null;
  };

  const analyzeNetworkIssues = (entry: ILogEntry): PerformanceInsight | null => {
    const message = entry.message.toLowerCase();
    const networkPatterns = [
      /network.*?timeout/i,
      /connection.*?failed/i,
      /socket.*?timeout/i,
      /http.*?error.*?(\d{3})/i,
      /network.*?unreachable/i,
      /dns.*?failed/i,
    ];

    for (const pattern of networkPatterns) {
      const match = entry.message.match(pattern);
      if (!match) {
        continue;
      }

      let severity: InsightSeverity = 'medium';
      if (message.includes('timeout') || message.includes('unreachable')) {
        severity = 'high';
      }

      const statusCode = match[1] ? Number.parseInt(match[1], 10) : 0;
      if (statusCode >= 500) {
        severity = 'high';
      }

      return {
        timestamp: new Date(),
        type: 'network_issue',
        severity,
        description: `Network issue detected: ${entry.message.slice(0, 100)}`,
        metrics: {
          statusCode,
        },
        recommendation: getNetworkRecommendation(message),
        affectedComponents: [entry.tag],
      };
    }

    return null;
  };

  const cleanOldMetrics = (): void => {
    const oneHourAgo = Date.now() - 3600000;
    memoryMetrics = memoryMetrics.filter((metric) => metric.timestamp > oneHourAgo);
    gcEvents = gcEvents.filter((event) => event.timestamp > oneHourAgo);
    anrEvents = anrEvents.filter((event) => event.timestamp > oneHourAgo);
    batteryEvents = batteryEvents.filter((event) => event.timestamp > oneHourAgo);
  };

  return {
    analyze: (entry) => {
      const insights = [
        analyzeMemoryPressure(entry),
        analyzeGcPressure(entry),
        analyzeAnr(entry),
        analyzeIoBottleneck(entry),
        analyzeBatteryDrain(entry),
        analyzeNetworkIssues(entry),
      ].filter((insight): insight is PerformanceInsight => insight !== null);

      if (insights.length === 0) {
        return null;
      }

      return insights.reduce((highest, current) => {
        return getSeverityScore(current.severity) > getSeverityScore(highest.severity)
          ? current
          : highest;
      });
    },
    getStats: () => {
      cleanOldMetrics();

      return {
        memoryEvents: memoryMetrics.length,
        gcEvents: gcEvents.length,
        anrEvents: anrEvents.length,
        batteryEvents: batteryEvents.length,
      };
    },
    updateConfig: (nextConfig) => {
      config = { ...config, ...nextConfig };
    },
  };
};
