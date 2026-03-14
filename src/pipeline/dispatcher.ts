import stringHash from 'string-hash';
import type { ILogEntry, IPattern, IPatternMatch } from './types.js';
import { simhash64HexForMessage } from './fuzzy.js';

export type SignatureMode = 'hash' | 'fuzzy' | 'both';

/**
 * Computes a simple signature for a message by hashing the top few
 * lines of the stack trace.
 */
const computeSignature = (msg: string): string => {
  const top = msg.split('\n').slice(0, 8).join('\n');
  return String(stringHash(top));
};

const computeFuzzySignature = (msg: string): string => simhash64HexForMessage(msg);

/**
 * Attempts to match each provided pattern against the given log entry.
 * Returns an array of IPatternMatch objects for all matches.
 */
export const detectPatterns = (
  entry: ILogEntry,
  patterns: ReadonlyArray<IPattern>,
  signatureMode: SignatureMode = 'hash'
): ReadonlyArray<IPatternMatch> => {
  return patterns.reduce<IPatternMatch[]>((matches, p) => {
    const m = entry.message.match(p.regex);
    if (m) {
      const rec: IPatternMatch = {
        pattern: p,
        entry,
        match: m,
        ...( (signatureMode === 'hash' || signatureMode === 'both') && { signature: computeSignature(entry.message) } ),
        ...( (signatureMode === 'fuzzy' || signatureMode === 'both') && { fuzzySignature: computeFuzzySignature(entry.message) } ),
      };
      matches.push(rec);
    }
    return matches;
  }, []);
};