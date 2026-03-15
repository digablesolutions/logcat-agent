import { GeminiProvider, type GeminiProviderOptions } from '../ai/geminiProvider.js';
import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENAI_MODEL,
  resolveConfiguredModel,
} from '../ai/modelDefaults.js';
import { OpenAiProvider, type OpenAiProviderOptions } from '../ai/openaiProvider.js';
import type { IAiProvider } from '../ai/provider.js';
import { AppError } from '../errors.js';
import type { SignatureMode } from '../pipeline/dispatcher.js';
import type { Priority } from '../pipeline/types.js';

export const DEFAULT_LOGCAT_BUFFERS = ['main', 'crash'] as const;

const priorityValues: ReadonlySet<Priority> = new Set(['V', 'D', 'I', 'W', 'E', 'F', 'S']);

interface NumericFlagConstraints {
  minimum?: number;
  maximum?: number;
  integer?: boolean;
}

const parseCsvValues = (value: string | undefined): string[] =>
  value
    ?.split(',')
    .map(part => part.trim())
    .filter(Boolean) ?? [];

const parseNumericFlagValue = (
  value: string,
  flagName: string,
  constraints: NumericFlagConstraints = {}
): number => {
  const parsed = Number(value.trim());

  if (!Number.isFinite(parsed)) {
    throw new AppError(`Invalid ${flagName} value: ${value}. Expected a numeric value.`, {
      code: 'CONFIG_ERROR',
    });
  }

  if (constraints.integer && !Number.isInteger(parsed)) {
    throw new AppError(`Invalid ${flagName} value: ${value}. Expected an integer.`, {
      code: 'CONFIG_ERROR',
    });
  }

  if (constraints.minimum !== undefined && parsed < constraints.minimum) {
    throw new AppError(
      `Invalid ${flagName} value: ${value}. Expected a value >= ${constraints.minimum}.`,
      { code: 'CONFIG_ERROR' }
    );
  }

  if (constraints.maximum !== undefined && parsed > constraints.maximum) {
    throw new AppError(
      `Invalid ${flagName} value: ${value}. Expected a value <= ${constraints.maximum}.`,
      { code: 'CONFIG_ERROR' }
    );
  }

  return parsed;
};

export const parseIntegerFlagValue = (
  value: string,
  flagName: string,
  constraints: Omit<NumericFlagConstraints, 'integer'> = {}
): number => parseNumericFlagValue(value, flagName, { ...constraints, integer: true });

export const parseOptionalIntegerFlagValue = (
  value: string | undefined,
  flagName: string,
  constraints: Omit<NumericFlagConstraints, 'integer'> = {}
): number | undefined => (value === undefined ? undefined : parseIntegerFlagValue(value, flagName, constraints));

export const parseFloatFlagValue = (
  value: string,
  flagName: string,
  constraints: Omit<NumericFlagConstraints, 'integer'> = {}
): number => parseNumericFlagValue(value, flagName, constraints);

export const parseOptionalFloatFlagValue = (
  value: string | undefined,
  flagName: string,
  constraints: Omit<NumericFlagConstraints, 'integer'> = {}
): number | undefined => (value === undefined ? undefined : parseFloatFlagValue(value, flagName, constraints));

export const isSignatureMode = (value: string): value is SignatureMode =>
  value === 'hash' || value === 'fuzzy' || value === 'both';

export const requireSignatureMode = (
  value: string,
  flagName = '--signature-mode'
): SignatureMode => {
  if (!isSignatureMode(value)) {
    throw new AppError(
      `Invalid ${flagName} value: ${value}. Expected one of hash,fuzzy,both.`,
      { code: 'CONFIG_ERROR' }
    );
  }

  return value;
};

export const parsePriority = (value: string | undefined): Priority | undefined => {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  return priorityValues.has(normalized as Priority) ? (normalized as Priority) : undefined;
};

export const requirePriority = (
  value: string | undefined,
  flagName = '--min-priority'
): Priority | undefined => {
  const parsed = parsePriority(value);
  if (value && !parsed) {
    throw new AppError(
      `Invalid ${flagName} value: ${value}. Expected one of V,D,I,W,E,F,S.`,
      { code: 'CONFIG_ERROR' }
    );
  }

  return parsed;
};

export const parseBuffers = (
  value: string | undefined,
  fallback: ReadonlyArray<string> = DEFAULT_LOGCAT_BUFFERS
): string[] => {
  const parsed = parseCsvValues(value);
  return parsed.length > 0 ? parsed : [...fallback];
};

export const parseTagMap = (value: string | undefined): Record<string, boolean> | undefined => {
  const tags = parseCsvValues(value);
  return tags.length > 0 ? Object.fromEntries(tags.map(tag => [tag, true])) : undefined;
};

export interface AiProviderFactoryOptions {
  provider?: 'openai' | 'gemini' | undefined;
  model?: string | undefined;
  openaiApiKey?: string | undefined;
  openaiBaseUrl?: string | undefined;
  geminiApiKey?: string | undefined;
  openAiProviderOptions?: Omit<OpenAiProviderOptions, 'model' | 'baseURL'> | undefined;
  geminiProviderOptions?: Omit<GeminiProviderOptions, 'model'> | undefined;
  defaultOpenAiModel?: string | undefined;
  defaultGeminiModel?: string | undefined;
}

export const createAiProvider = (options: AiProviderFactoryOptions): IAiProvider => {
  const provider = options.provider ?? 'openai';

  if (provider === 'openai') {
    if (!options.openaiApiKey && !options.openaiBaseUrl) {
      throw new AppError(
        'Provide OPENAI_API_KEY or an OpenAI-compatible --openai-base-url / OPENAI_BASE_URL.',
        { code: 'CONFIG_ERROR' }
      );
    }

    return new OpenAiProvider(options.openaiApiKey, {
      ...(options.openAiProviderOptions ?? {}),
      model: resolveConfiguredModel('openai', {
        explicitModel: options.model ?? options.defaultOpenAiModel ?? DEFAULT_OPENAI_MODEL,
      }),
      ...(options.openaiBaseUrl ? { baseURL: options.openaiBaseUrl } : {}),
    });
  }

  if (provider === 'gemini') {
    if (!options.geminiApiKey) {
      throw new AppError('GEMINI_API_KEY is required when using the Gemini provider.', {
        code: 'CONFIG_ERROR',
      });
    }

    return new GeminiProvider(options.geminiApiKey, {
      ...(options.geminiProviderOptions ?? {}),
      model: resolveConfiguredModel('gemini', {
        explicitModel: options.model ?? options.defaultGeminiModel ?? DEFAULT_GEMINI_MODEL,
      }),
    });
  }

  throw new AppError('Unknown AI provider.', { code: 'CONFIG_ERROR' });
};
