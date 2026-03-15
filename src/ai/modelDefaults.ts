import { AppError } from '../errors.js';

export type AiProviderName = 'openai' | 'gemini';

const AI_PROVIDER_NAMES = ['openai', 'gemini'] as const;

export const DEFAULT_AI_PROVIDER: AiProviderName = 'openai';

export const DEFAULT_OPENAI_MODEL = 'gpt-5-mini';
export const DEFAULT_OPENAI_MODEL_FALLBACKS = ['gpt-5.4', 'gpt-4o-mini'] as const;

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
export const DEFAULT_GEMINI_MODEL_FALLBACKS = [
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
] as const;

const readEnvValue = (env: NodeJS.ProcessEnv, key: string): string | undefined => {
  const value = env[key]?.trim();
  return value ? value : undefined;
};

export const isAiProviderName = (value: string): value is AiProviderName => {
  return (AI_PROVIDER_NAMES as readonly string[]).includes(value);
};

const parseAiProviderName = (value: string | undefined): AiProviderName | undefined => {
  const normalized = value?.trim();
  return normalized && isAiProviderName(normalized) ? normalized : undefined;
};

export const resolveConfiguredProvider = (
  explicitProvider?: string,
  options: Readonly<{
    env?: NodeJS.ProcessEnv;
    rejectInvalidExplicit?: boolean;
    flagName?: string;
  }> = {}
): AiProviderName => {
  const parsedExplicitProvider = parseAiProviderName(explicitProvider);
  if (parsedExplicitProvider) {
    return parsedExplicitProvider;
  }

  if (explicitProvider?.trim() && options.rejectInvalidExplicit) {
    throw new AppError(
      `Invalid ${options.flagName ?? '--provider'} value: ${explicitProvider}. Expected one of openai,gemini.`,
      { code: 'CONFIG_ERROR' }
    );
  }

  const env = options.env ?? process.env;
  return parseAiProviderName(readEnvValue(env, 'LOGCAT_AI_PROVIDER')) ?? DEFAULT_AI_PROVIDER;
};

export const getDefaultModelForProvider = (provider: AiProviderName): string => {
  return provider === 'gemini' ? DEFAULT_GEMINI_MODEL : DEFAULT_OPENAI_MODEL;
};

export const resolveConfiguredModel = (
  provider: AiProviderName,
  options: Readonly<{
    explicitModel?: string | undefined;
    env?: NodeJS.ProcessEnv;
  }> = {}
): string => {
  const explicitModel = options.explicitModel?.trim();
  if (explicitModel) {
    return explicitModel;
  }

  const env = options.env ?? process.env;
  const providerSpecificModel =
    provider === 'gemini' ? readEnvValue(env, 'GEMINI_MODEL') : readEnvValue(env, 'OPENAI_MODEL');

  return providerSpecificModel ?? readEnvValue(env, 'LOGCAT_AI_MODEL') ?? getDefaultModelForProvider(provider);
};
