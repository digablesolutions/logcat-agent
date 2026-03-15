import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenAiProvider } from '../src/ai/openaiProvider.js';
import type OpenAI from 'openai';
import type { AnalysisInput } from '../src/ai/provider.js';

function makeInput(): AnalysisInput {
  return {
    match: {
      pattern: { name: 'Test Pattern', regex: /Test Pattern/, severity: 'error' },
      entry: {
        timestamp: new Date(),
        pid: 123,
        tid: 456,
        priority: 'E',
        tag: 'TestTag',
        message: 'Test error message',
      },
      signature: 'sig-123',
      match: ['Test error message'] as RegExpMatchArray,
    },
    surrounding: [],
  };
}

describe('OpenAiProvider (OpenAI-compatible base URL)', () => {
  const clearEnv = () => {
    delete process.env['OPENAI_MODEL'];
    delete process.env['LOGCAT_AI_MODEL'];
  };

  beforeEach(() => {
    clearEnv();
  });

  afterEach(() => {
    clearEnv();
  });

  it('parses JSON result and propagates signature (with API key)', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: 'Ok',
              likelyCauses: ['A'],
              suggestedNextSteps: ['B'],
              severity: 'high',
            }),
          },
        },
      ],
    });
    const injected = {
      chat: { completions: { create: mockCreate } },
    } as unknown as OpenAI;

    const provider = new OpenAiProvider('sk-test', { model: 'gpt-5-mini' }, injected);
    const res = await provider.analyze(makeInput());
    expect(res.summary).toBe('Ok');
    expect(res.likelyCauses).toEqual(['A']);
    expect(res.suggestedNextSteps).toEqual(['B']);
    expect(res.severity).toBe('high');
    expect(res.signature).toBe('sig-123');
    expect(provider.name()).toContain('openai:');
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it('uses the refreshed default model when none is supplied', () => {
    const injected = {
      chat: { completions: { create: vi.fn() } },
    } as unknown as OpenAI;

    const provider = new OpenAiProvider('sk-test', {}, injected);
    expect(provider.name()).toBe('openai:gpt-5-mini');
  });

  it('works without OPENAI_API_KEY when baseURL is provided (local server)', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [
        { message: { content: JSON.stringify({ summary: 'Local OK', severity: 'medium' }) } },
      ],
    });
    const injected = {
      chat: { completions: { create: mockCreate } },
    } as unknown as OpenAI;

    const provider = new OpenAiProvider(
      undefined,
      { model: 'llama3.1:8b-instruct', baseURL: 'http://localhost:11434/v1' },
      injected
    );
    const res = await provider.analyze(makeInput());
    expect(res.summary).toBe('Local OK');
    expect(mockCreate).toHaveBeenCalledOnce();
  });
});
