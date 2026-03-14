import type { IPatternMatch, ILogEntry } from '../pipeline/types.js';

/**
 * Input to an AI provider.  Surrounding entries provide context around the
 * detected error and may be used by the AI model for richer analysis.
 */
export interface AnalysisInput {
  match: IPatternMatch;
  surrounding: ILogEntry[];
  deviceInfo?: { model?: string; androidVersion?: string; appVersion?: string };
}

/**
 * Output returned by an AI provider after analysing a log entry.
 */
export interface AnalysisResult {
  signature?: string;
  summary: string;
  likelyCauses?: string[];
  suggestedNextSteps?: string[];
  severity?: 'low' | 'medium' | 'high' | 'critical';
  model?: string;
}

/**
 * Abstraction for AI providers.  Implementations may call OpenAI, a local
 * model, or any other service.  The provider should not store any state
 * across calls unless explicitly needed for session handling.
 */
export interface IAiProvider {
  analyze(input: AnalysisInput): Promise<AnalysisResult>;
  name(): string;
}
