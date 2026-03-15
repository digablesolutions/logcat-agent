import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getConfigStore, resetConfigStore } from '../src/configService.js';
import type { Config } from '../src/configService.js';
import { clearEnvKeys, restoreEnv, snapshotEnv } from './envTestUtils.js';

describe('config store', () => {
  const ENV_KEYS = [
    'LOGCAT_AI_PROVIDER',
    'LOGCAT_AI_MODEL',
    'OPENAI_MODEL',
    'GEMINI_MODEL',
    'LOGCAT_AI_CONCURRENCY',
    'LOGCAT_AI_RETRIES',
    'OPENAI_TIMEOUT_MS',
    'LOGCAT_SIGNATURE_MODE',
  ] as const;
  let envSnapshot: ReadonlyMap<string, string | undefined> = new Map();

  beforeEach(() => {
    resetConfigStore();
    envSnapshot = snapshotEnv(ENV_KEYS);
    clearEnvKeys(ENV_KEYS);
  });

  afterEach(() => {
    restoreEnv(envSnapshot);
    resetConfigStore();
  });

  it('should load defaults', () => {
    const config = getConfigStore();
    expect(config.get('aiEnabled')).toBe(true);
    expect(config.get('aiProvider')).toBe('openai');
    expect(config.get('aiModel')).toBe('gpt-5-mini');
    expect(config.get('logcatBuffers')).toEqual(['main', 'crash']);
  });

  it('should load from env', () => {
    process.env['LOGCAT_AI_PROVIDER'] = 'gemini';
    process.env['LOGCAT_AI_MODEL'] = 'gemini-2.5-flash-lite';

    resetConfigStore();
    const config = getConfigStore();

    expect(config.get('aiProvider')).toBe('gemini');
    expect(config.get('aiModel')).toBe('gemini-2.5-flash-lite');
  });

  it('should use the provider default when no model override is set', () => {
    process.env['LOGCAT_AI_PROVIDER'] = 'gemini';

    resetConfigStore();
    const config = getConfigStore();

    expect(config.get('aiProvider')).toBe('gemini');
    expect(config.get('aiModel')).toBe('gemini-2.5-flash');
  });

  it('should prefer provider-specific model env vars over the shared model override', () => {
    process.env['LOGCAT_AI_PROVIDER'] = 'openai';
    process.env['LOGCAT_AI_MODEL'] = 'gpt-5.4';
    process.env['OPENAI_MODEL'] = 'gpt-5-mini';

    resetConfigStore();
    const config = getConfigStore();

    expect(config.get('aiModel')).toBe('gpt-5-mini');
  });

  it('should clamp invalid numeric env values to safe ranges', () => {
    process.env['LOGCAT_AI_CONCURRENCY'] = '99';
    process.env['LOGCAT_AI_RETRIES'] = '-4';
    process.env['OPENAI_TIMEOUT_MS'] = 'oops';
    process.env['LOGCAT_SIGNATURE_MODE'] = 'invalid-mode';

    resetConfigStore();
    const config = getConfigStore();

    expect(config.get('aiConcurrency')).toBe(5);
    expect(config.get('aiMaxRetries')).toBe(0);
    expect(config.get('aiTimeoutMs')).toBe(30000);
    expect(config.get('logcatSignatureMode')).toBe('hash');
  });

  it('should normalize invalid runtime updates', () => {
    const config = getConfigStore();

    config.update({
      aiConcurrency: Number.NaN,
      aiDailyBudget: -10,
      logcatMaxLines: 999999,
      aiProvider: 'invalid' as Config['aiProvider'],
    });

    expect(config.get('aiConcurrency')).toBe(1);
    expect(config.get('aiDailyBudget')).toBe(0);
    expect(config.get('logcatMaxLines')).toBe(50000);
    expect(config.get('aiProvider')).toBe('openai');
  });
});
