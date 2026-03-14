import { GoogleGenerativeAI } from '@google/generative-ai';
import { AiProviderError, getErrorCode, getErrorMessage, getErrorStatus } from '../errors.js';
import type { IAiProvider, AnalysisInput, AnalysisResult } from './provider.js';
import { redactMessage } from './masking.js';
import { makeLimiter as defaultMakeLimiter } from './rateLimiter.js';

const isSeverity = (value: unknown): value is NonNullable<AnalysisResult['severity']> =>
  value === 'low' || value === 'medium' || value === 'high' || value === 'critical';

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
};

export interface GeminiProviderOptions {
  model?: string;
  /** Max characters from the error message included in the prompt */
  maxMessageChars?: number;
  /** Max characters from surrounding context included in the prompt */
  maxContextChars?: number;
  /** System prompt to steer behavior */
  systemPrompt?: string;
  /** Extra user instructions appended to the prompt */
  extraUserInstructions?: string | string[];
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  /** Max retry attempts on retryable errors */
  maxRetries?: number;
  /** Base delay for exponential backoff (ms) */
  retryBaseMs?: number;
  /** Concurrency for shared limiter; if a limiter is supplied it's used as-is */
  concurrency?: number;
  /** Custom limiter (from makeLimiter) to share across providers/call-sites */
  limiter?: <T>(task: () => Promise<T>) => Promise<T>;
  /** Optional model fallback list to try if the primary fails with model errors */
  modelFallbacks?: string[];
  /** Custom redact function or extra redactors; default uses redactMessage */
  redact?: (s: string) => string;
}

/**
 * Simple AI provider that uses the Gemini API to summarise errors and
 * suggest next steps.  It sends a structured prompt and expects
 * JSON output containing summary, likely causes, next steps and
 * severity.
 */
export class GeminiProvider implements IAiProvider {
  private readonly client: GoogleGenerativeAI;
  private readonly model: string;
  private readonly options: Required<
    Omit<GeminiProviderOptions, 'limiter' | 'modelFallbacks' | 'redact' | 'model'>
  > & {
    limiter: <T>(task: () => Promise<T>) => Promise<T>;
    modelFallbacks: string[];
    redact: (s: string) => string;
  };

  constructor(
    apiKey: string,
    modelOrOptions: string | GeminiProviderOptions = 'gemini-1.5-flash-latest',
    client?: GoogleGenerativeAI
  ) {
    const env = (k: string) => process.env[k];

    const baseOptions: GeminiProviderOptions =
      typeof modelOrOptions === 'string' ? { model: modelOrOptions } : modelOrOptions;

    const resolved: Required<
      Omit<GeminiProviderOptions, 'limiter' | 'modelFallbacks' | 'redact' | 'model'>
    > & {
      limiter: <T>(task: () => Promise<T>) => Promise<T>;
      modelFallbacks: string[];
      redact: (s: string) => string;
    } = {
      maxMessageChars:
        parseInt(env('LOGCAT_AI_MAX_MSG_CHARS') || '') || baseOptions.maxMessageChars || 2000,
      maxContextChars:
        parseInt(env('LOGCAT_AI_MAX_CTX_CHARS') || '') || baseOptions.maxContextChars || 4000,
      systemPrompt:
        baseOptions.systemPrompt ||
        'You are an expert Android debugging assistant. Be concise and actionable.',
      extraUserInstructions: baseOptions.extraUserInstructions || [],
      timeoutMs: parseInt(env('GEMINI_TIMEOUT_MS') || '') || baseOptions.timeoutMs || 15000,
      maxRetries: parseInt(env('LOGCAT_AI_RETRIES') || '') || baseOptions.maxRetries || 2,
      retryBaseMs: parseInt(env('LOGCAT_AI_RETRY_BASE_MS') || '') || baseOptions.retryBaseMs || 500,
      concurrency: parseInt(env('LOGCAT_AI_CONCURRENCY') || '') || baseOptions.concurrency || 1,
      limiter:
        baseOptions.limiter ||
        defaultMakeLimiter(
          parseInt(env('LOGCAT_AI_CONCURRENCY') || '') || baseOptions.concurrency || 1
        ),
      modelFallbacks: baseOptions.modelFallbacks || [],
      redact: baseOptions.redact || ((s: string) => redactMessage(s)),
    };

    this.model = baseOptions.model || env('LOGCAT_AI_MODEL') || 'gemini-1.5-flash-latest';
    this.options = resolved;
    this.client = client ?? new GoogleGenerativeAI(apiKey);
  }

  name(): string {
    return `gemini:${this.model}`;
  }

  async analyze(input: AnalysisInput): Promise<AnalysisResult> {
    const redact = this.options.redact;
    const msg = redact(input.match.entry.message).slice(0, this.options.maxMessageChars);
    const around = input.surrounding
      .map(e => `[${e.priority}] ${e.tag}(${e.pid}): ${redact(e.message)}`)
      .join('\n')
      .slice(0, this.options.maxContextChars);

    const extra = Array.isArray(this.options.extraUserInstructions)
      ? this.options.extraUserInstructions
      : this.options.extraUserInstructions
        ? [this.options.extraUserInstructions]
        : [];

    const system = this.options.systemPrompt;
    const user = [
      'Analyze this Android logcat error and suggest likely causes and next steps.',
      `Pattern: ${input.match.pattern.name}`,
      input.deviceInfo ? `Device: ${JSON.stringify(input.deviceInfo)}` : '',
      'Error message/stack:',
      '---',
      msg,
      '---',
      'Surrounding lines:',
      '---',
      around,
      '---',
      'Return JSON fields: summary, likelyCauses[], suggestedNextSteps[], severity in {low,medium,high,critical}.',
      ...extra,
    ]
      .filter(Boolean)
      .join('\n');

    const exec = async (modelToUse: string, _signal: AbortSignal) => {
      const model = this.client.getGenerativeModel({
        model: modelToUse,
        systemInstruction: system,
      });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });
      return result.response;
    };

    const attemptRequest = async (): Promise<{ content: string; usedModel: string }> => {
      const controller = new AbortController();
      const to = setTimeout(() => controller.abort(new Error('timeout')), this.options.timeoutMs);
      const modelsToTry = [
        this.model,
        ...this.options.modelFallbacks.filter(m => m !== this.model),
      ];

      try {
        let lastErr: unknown;
        for (const m of modelsToTry) {
          try {
            const response = await exec(m, controller.signal);
            const content = response.text();
            return { content, usedModel: m };
          } catch (err: unknown) {
            lastErr = err;
            const isModelError = false;
            if (!isModelError) throw err;
          }
        }
        throw lastErr;
      } finally {
        clearTimeout(to);
      }
    };

    const isRetryable = (err: unknown) => {
      if (!err) return false;
      // Normalize fields
      const status = getErrorStatus(err);
      const code = String(getErrorCode(err) ?? (err instanceof Error ? err.name : ''));
      const msg = getErrorMessage(err).toLowerCase();

      // HTTP statuses from SDK or fetch-like errors
      if (typeof status === 'number') {
        if (status === 429) return true; // rate limit
        if (status >= 500) return true; // server errors
      }

      // Common transient network error codes
      const transientCodes = new Set([
        'ECONNRESET',
        'ETIMEDOUT',
        'EAI_AGAIN',
        'ENETUNREACH',
        'ECONNREFUSED',
        'EHOSTUNREACH',
        'EPIPE',
        'UND_ERR_CONNECT_TIMEOUT',
      ]);
      if (transientCodes.has(code)) return true;

      // Abort caused by our timeout controller: allow retry once or twice
      if (code === 'AbortError' || msg.includes('timeout')) return true;

      // Text-based hints
      if (msg.includes('rate limit') || msg.includes('quota') || msg.includes('temporar')) {
        return true;
      }

      return false;
    };

    let attempt = 0;
    const run = async (): Promise<{ content: string; usedModel: string }> => {
      return this.options.limiter(async () => {
        try {
          return await attemptRequest();
        } catch (err) {
          attempt++;
          if (attempt > this.options.maxRetries || !isRetryable(err)) throw err;
          const delay = this.options.retryBaseMs * Math.pow(2, attempt - 1);
          await new Promise(res => setTimeout(res, delay));
          return await run();
        }
      });
    };

    let content: string;
    let usedModel: string;
    try {
      const result = await run();
      content = result.content;
      usedModel = result.usedModel;
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      console.error('[GeminiProvider] request failed:', message);
      throw new AiProviderError(`Gemini request failed: ${message}`, { cause: err });
    }

    let json: Record<string, unknown>;
    try {
      const parsed = JSON.parse(content);
      json = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      console.error('[GeminiProvider] JSON parse failed; content:', content);
      json = {};
    }

    const result: AnalysisResult = {
      summary: typeof json['summary'] === 'string' ? json['summary'] : 'No summary.',
      likelyCauses: toStringArray(json['likelyCauses']),
      suggestedNextSteps: toStringArray(json['suggestedNextSteps']),
      severity: isSeverity(json['severity']) ? json['severity'] : 'medium',
      model: usedModel,
    };
    if (input.match.signature) {
      result.signature = input.match.signature;
    }
    return result;
  }
}
