export type AiProviderName = 'openai' | 'gemini';

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

export const getDefaultModelForProvider = (provider: AiProviderName): string => {
  return provider === 'gemini' ? DEFAULT_GEMINI_MODEL : DEFAULT_OPENAI_MODEL;
};

export const resolveConfiguredModel = (
  provider: AiProviderName,
  options: Readonly<{
    explicitModel?: string | undefined;
    env?: NodeJS.ProcessEnv | undefined;
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