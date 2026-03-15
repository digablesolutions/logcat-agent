import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createAiProvider,
  parseFloatFlagValue,
  parseIntegerFlagValue,
  parseOptionalFloatFlagValue,
  parseOptionalIntegerFlagValue,
} from '../src/cli/logCommandSupport.js';

describe('logCommandSupport numeric parsing', () => {
  const clearEnv = () => {
    delete process.env['LOGCAT_AI_PROVIDER'];
    delete process.env['LOGCAT_AI_MODEL'];
    delete process.env['OPENAI_MODEL'];
  };

  beforeEach(() => {
    clearEnv();
  });

  afterEach(() => {
    clearEnv();
  });

  it('parses integers with bounds', () => {
    expect(parseIntegerFlagValue('0', '--timeout', { minimum: 0 })).toBe(0);
    expect(parseIntegerFlagValue('15', '--max-rate', { minimum: 1 })).toBe(15);
  });

  it('parses optional numbers when present', () => {
    expect(parseOptionalIntegerFlagValue(undefined, '--window-size', { minimum: 1 })).toBeUndefined();
    expect(parseOptionalFloatFlagValue('0.5', '--anomaly-threshold', { minimum: 0, maximum: 1 })).toBe(0.5);
  });

  it('rejects invalid numeric values', () => {
    expect(() => parseIntegerFlagValue('abc', '--timeout')).toThrow('Invalid --timeout value: abc. Expected a numeric value.');
    expect(() => parseIntegerFlagValue('1.5', '--window-size')).toThrow('Invalid --window-size value: 1.5. Expected an integer.');
    expect(() => parseFloatFlagValue('2', '--anomaly-threshold', { maximum: 1 })).toThrow('Invalid --anomaly-threshold value: 2. Expected a value <= 1.');
  });

  it('respects provider-specific env model overrides when no explicit model is supplied', () => {
    process.env['OPENAI_MODEL'] = 'gpt-5.4';
    process.env['LOGCAT_AI_MODEL'] = 'gpt-5-mini';

    const provider = createAiProvider({
      provider: 'openai',
      openaiBaseUrl: 'http://localhost:11434/v1',
    });

    expect(provider.name()).toBe('openai:gpt-5.4');
  });

  it('uses LOGCAT_AI_PROVIDER when no explicit provider is supplied', () => {
    process.env['LOGCAT_AI_PROVIDER'] = 'gemini';

    const provider = createAiProvider({
      geminiApiKey: 'test-key',
    });

    expect(provider.name()).toBe('gemini:gemini-2.5-flash');
  });
});
