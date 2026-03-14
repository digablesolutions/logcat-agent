# Class Audit

This audit tracks the remaining runtime classes after the `configService`, `logRenderer`, `sicpPlugin`, `pluginManager`, `performanceMonitor`, and `windowAnalyzer` reductions.

## Completed In This Wave

- `src/configService.ts` — refactored from a singleton class to `createConfigStore()`, `getConfigStore()`, and `resetConfigStore()`.
- `src/logRenderer.ts` — refactored from `ConsoleLogRenderer` to `createConsoleLogRenderer()` plus module-level rendering helpers.
- `src/sicpPlugin.ts` — flattened from `SicpPlugin` into the plain `sicpPlugin` object.
- `src/pluginManager.ts` — flattened from `PluginManager` into `createPluginManager()` plus a closure-backed plugin registry.
- `src/ai/realtime/performanceMonitor.ts` — flattened from `PerformanceMonitor` into `createPerformanceMonitor()`.
- `src/ai/realtime/windowAnalyzer.ts` — flattened from `WindowAnalyzer` into `createWindowAnalyzer()`.

## Labels

- `keep` — justified stateful/runtime boundary; no current refactor pressure.

## Remaining Runtime Classes

| File | Symbol | Label | Rationale |
| --- | --- | --- | --- |
| `src/errors.ts` | `AppError` | `keep` | Standard `Error` subclass carrying exit code and code metadata. |
| `src/errors.ts` | `AdbError` | `keep` | Domain-specific `Error` subclass used for CLI routing. |
| `src/errors.ts` | `AiProviderError` | `keep` | Domain-specific `Error` subclass used for provider failures. |
| `src/ai/openaiProvider.ts` | `OpenAiProvider` | `keep` | Encapsulates SDK client ownership, retries, and provider configuration. |
| `src/ai/geminiProvider.ts` | `GeminiProvider` | `keep` | Encapsulates SDK client ownership, retries, and provider configuration. |
| `src/ai/realtime/analysisEngine.ts` | `RealtimeAnalysisEngine` | `keep` | Stateful event-driven runtime object with lifecycle, timers, queues, and persistence. |
| `src/ai/realtime/anomalyDetector.ts` | `AnomalyDetector` | `keep` | Stateful statistical detector with persisted baselines and mutable history. |
| `src/ai/realtime/trendAnalyzer.ts` | `TrendAnalyzer` | `keep` | Stateful time-series analyzer with retained buckets and persistence hooks. |
| `src/ai/realtime/fileLogBuffer.ts` | `FileLogBuffer` | `keep` | Owns file-backed buffer state and async close/init lifecycle. |
| `src/ai/realtime/statePersistence.ts` | `FileStatePersistence` | `keep` | Resource-owning persistence adapter over the filesystem. |

## Notes

- The ESLint class allowlist in `eslint.config.mjs` is intentionally left stable; the audited keep-list and architectural test are now the source of truth for class inventory review.
- Test-only classes are intentionally excluded from this audit. They are treated as local test scaffolding, not architecture. 
