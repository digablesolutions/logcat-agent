import { describe, it, expect } from 'vitest';
import { createLogPipeline } from '../src/pipeline/logPipeline.js';
import { EventEmitter } from 'eventemitter3';
import type { ILogSource, LogSourceEvents } from '../src/ingest/source.js';

class MockSource extends EventEmitter<LogSourceEvents> implements ILogSource {
  deviceId = 'mock-device';
  async connect() {
    return Promise.resolve();
  }
  async disconnect() {
    return Promise.resolve();
  }
}

describe('LogPipeline', () => {
  it('should start and stop', async () => {
    const source = new MockSource();
    const pipeline = createLogPipeline({
      source,
      minPriority: 'I',
      patterns: [],
      signatureMode: 'hash',
      aiSamplePerSignatureMs: 1000,
      aiDailyBudget: 10,
      maxContextLines: 100,
    });

    await pipeline.start();
    await pipeline.stop();
    expect(true).toBe(true); // Just checking it doesn't crash
  });

  it('should forward source close events', async () => {
    const source = new MockSource();
    const pipeline = createLogPipeline({
      source,
      minPriority: 'I',
      patterns: [],
      signatureMode: 'hash',
      aiSamplePerSignatureMs: 1000,
      aiDailyBudget: 10,
      maxContextLines: 100,
    });

    const closed = new Promise<void>((resolve) => {
      pipeline.on('close', () => resolve());
    });

    await pipeline.start();
    source.emit('close');

    await expect(closed).resolves.toBeUndefined();
  });
});
