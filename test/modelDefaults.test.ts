import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_AI_PROVIDER,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENAI_MODEL,
  resolveConfiguredModel,
  resolveConfiguredProvider,
} from '../src/ai/modelDefaults.js';

describe('model default resolution', () => {
  const clearEnv = () => {
    delete process.env['LOGCAT_AI_PROVIDER'];
    delete process.env['LOGCAT_AI_MODEL'];
    delete process.env['OPENAI_MODEL'];
    delete process.env['GEMINI_MODEL'];
  };

  beforeEach(() => {
    clearEnv();
  });

  afterEach(() => {
    clearEnv();
  });

  it('returns the built-in provider default when no overrides are set', () => {
    expect(resolveConfiguredProvider()).toBe(DEFAULT_AI_PROVIDER);
  });

  it('prefers the configured provider when no explicit provider is supplied', () => {
    process.env['LOGCAT_AI_PROVIDER'] = 'gemini';

    expect(resolveConfiguredProvider()).toBe('gemini');
  });

  it('returns the built-in provider defaults when no overrides are set', () => {
    expect(resolveConfiguredModel('openai')).toBe(DEFAULT_OPENAI_MODEL);
    expect(resolveConfiguredModel('gemini')).toBe(DEFAULT_GEMINI_MODEL);
  });

  it('prefers the explicit model over env-based overrides', () => {
    process.env['OPENAI_MODEL'] = 'gpt-5.4';
    process.env['LOGCAT_AI_MODEL'] = 'gpt-4o-mini';

    expect(resolveConfiguredModel('openai', { explicitModel: 'gpt-5-mini' })).toBe('gpt-5-mini');
  });

  it('prefers provider-specific env vars over the shared model override', () => {
    process.env['LOGCAT_AI_MODEL'] = 'gemini-flash-latest';
    process.env['GEMINI_MODEL'] = 'gemini-2.5-flash-lite';

    expect(resolveConfiguredModel('gemini')).toBe('gemini-2.5-flash-lite');
  });
});
