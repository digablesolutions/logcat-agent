import { describe, it, expect } from 'vitest';
import { TrendAnalyzer } from '../src/ai/realtime/trendAnalyzer.js';

// Helper type to access private members for testing
interface TestTrendAnalyzer {
  timeSeriesData: Map<string, { timestamp: number; value: number }[]>;
  stats: { trendsDetected: number };
}

describe('TrendAnalyzer State', () => {
  it('should export and restore state', () => {
    const analyzer = new TrendAnalyzer();
    const testAnalyzer = analyzer as unknown as TestTrendAnalyzer;

    // Simulate some state
    testAnalyzer.timeSeriesData.set('metric', [{ timestamp: 123, value: 456 }]);
    testAnalyzer.stats.trendsDetected = 5;

    const state = analyzer.getState();

    const newAnalyzer = new TrendAnalyzer();
    newAnalyzer.restoreState(state);
    const newTestAnalyzer = newAnalyzer as unknown as TestTrendAnalyzer;

    expect(newTestAnalyzer.timeSeriesData.get('metric')).toEqual([{ timestamp: 123, value: 456 }]);
    expect(newTestAnalyzer.stats.trendsDetected).toBe(5);
  });
});
