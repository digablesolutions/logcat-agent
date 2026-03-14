import { describe, expect, it } from 'vitest';
import {
  createBaseSessionStats,
  createLogSessionStats,
  createMultiDeviceSessionStats,
  getLogsPerMinute,
  getSessionRuntimeSeconds,
  markMultiDeviceClosed,
  recordMultiDeviceAiAnalysis,
  recordMultiDeviceEntry,
  recordMultiDevicePattern,
  recordEntryStats,
} from '../src/sessionStats.js';

describe('sessionStats', () => {
  it('tracks entry counters by priority', () => {
    const stats = createBaseSessionStats(new Date('2026-01-01T00:00:00.000Z'));

    recordEntryStats(stats, { priority: 'I' });
    recordEntryStats(stats, { priority: 'W' });
    recordEntryStats(stats, { priority: 'E' });

    expect(stats).toMatchObject({
      total: 3,
      warnings: 1,
      errors: 1,
    });
  });

  it('creates log session stats with stream-specific counters', () => {
    const stats = createLogSessionStats(new Date('2026-01-01T00:00:00.000Z'));

    expect(stats).toMatchObject({
      total: 0,
      errors: 0,
      warnings: 0,
      patterns: 0,
      aiAnalyses: 0,
    });
  });

  it('formats runtime and rate safely at zero seconds', () => {
    const runtime = getSessionRuntimeSeconds(
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-01T00:00:00.900Z')
    );

    expect(runtime).toBe(0);
    expect(getLogsPerMinute(5, runtime)).toBe('0');
  });

  it('tracks multi-device session totals and per-device counters', () => {
    const stats = createMultiDeviceSessionStats(
      ['device-a', 'device-b'],
      new Date('2026-01-01T00:00:00.000Z')
    );

    recordMultiDeviceEntry(stats, 'device-a', { priority: 'E' });
    recordMultiDeviceEntry(stats, 'device-a', { priority: 'W' });
    recordMultiDevicePattern(stats, 'device-a');
    recordMultiDeviceAiAnalysis(stats, 'device-a');
    markMultiDeviceClosed(stats, 'device-a');

    expect(stats).toMatchObject({
      total: 2,
      errors: 1,
      warnings: 1,
      patterns: 1,
      aiAnalyses: 1,
      deviceCount: 2,
      activeDeviceCount: 1,
    });

    expect(stats.devices['device-a']).toMatchObject({
      total: 2,
      errors: 1,
      warnings: 1,
      patterns: 1,
      aiAnalyses: 1,
      closed: true,
    });
  });
});
