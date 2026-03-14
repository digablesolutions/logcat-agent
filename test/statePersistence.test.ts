import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileStatePersistence } from '../src/ai/realtime/statePersistence.js';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TEST_DIR = join(tmpdir(), 'logcat-agent-test-state');

describe('FileStatePersistence', () => {
  beforeEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('should save and load state', async () => {
    const persistence = new FileStatePersistence(TEST_DIR);
    const state = { foo: 'bar', count: 123 };

    await persistence.save('test-key', state);
    const loaded = await persistence.load('test-key');

    expect(loaded).toEqual(state);
  });

  it('should return null for missing state', async () => {
    const persistence = new FileStatePersistence(TEST_DIR);
    const loaded = await persistence.load('non-existent');
    expect(loaded).toBeNull();
  });
});
