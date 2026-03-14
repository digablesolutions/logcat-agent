import type { ILogEntry, Priority } from '../../pipeline/types.js';
import type { WindowAnalysisOptions, WindowSummaryAnalysis } from './types.js';

export type WindowAnalysisResult = Readonly<{
  summary: string;
  errorCount: number;
  warningCount: number;
  uniqueTags: string[];
  timeSpan: number;
  dominantPriority: Priority;
  hasStackTrace: boolean;
  hasPerformanceIssues: boolean;
}>;

export interface WindowAnalyzer {
  readonly getWindow: (buffer: ReadonlyArray<ILogEntry>, targetEntry: ILogEntry) => ILogEntry[];
  readonly getRelevantEntries: (buffer: ReadonlyArray<ILogEntry>, maxEntries?: number) => ILogEntry[];
  readonly analyzeWindow: (entries: ReadonlyArray<ILogEntry>) => WindowAnalysisResult;
  readonly updateWindowSize: (newSize: number) => void;
  readonly updateOptions: (options: Partial<WindowAnalysisOptions>) => void;
}

const defaultPriorityWeights: WindowAnalysisOptions['priorityWeights'] = {
  F: 10,
  E: 8,
  W: 4,
  I: 2,
  D: 1,
  V: 0.5,
  S: 1,
};

const createWindowAnalysisOptions = (
  windowSize: number,
  overrides?: Partial<WindowAnalysisOptions>
): WindowAnalysisOptions => {
  return {
    contextSize: Math.floor(windowSize * 0.3),
    priorityWeights: defaultPriorityWeights,
    focusOnErrors: true,
    includeMetadata: true,
    ...overrides,
  };
};

const calculateEntryScore = (
  entry: ILogEntry,
  index: number,
  totalEntries: number,
  options: WindowAnalysisOptions
): number => {
  let score = 0;
  score += options.priorityWeights[entry.priority] || 1;
  score += (index / totalEntries) * 2;

  const normalizedMessage = entry.message.toLowerCase();
  if (
    normalizedMessage.includes('exception') ||
    normalizedMessage.includes('error') ||
    normalizedMessage.includes('failed') ||
    normalizedMessage.includes('crash')
  ) {
    score += 5;
  }

  if (entry.message.includes('at ') && (entry.message.includes('.java:') || entry.message.includes('.kt:'))) {
    score += 3;
  }

  if (
    normalizedMessage.includes('anr') ||
    normalizedMessage.includes('memory') ||
    normalizedMessage.includes('gc') ||
    normalizedMessage.includes('timeout')
  ) {
    score += 4;
  }

  return score;
};

const generateWindowSummary = (
  entries: ReadonlyArray<ILogEntry>,
  analysis: WindowSummaryAnalysis
): string => {
  const parts = [`${entries.length} entries`];

  if (analysis.timeSpan > 0) {
    parts.push(`${Math.round(analysis.timeSpan / 1000)}s span`);
  }

  if (analysis.errorCount > 0) {
    parts.push(`${analysis.errorCount} errors`);
  }

  if (analysis.warningCount > 0) {
    parts.push(`${analysis.warningCount} warnings`);
  }

  if (analysis.uniqueTags.length > 0) {
    parts.push(`${analysis.uniqueTags.length} tags`);
  }

  if (analysis.hasStackTrace) {
    parts.push('stack traces');
  }

  if (analysis.hasPerformanceIssues) {
    parts.push('performance issues');
  }

  return parts.join(', ');
};

export const createWindowAnalyzer = (
  initialWindowSize: number,
  initialOptions?: Partial<WindowAnalysisOptions>
): WindowAnalyzer => {
  let windowSize = initialWindowSize;
  let options = createWindowAnalysisOptions(initialWindowSize, initialOptions);

  return {
    getWindow: (buffer, targetEntry) => {
      const targetIndex = buffer.indexOf(targetEntry);
      if (targetIndex === -1) {
        return buffer.slice(-windowSize);
      }

      const startIndex = Math.max(0, targetIndex - options.contextSize);
      const endIndex = Math.min(buffer.length, targetIndex + options.contextSize + 1);

      return buffer.slice(startIndex, endIndex);
    },
    getRelevantEntries: (buffer, maxEntries = windowSize) => {
      if (buffer.length <= maxEntries) {
        return [...buffer];
      }

      const scoredEntries = buffer.map((entry, index) => ({
        entry,
        score: calculateEntryScore(entry, index, buffer.length, options),
      }));

      scoredEntries.sort((left, right) => right.score - left.score);

      return scoredEntries
        .slice(0, maxEntries)
        .map((item) => item.entry)
        .sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
    },
    analyzeWindow: (entries) => {
      if (entries.length === 0) {
        return {
          summary: 'Empty window',
          errorCount: 0,
          warningCount: 0,
          uniqueTags: [],
          timeSpan: 0,
          dominantPriority: 'I',
          hasStackTrace: false,
          hasPerformanceIssues: false,
        };
      }

      const errorCount = entries.filter((entry) => entry.priority === 'E' || entry.priority === 'F').length;
      const warningCount = entries.filter((entry) => entry.priority === 'W').length;
      const uniqueTags = [...new Set(entries.map((entry) => entry.tag))];
      const timeSpan = entries[entries.length - 1]!.timestamp.getTime() - entries[0]!.timestamp.getTime();
      const priorityCounts = new Map<Priority, number>();
      entries.forEach((entry) => {
        priorityCounts.set(entry.priority, (priorityCounts.get(entry.priority) || 0) + 1);
      });
      const dominantPriority =
        Array.from(priorityCounts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'I';
      const hasStackTrace = entries.some(
        (entry) => entry.message.includes('at ') && (entry.message.includes('.java:') || entry.message.includes('.kt:'))
      );
      const hasPerformanceIssues = entries.some((entry) => {
        const normalizedMessage = entry.message.toLowerCase();
        return (
          normalizedMessage.includes('gc') ||
          normalizedMessage.includes('memory') ||
          normalizedMessage.includes('anr') ||
          normalizedMessage.includes('timeout') ||
          normalizedMessage.includes('slow')
        );
      });

      const analysis: WindowSummaryAnalysis = {
        errorCount,
        warningCount,
        uniqueTags,
        timeSpan,
        hasStackTrace,
        hasPerformanceIssues,
      };

      return {
        summary: generateWindowSummary(entries, analysis),
        errorCount,
        warningCount,
        uniqueTags,
        timeSpan,
        dominantPriority,
        hasStackTrace,
        hasPerformanceIssues,
      };
    },
    updateWindowSize: (newSize) => {
      windowSize = newSize;
      options = {
        ...options,
        contextSize: Math.floor(newSize * 0.3),
      };
    },
    updateOptions: (nextOptions) => {
      options = { ...options, ...nextOptions };
    },
  };
};
