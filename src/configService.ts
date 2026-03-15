import 'dotenv/config';
import { getDefaultModelForProvider, resolveConfiguredModel } from './ai/modelDefaults.js';

const AI_PROVIDERS = ['openai', 'gemini'] as const;
const LOG_PRIORITIES = ['V', 'D', 'I', 'W', 'E', 'F'] as const;
const SIGNATURE_MODES = ['hash', 'fuzzy', 'both'] as const;

const normalizeOptionalString = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const normalizeStringArray = (values: ReadonlyArray<string> | undefined): string[] | undefined => {
  if (!values) return undefined;

  const normalized = values
    .map((value) => value.trim())
    .filter(Boolean);

  return normalized.length > 0 ? normalized : undefined;
};

const clampInteger = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return fallback;

  const normalized = Math.trunc(parsed);
  return Math.min(max, Math.max(min, normalized));
};

const normalizeEnum = <T extends string>(
  value: string,
  allowed: ReadonlyArray<T>,
  fallback: T
): T => {
  return allowed.includes(value as T) ? (value as T) : fallback;
};

export interface Config {
  // AI
  aiEnabled: boolean;
  aiProvider: 'openai' | 'gemini';
  aiModel: string;
  aiBaseUrl?: string | undefined;
  aiApiKey?: string | undefined;
  aiMaxMessageChars: number;
  aiMaxContextChars: number;
  aiTimeoutMs: number;
  aiMaxRetries: number;
  aiRetryBaseMs: number;
  aiConcurrency: number;
  aiSamplePerSignatureMs: number;
  aiDailyBudget: number;

  // ADB
  adbWifiTimeout: number;

  // Logcat
  logcatBuffers: string[];
  logcatMinPriority: string;
  logcatTags?: string[] | undefined;
  logcatFilterExpr?: string[] | undefined;
  logcatMaxLines: number;
  logcatSignatureMode: 'hash' | 'fuzzy' | 'both';

  // Sinks
  exportJsonlDir?: string | undefined;
  lokiUrl?: string | undefined;
  lokiTenant?: string | undefined;
  lokiBatchMs: number;
  lokiBatchSize: number;
}

export interface ConfigStore {
  readonly get: <K extends keyof Config>(key: K) => Config[K];
  readonly update: (overrides: Partial<Config>) => void;
}

const normalizeConfig = (config: Config): Config => {
  const aiProvider = normalizeEnum(config.aiProvider, AI_PROVIDERS, 'openai');

  return {
    aiEnabled: Boolean(config.aiEnabled),
    aiProvider,
    aiModel: normalizeOptionalString(config.aiModel) ?? getDefaultModelForProvider(aiProvider),
    aiBaseUrl: normalizeOptionalString(config.aiBaseUrl),
    aiApiKey: normalizeOptionalString(config.aiApiKey),
    aiMaxMessageChars: clampInteger(config.aiMaxMessageChars, 2000, 256, 20000),
    aiMaxContextChars: clampInteger(config.aiMaxContextChars, 4000, 256, 50000),
    aiTimeoutMs: clampInteger(config.aiTimeoutMs, 30000, 1000, 120000),
    aiMaxRetries: clampInteger(config.aiMaxRetries, 2, 0, 10),
    aiRetryBaseMs: clampInteger(config.aiRetryBaseMs, 500, 100, 10000),
    aiConcurrency: clampInteger(config.aiConcurrency, 1, 1, 5),
    aiSamplePerSignatureMs: clampInteger(config.aiSamplePerSignatureMs, 3600000, 0, 86400000),
    aiDailyBudget: clampInteger(config.aiDailyBudget, 50, 0, 10000),
    adbWifiTimeout: clampInteger(config.adbWifiTimeout, 90000, 1000, 300000),
    logcatBuffers: normalizeStringArray(config.logcatBuffers) ?? ['main', 'crash'],
    logcatMinPriority: normalizeEnum(config.logcatMinPriority, LOG_PRIORITIES, 'I'),
    logcatTags: normalizeStringArray(config.logcatTags),
    logcatFilterExpr: normalizeStringArray(config.logcatFilterExpr),
    logcatMaxLines: clampInteger(config.logcatMaxLines, 5000, 100, 50000),
    logcatSignatureMode: normalizeEnum(config.logcatSignatureMode, SIGNATURE_MODES, 'hash'),
    exportJsonlDir: normalizeOptionalString(config.exportJsonlDir),
    lokiUrl: normalizeOptionalString(config.lokiUrl),
    lokiTenant: normalizeOptionalString(config.lokiTenant),
    lokiBatchMs: clampInteger(config.lokiBatchMs, 1000, 100, 60000),
    lokiBatchSize: clampInteger(config.lokiBatchSize, 500, 1, 10000),
  };
};

const loadConfigFromEnv = (): Config => {
  const env = (k: string, def = '') => process.env[k] || def;
  const int = (k: string, def: number) => {
    const parsed = Number.parseInt(env(k, String(def)), 10);
    return Number.isFinite(parsed) ? parsed : def;
  };
  const aiProvider = normalizeEnum(env('LOGCAT_AI_PROVIDER', 'openai'), AI_PROVIDERS, 'openai');

  return {
    aiEnabled: true,
    aiProvider,
    aiModel: resolveConfiguredModel(aiProvider, { env: process.env }),
    aiBaseUrl: env('LOGCAT_OPENAI_BASE_URL') || env('OPENAI_BASE_URL'),
    aiApiKey: env('OPENAI_API_KEY') || env('GEMINI_API_KEY'),
    aiMaxMessageChars: int('LOGCAT_AI_MAX_MSG_CHARS', 2000),
    aiMaxContextChars: int('LOGCAT_AI_MAX_CTX_CHARS', 4000),
    aiTimeoutMs: int('OPENAI_TIMEOUT_MS', 30000),
    aiMaxRetries: int('LOGCAT_AI_RETRIES', 2),
    aiRetryBaseMs: int('LOGCAT_AI_RETRY_BASE_MS', 500),
    aiConcurrency: int('LOGCAT_AI_CONCURRENCY', 1),
    aiSamplePerSignatureMs: int('LOGCAT_AI_SAMPLE_PER_SIGNATURE_MS', 3600000),
    aiDailyBudget: int('LOGCAT_AI_BUDGET_PER_DAY', 50),

    adbWifiTimeout: int('ADB_WIFI_TIMEOUT', 90000),

    logcatBuffers: ['main', 'crash'],
    logcatMinPriority: 'I',
    logcatMaxLines: 5000,
    logcatSignatureMode: (env('LOGCAT_SIGNATURE_MODE', 'hash') as 'hash' | 'fuzzy' | 'both'),

    lokiBatchMs: int('LOKI_BATCH_MS', 1000),
    lokiBatchSize: int('LOKI_BATCH_SIZE', 500),
  };
};

export const createConfigStore = (initialConfig: Config = loadConfigFromEnv()): ConfigStore => {
  let config = normalizeConfig(initialConfig);

  return {
    get: (key) => config[key],
    update: (overrides) => {
      config = normalizeConfig({ ...config, ...overrides });
    },
  };
};

let sharedConfigStore: ConfigStore | undefined;

export const getConfigStore = (): ConfigStore => {
  if (!sharedConfigStore) {
    sharedConfigStore = createConfigStore();
  }

  return sharedConfigStore;
};

export const resetConfigStore = (): void => {
  sharedConfigStore = undefined;
};
