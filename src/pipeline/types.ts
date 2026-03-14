// Core types used across the logcat analysis pipeline.

export type Priority = 'V' | 'D' | 'I' | 'W' | 'E' | 'F' | 'S';

/**
 * Represents a single logcat entry.  Parsed entries contain metadata
 * such as timestamp, priority, tag and process ID in addition to the
 * message text.
 */
export interface ILogEntry {
  readonly timestamp: Date;
  readonly priority: Priority;
  readonly tag: string;
  readonly pid: number;
  readonly tid?: number | undefined;
  readonly message: string;
  readonly raw?: unknown | undefined;
}

/**
 * Definition for a pattern used to detect interesting logcat entries.
 * Each pattern provides a name, a regular expression to match against
 * the message, and a severity for UI colouring or ordering.
 */
export interface IPattern {
  readonly name: string;
  readonly regex: RegExp;
  readonly severity: 'error' | 'warning' | 'info';
  readonly description?: string | undefined;
}

/**
 * Result of pattern matching against a log entry.  The signature field
 * can be used to identify unique occurrences of stack traces.
 */
export interface IPatternMatch {
  readonly pattern: IPattern;
  readonly entry: ILogEntry;
  readonly match: RegExpMatchArray;
  readonly signature?: string | undefined;
  /** SimHash-based fuzzy signature for near-duplicates (hex) */
  readonly fuzzySignature?: string | undefined;
}