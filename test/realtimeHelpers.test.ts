import { describe, expect, it } from 'vitest';
import { createPerformanceMonitor } from '../src/ai/realtime/performanceMonitor.js';
import { createWindowAnalyzer } from '../src/ai/realtime/windowAnalyzer.js';
import type { ILogEntry } from '../src/pipeline/types.js';

const createEntry = (overrides: Partial<ILogEntry> = {}): ILogEntry => {
  return {
    timestamp: new Date('2026-01-01T00:00:00.000Z'),
    priority: 'I',
    tag: 'TestTag',
    pid: 1234,
    message: 'Normal log line',
    ...overrides,
  };
};

describe('createPerformanceMonitor', () => {
  it('detects critical memory pressure and tracks stats', () => {
    const monitor = createPerformanceMonitor();
    const now = Date.now();

    const insight = monitor.analyze(
      createEntry({
        timestamp: new Date(now),
        priority: 'E',
        message: 'Out of memory while allocating bitmap',
      })
    );

    expect(insight?.type).toBe('memory_pressure');
    expect(insight?.severity).toBe('critical');
    expect(monitor.getStats().memoryEvents).toBe(1);
  });

  it('retains GC state across analyses', () => {
    const monitor = createPerformanceMonitor({ gcFrequencyThreshold: 1 });
    const now = Date.now();

    monitor.analyze(
      createEntry({
        timestamp: new Date(now),
        message: 'GC freed 12 objects in 40ms',
      })
    );

    const insight = monitor.analyze(
      createEntry({
        timestamp: new Date(now + 30000),
        message: 'GC freed 18 objects in 600ms',
      })
    );

    expect(insight?.type).toBe('gc_pressure');
    expect(insight?.severity).toBe('critical');
    expect(monitor.getStats().gcEvents).toBe(2);
  });
});

describe('createWindowAnalyzer', () => {
  it('returns a focused window around the target entry', () => {
    const analyzer = createWindowAnalyzer(5);
    const entries = [
      createEntry({ timestamp: new Date('2026-01-01T00:00:00.000Z'), tag: 'Alpha', message: 'first' }),
      createEntry({ timestamp: new Date('2026-01-01T00:00:01.000Z'), tag: 'Beta', message: 'second' }),
      createEntry({ timestamp: new Date('2026-01-01T00:00:02.000Z'), tag: 'Gamma', message: 'third' }),
    ];

    expect(analyzer.getWindow(entries, entries[1]!)).toEqual(entries);
  });

  it('summarizes errors, warnings, and stack traces', () => {
    const analyzer = createWindowAnalyzer(10);
    const entries = [
      createEntry({ timestamp: new Date('2026-01-01T00:00:00.000Z'), tag: 'Alpha', message: 'Warmup' }),
      createEntry({ timestamp: new Date('2026-01-01T00:00:01.000Z'), priority: 'W', tag: 'Beta', message: 'Slow network warning' }),
      createEntry({ timestamp: new Date('2026-01-01T00:00:02.000Z'), priority: 'E', tag: 'Gamma', message: 'java.lang.IllegalStateException at MainActivity.java:42' }),
    ];

    const analysis = analyzer.analyzeWindow(entries);

    expect(analysis.errorCount).toBe(1);
    expect(analysis.warningCount).toBe(1);
    expect(analysis.hasStackTrace).toBe(true);
    expect(analysis.hasPerformanceIssues).toBe(true);
    expect(analysis.dominantPriority).toBe('I');
  });
});
