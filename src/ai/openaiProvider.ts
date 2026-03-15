import OpenAI from 'openai';
import { AiProviderError, getErrorCode, getErrorMessage, getErrorStatus } from '../errors.js';
import {
  DEFAULT_OPENAI_MODEL_FALLBACKS,
  resolveConfiguredModel,
} from './modelDefaults.js';
import type { IAiProvider, AnalysisInput, AnalysisResult } from './provider.js';
import { redactMessage } from './masking.js';
import { makeLimiter as defaultMakeLimiter } from './rateLimiter.js';

const isSeverity = (value: unknown): value is NonNullable<AnalysisResult['severity']> =>
  value === 'low' || value === 'medium' || value === 'high' || value === 'critical';

export interface OpenAiProviderOptions {
  readonly model?: string | undefined;
  /** Optional OpenAI-compatible base URL (e.g., http://localhost:11434/v1 for Ollama) */
  readonly baseURL?: string | undefined;
  /** Max characters from the error message included in the prompt */
  readonly maxMessageChars?: number | undefined;
  /** Max characters from surrounding context included in the prompt */
  readonly maxContextChars?: number | undefined;
  /** System prompt to steer behavior */
  readonly systemPrompt?: string | undefined;
  /** Extra user instructions appended to the prompt */
  readonly extraUserInstructions?: string | string[] | undefined;
  /** Request timeout in milliseconds */
  readonly timeoutMs?: number | undefined;
  /** Max retry attempts on retryable errors */
  readonly maxRetries?: number | undefined;
  /** Base delay for exponential backoff (ms) */
  readonly retryBaseMs?: number | undefined;
  /** Concurrency for shared limiter; if a limiter is supplied it's used as-is */
  readonly concurrency?: number | undefined;
  /** Custom limiter (from makeLimiter) to share across providers/call-sites */
  readonly limiter?: (<T>(task: () => Promise<T>) => Promise<T>) | undefined;
  /** Optional model fallback list to try if the primary fails with model errors */
  readonly modelFallbacks?: string[] | undefined;
  /** Custom redact function or extra redactors; default uses redactMessage */
  readonly redact?: ((s: string) => string) | undefined;
}

interface InternalOptions {
  readonly maxMessageChars: number;
  readonly maxContextChars: number;
  readonly systemPrompt: string;
  readonly extraUserInstructions: string | string[];
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly retryBaseMs: number;
  readonly concurrency: number;
  readonly limiter: <T>(task: () => Promise<T>) => Promise<T>;
  readonly modelFallbacks: string[];
  readonly redact: (s: string) => string;
  readonly baseURL?: string | undefined;
}

/**
 * Simple AI provider that uses the OpenAI API to summarise errors and
 * suggest next steps.  It sends a structured prompt and expects
 * JSON output containing summary, likely causes, next steps and
 * severity.
 */
export class OpenAiProvider implements IAiProvider {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly options: InternalOptions;

  constructor(
    apiKey: string | undefined,
    modelOrOptions: string | OpenAiProviderOptions = {},
    injectedClient?: OpenAI
  ) {
    const baseOptions: OpenAiProviderOptions =
      typeof modelOrOptions === 'string' ? { model: modelOrOptions } : modelOrOptions;
    const resolvedModel = resolveConfiguredModel('openai', {
      explicitModel: baseOptions.model,
    });

    const resolvedBaseURL =
      (typeof baseOptions.baseURL === 'string' && baseOptions.baseURL) ||
      undefined;

    const resolved: InternalOptions = {
      maxMessageChars: baseOptions.maxMessageChars || 2000,
      maxContextChars: baseOptions.maxContextChars || 4000,
      systemPrompt:
        baseOptions.systemPrompt ||
        'You are an expert Android debugging assistant. Be concise and actionable.',
      extraUserInstructions: baseOptions.extraUserInstructions || [],
      // For local OpenAI-compatible servers (baseURL set), default to 60s; otherwise 30s
      timeoutMs:
        baseOptions.timeoutMs ||
        (resolvedBaseURL ? 60000 : 30000),
      maxRetries: baseOptions.maxRetries ?? 2,
      retryBaseMs: baseOptions.retryBaseMs || 500,
      concurrency: baseOptions.concurrency || 1,
      limiter:
        baseOptions.limiter ||
        defaultMakeLimiter(
          baseOptions.concurrency || 1
        ),
      modelFallbacks: baseOptions.modelFallbacks || [...DEFAULT_OPENAI_MODEL_FALLBACKS],
      redact: baseOptions.redact || ((s: string) => redactMessage(s)),
      baseURL: resolvedBaseURL,
    };

    this.model = resolvedModel;
    this.options = resolved;

    // If pointing to a local OpenAI-compatible server, allow missing API key by using a placeholder
    const effectiveApiKey = apiKey || 'sk-local';
    const clientConfig: ConstructorParameters<typeof OpenAI>[0] = this.options.baseURL
      ? { apiKey: effectiveApiKey, baseURL: this.options.baseURL }
      : { apiKey: effectiveApiKey };

    this.client = injectedClient || new OpenAI(clientConfig);
  }

  name(): string {
    return `openai:${this.model}`;
  }

  async analyze(input: AnalysisInput): Promise<AnalysisResult> {
    const redact = this.options.redact;
    // Limit message and surrounding context according to options
    const msg = redact(input.match.entry.message).slice(0, this.options.maxMessageChars);
    const around = input.surrounding
      .map(e => `[${e.priority}] ${e.tag}(${e.pid}): ${redact(e.message)}`)
      .join('\n')
      .slice(0, this.options.maxContextChars);

    let extra: string[] = [];
    const eui = this.options.extraUserInstructions;
    if (Array.isArray(eui)) extra = eui;
    else if (typeof eui === 'string' && eui) extra = [eui];

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

    const exec = async (modelToUse: string, signal: AbortSignal) => {
      return await this.client.chat.completions.create(
        {
          model: modelToUse,
          temperature: 0.2,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          response_format: { type: 'json_object' },
        },
        { signal }
      );
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
            const completion = await exec(m, controller.signal);
            const content = completion.choices[0]?.message?.content || '{}';
            return { content, usedModel: m };
          } catch (err: unknown) {
            lastErr = err;
            // If error indicates invalid model, try next; otherwise rethrow
            const msg = getErrorMessage(err);
            const status = getErrorStatus(err);
            const isModelError = status === 404 || /model.*not.*found/i.test(msg);
            if (!isModelError) throw err;
            // else continue to next model
          }
        }
        throw lastErr;
      } finally {
        clearTimeout(to);
      }
    };

    const isRetryable = (err: unknown) => {
      const status = getErrorStatus(err);
      const code = getErrorCode(err);
      const msg = getErrorMessage(err);
      return (
        status === 429 ||
        (typeof status === 'number' && status >= 500) ||
        code === 'ETIMEDOUT' ||
        code === 'ECONNRESET' ||
        /timeout/i.test(msg)
      );
    };

    let attempt = 0;
    // Use shared limiter for concurrency
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
      // Log and rethrow so callers can handle/log too
      const message = getErrorMessage(err);
      console.error('[OpenAiProvider] request failed:', message);
      throw new AiProviderError(`OpenAI request failed: ${message}`, { cause: err });
    }

    let json: Record<string, unknown>;
    try {
      const parsed = JSON.parse(content);
      json = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      console.error('[OpenAiProvider] JSON parse failed; content:', content);
      json = {};
    }

    // Normalize possibly structured array items into strings
    const toStringItem = (v: unknown): string => {
      if (typeof v === 'string') return v;
      if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        if (typeof o['text'] === 'string') return o['text'];
        if (typeof o['step'] === 'string') return o['step'];
        if (typeof o['message'] === 'string') return o['message'];
      }
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    };
    const toStringArray = (arr: unknown): string[] =>
      Array.isArray(arr)
        ? arr.map(toStringItem).filter((value): value is string => typeof value === 'string')
        : [];

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
