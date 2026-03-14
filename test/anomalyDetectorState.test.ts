import { describe, it, expect } from 'vitest';
import { AnomalyDetector } from '../src/ai/realtime/anomalyDetector.js';

// Helper type to access private members for testing
interface TestAnomalyDetector {
  baselineMetrics: Map<string, number>;
  stats: { totalAnalyses: number };
}

describe('AnomalyDetector State', () => {
  it('should export and restore state', () => {
    const detector = new AnomalyDetector(0.5);
    const testDetector = detector as unknown as TestAnomalyDetector;

    // Simulate some state
    testDetector.baselineMetrics.set('test_metric', 100);
    testDetector.stats.totalAnalyses = 50;

    const state = detector.getState();

    const newDetector = new AnomalyDetector(0.5);
    newDetector.restoreState(state);
    const newTestDetector = newDetector as unknown as TestAnomalyDetector;

    expect(newTestDetector.baselineMetrics.get('test_metric')).toBe(100);
    expect(newTestDetector.stats.totalAnalyses).toBe(50);
  });
});
