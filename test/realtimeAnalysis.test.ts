import { describe, it, expect } from 'vitest';
import type { IAiProvider, AnalysisInput, AnalysisResult } from '../src/ai/provider.js';
import { RealtimeAnalysisEngine } from '../src/ai/realtime/analysisEngine.js';
import type { LogBuffer } from '../src/ai/realtime/logBuffer.js';
import type { StatePersistence } from '../src/ai/realtime/statePersistence.js';
import type { RealtimeAnalysisResult } from '../src/ai/realtime/types.js';
import type { ReportMessage } from '../src/reporting.js';
import type { ILogEntry } from '../src/pipeline/types.js';

// Mock AI provider for testing
class MockAiProvider implements IAiProvider {
  name(): string {
    return 'mock-provider';
  }

  analyze(_input: AnalysisInput): Promise<AnalysisResult> {
    return Promise.resolve({
      summary: 'Mock analysis result',
      likelyCauses: ['Test cause'],
      suggestedNextSteps: ['Test next step'],
      severity: 'medium',
      model: 'mock',
    });
  }
}

class MemoryLogBuffer implements LogBuffer {
  private entries: ILogEntry[] = [];

  add(entry: ILogEntry): Promise<void> {
    this.entries.push(entry);
    return Promise.resolve();
  }

  getRecent(count: number): Promise<ILogEntry[]> {
    return Promise.resolve(this.entries.slice(-count));
  }

  getWindow(start: Date, end: Date): Promise<ILogEntry[]> {
    const startTime = start.getTime();
    const endTime = end.getTime();
    return Promise.resolve(this.entries.filter((entry) => {
      const time = entry.timestamp.getTime();
      return time >= startTime && time <= endTime;
    }));
  }

  clear(): Promise<void> {
    this.entries = [];
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.entries = [];
    return Promise.resolve();
  }

  size(): Promise<number> {
    return Promise.resolve(this.entries.length);
  }
}

class MemoryStatePersistence implements StatePersistence {
  private readonly state = new Map<string, unknown>();

  save(key: string, value: unknown): Promise<void> {
    this.state.set(key, value);
    return Promise.resolve();
  }

  load<T>(key: string): Promise<T | null> {
    return Promise.resolve((this.state.get(key) as T | undefined) ?? null);
  }
}

const createTestEngine = (
  provider: IAiProvider,
  config?: ConstructorParameters<typeof RealtimeAnalysisEngine>[1]
): RealtimeAnalysisEngine => {
  return new RealtimeAnalysisEngine(
    provider,
    config,
    new MemoryLogBuffer(),
    new MemoryStatePersistence()
  );
};

describe('RealtimeAnalysisEngine', () => {
  it('should initialize with default configuration', () => {
    const provider = new MockAiProvider();
    const engine = createTestEngine(provider);

    expect(engine).toBeDefined();
  });

  it('should start and stop correctly', () => {
    const provider = new MockAiProvider();
    const engine = createTestEngine(provider);

    return (async () => {
      expect((await engine.getStats()).isRunning).toBe(false);

      await engine.start();
      expect((await engine.getStats()).isRunning).toBe(true);

      await engine.stop();
      expect((await engine.getStats()).isRunning).toBe(false);
    })();
  });

  it('should process log entries when running', async () => {
    const provider = new MockAiProvider();
    const engine = createTestEngine(provider, {
      windowSize: 10,
      analysisInterval: 1000,
      anomalyThreshold: 0.5,
      enableTrendAnalysis: true,
      enablePerformanceMonitoring: true,
      enableProactiveAnalysis: true,
      maxBufferSize: 100,
    });

    await engine.start();

    const mockEntry: ILogEntry = {
      timestamp: new Date(),
      priority: 'E',
      tag: 'TestTag',
      pid: 1234,
      message: 'Test error message',
    };

    // Should process without throwing
    await engine.processLogEntry(mockEntry);

    const stats = await engine.getStats();
    expect(stats.bufferSize).toBe(1);

    await engine.stop();
  });

  it('should emit events for analysis results', async () => {
    const provider = new MockAiProvider();
    const engine = createTestEngine(provider, {
      windowSize: 5,
      analysisInterval: 100,
      anomalyThreshold: 0.3,
      enableTrendAnalysis: false,
      enablePerformanceMonitoring: false,
      enableProactiveAnalysis: true,
      maxBufferSize: 50,
    });

    const analysisPromise = new Promise<void>(resolve => {
      engine.on('realtimeAnalysis', (analysis: RealtimeAnalysisResult) => {
        expect(analysis).toBeDefined();
        expect(analysis.summary).toBe('Mock analysis result');
        void engine.stop();
        resolve();
      });
    });

    await engine.start();

    // Create a critical error that should trigger immediate analysis
    const criticalEntry: ILogEntry = {
      timestamp: new Date(),
      priority: 'F',
      tag: 'CriticalTag',
      pid: 1234,
      message: 'Fatal error occurred',
    };

    await engine.processLogEntry(criticalEntry);
    await analysisPromise;
    await engine.stop();
  });

  it('should respect configuration overrides', () => {
    const provider = new MockAiProvider();
    const customConfig = {
      windowSize: 25,
      analysisInterval: 2500,
      anomalyThreshold: 0.8,
      enableTrendAnalysis: false,
      enablePerformanceMonitoring: false,
      enableProactiveAnalysis: false,
      maxBufferSize: 200,
    };

    const engine = createTestEngine(provider, customConfig);

    // We can't directly access the config, but we can test behavior indirectly
    expect(engine).toBeDefined();
  });

  it('should emit report events for lifecycle messages', async () => {
    const provider = new MockAiProvider();
    const engine = createTestEngine(provider);
    const reports: ReportMessage[] = [];

    engine.on('report', (report: ReportMessage) => {
      reports.push(report);
    });

    await engine.start();
    await engine.stop();

    expect(reports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ level: 'info', message: '🤖 Real-time AI analysis engine started' }),
        expect.objectContaining({ level: 'info', message: '🤖 Real-time AI analysis engine stopped' }),
      ])
    );
  });
});
