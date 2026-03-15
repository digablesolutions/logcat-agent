/*
  Minimal smoke test to exercise the AI provider without adb.
  Usage examples:
    npm run ai:smoke -- --provider openai --model llama3.1:8b --openai-base-url http://localhost:11434/v1
    npm run ai:smoke -- --provider openai --model phi3:mini --openai-base-url http://localhost:11434/v1
    OPENAI_API_KEY=sk-... npm run ai:smoke -- --provider openai --model gpt-5-mini
    GEMINI_API_KEY=... npm run ai:smoke -- --provider gemini --model gemini-2.5-flash
    # No AI calls (noop):
    npm run ai:smoke -- --provider noop
*/

import { parseArgs as nodeParseArgs } from 'node:util';
import { resolveConfiguredModel } from '../src/ai/modelDefaults.js';
import type { IAiProvider, AnalysisInput, AnalysisResult } from '../src/ai/provider.js';
import { OpenAiProvider } from '../src/ai/openaiProvider.js';
import { GeminiProvider } from '../src/ai/geminiProvider.js';
import type { ILogEntry, IPattern, IPatternMatch } from '../src/pipeline/types.js';

function parseArgs(argv: string[]) {
  const { values } = nodeParseArgs({
    args: argv,
    strict: false,
  });
  return values as Record<string, unknown>;
}

function makeMockData(): { match: IPatternMatch; surrounding: ILogEntry[] } {
  const pattern: IPattern = {
    name: 'NullPointerException',
    regex: /NullPointerException/i,
    severity: 'error',
    description: 'Java NPE detected in log message'
  };
  const entry: ILogEntry = {
    timestamp: new Date(),
    priority: 'E',
    tag: 'AndroidRuntime',
    pid: 1234,
    message:
      'FATAL EXCEPTION: main\n' +
      'java.lang.NullPointerException: Cannot read field x of null\n' +
      '    at com.example.app.MainActivity.onCreate(MainActivity.java:42)'
  };
  const matchArr = (entry.message.match(pattern.regex) as RegExpMatchArray) || [''];
  const match: IPatternMatch = { pattern, entry, match: matchArr, signature: 'mock-npe-signature' };
  const surrounding: ILogEntry[] = [
    {
      timestamp: new Date(Date.now() - 2000),
      priority: 'I',
      tag: 'ActivityManager',
      pid: 100,
      message: 'Start proc com.example.app for activity'
    },
    {
      timestamp: new Date(Date.now() - 1500),
      priority: 'D',
      tag: 'MainActivity',
      pid: 1234,
      message: 'onCreate()'
    },
    {
      timestamp: new Date(Date.now() - 1000),
      priority: 'W',
      tag: 'ResourceType',
      pid: 1234,
      message: 'Failed to resolve attribute'
    }
  ];
  return { match, surrounding };
}

function makeNoopProvider(): IAiProvider {
  return {
    name: () => 'noop',
    async analyze(input: AnalysisInput): Promise<AnalysisResult> {
      return {
        signature: input.match.signature,
        summary: 'No-op analysis (AI disabled for smoke test). Pattern recognized and flow exercised.',
        likelyCauses: ['smoke-test', 'mocked stack trace'],
        suggestedNextSteps: [
          'Run with --provider openai --model <name> to exercise real AI',
          'Or integrate a local OpenAI-compatible endpoint via --openai-base-url'
        ],
        severity: 'high',
        model: 'noop'
      };
    }
  };
}

function createProvider(providerName: string, model: string, args: Record<string, unknown>): IAiProvider {
  if (providerName === 'noop' || providerName === 'none') return makeNoopProvider();
  if (providerName === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseURL = (args['openai-base-url'] as string) || process.env.OPENAI_BASE_URL || process.env.LOGCAT_OPENAI_BASE_URL;
    return new OpenAiProvider(apiKey, baseURL ? { model, baseURL } : { model });
  }
  if (providerName === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is required for Gemini');
    return new GeminiProvider(apiKey, model);
  }
  throw new Error(`Unknown provider: ${providerName}`);
}

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const providerName = String(args.provider || 'openai');
  const model =
    providerName === 'gemini'
      ? resolveConfiguredModel('gemini', {
          explicitModel: typeof args.model === 'string' ? args.model : undefined,
        })
      : resolveConfiguredModel('openai', {
          explicitModel: typeof args.model === 'string' ? args.model : undefined,
        });

  let provider: IAiProvider;
  try {
    provider = createProvider(providerName, model, args);
  } catch (e: any) {
    console.error('[ai-smoke] Provider setup failed:', e?.message || e);
    process.exit(1);
    return;
  }

  const { match, surrounding } = makeMockData();
  const input: AnalysisInput = {
    match,
    surrounding,
    deviceInfo: { model: 'Pixel 7', androidVersion: '14', appVersion: '1.2.3' }
  };

  console.log(`[ai-smoke] Using provider: ${provider.name()}`);
  try {
    const result = await provider.analyze(input);
    console.log('--- AI Analysis Result ---');
    console.log(`summary: ${result.summary}`);
    if (result.likelyCauses?.length) {
      console.log('likelyCauses:');
      for (const c of result.likelyCauses) console.log(` - ${c}`);
    }
    if (result.suggestedNextSteps?.length) {
      console.log('suggestedNextSteps:');
      for (const s of result.suggestedNextSteps) console.log(` - ${s}`);
    }
    if (result.severity) console.log(`severity: ${result.severity}`);
    if (result.model) console.log(`model: ${result.model}`);
    console.log('--------------------------');
  } catch (err: any) {
    console.error('[ai-smoke] Analysis failed:', err?.message || err);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[ai-smoke] Failed:', err?.message || err);
  process.exit(1);
});
