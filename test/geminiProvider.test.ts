import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GeminiProvider } from '../src/ai/geminiProvider.js';
import type { GoogleGenerativeAI } from '@google/generative-ai';
import type { AnalysisInput } from '../src/ai/provider.js';

describe('GeminiProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {};
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should call the Gemini API with the correct prompt and parse the response', async () => {
    const mockGenerateContent = vi.fn().mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
            summary: 'Test summary',
            likelyCauses: ['Test cause'],
            suggestedNextSteps: ['Test step'],
            severity: 'high',
          }),
      },
    });

    const mockClient = {
      getGenerativeModel: vi.fn(() => ({
        generateContent: mockGenerateContent,
      })),
    } as unknown as GoogleGenerativeAI;

    const provider = new GeminiProvider('test-api-key', 'gemini-2.5-flash', mockClient);
    const input: AnalysisInput = {
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
        signature: 'test-signature',
        match: ['Test error message'] as RegExpMatchArray,
      },
      surrounding: [],
    };

    const result = await provider.analyze(input);

    expect(result.summary).toBe('Test summary');
    expect(result.likelyCauses).toEqual(['Test cause']);
    expect(result.suggestedNextSteps).toEqual(['Test step']);
    expect(result.severity).toBe('high');
    expect(result.signature).toBe('test-signature');
    expect(mockGenerateContent).toHaveBeenCalledOnce();
  });

  it('uses the refreshed default model when none is supplied', () => {
    const mockClient = {
      getGenerativeModel: vi.fn(),
    } as unknown as GoogleGenerativeAI;

    const provider = new GeminiProvider('test-api-key', {}, mockClient);
    expect(provider.name()).toBe('gemini:gemini-2.5-flash');
  });
});
