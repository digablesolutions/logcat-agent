import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileLogBuffer } from '../src/ai/realtime/fileLogBuffer.js';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ILogEntry } from '../src/pipeline/types.js';

const TEST_DIR = join(tmpdir(), 'logcat-agent-test-buffer');

describe('FileLogBuffer', () => {
  beforeEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('should add and retrieve recent entries', async () => {
    const buffer = new FileLogBuffer(TEST_DIR);
    await buffer.init();

    const entry: ILogEntry = {
      timestamp: new Date(),
      priority: 'I',
      tag: 'Test',
      pid: 123,
      message: 'Test message',
    };

    await buffer.add(entry);
    const recent = await buffer.getRecent(1);

    expect(recent).toHaveLength(1);
    expect(recent[0]).toEqual(expect.objectContaining({
      tag: 'Test',
      message: 'Test message'
    }));

    await buffer.close();
  });

  it('should handle file rotation', async () => {
    // Small max size to force rotation
    const buffer = new FileLogBuffer(TEST_DIR, 50);
    await buffer.init();

    const entry1: ILogEntry = {
      timestamp: new Date('2023-01-01T10:00:00Z'),
      priority: 'I',
      tag: 'Test',
      pid: 123,
      message: 'Message 1',
    };
    const entry2: ILogEntry = {
      timestamp: new Date('2023-01-01T10:00:01Z'),
      priority: 'I',
      tag: 'Test',
      pid: 123,
      message: 'Message 2',
    };

    await buffer.add(entry1);
    await buffer.add(entry2);

    const recent = await buffer.getRecent(2);
    expect(recent).toHaveLength(2);
    expect(recent[0]).toEqual(expect.objectContaining({ message: 'Message 1' }));
    expect(recent[1]).toEqual(expect.objectContaining({ message: 'Message 2' }));

    await buffer.close();
  });
});
