import { describe, expect, it } from 'vitest';
import {
  parseFloatFlagValue,
  parseIntegerFlagValue,
  parseOptionalFloatFlagValue,
  parseOptionalIntegerFlagValue,
} from '../src/cli/logCommandSupport.js';

describe('logCommandSupport numeric parsing', () => {
  it('parses integers with bounds', () => {
    expect(parseIntegerFlagValue('0', '--timeout', { minimum: 0 })).toBe(0);
    expect(parseIntegerFlagValue('15', '--max-rate', { minimum: 1 })).toBe(15);
  });

  it('parses optional numbers when present', () => {
    expect(parseOptionalIntegerFlagValue(undefined, '--window-size', { minimum: 1 })).toBeUndefined();
    expect(parseOptionalFloatFlagValue('0.5', '--anomaly-threshold', { minimum: 0, maximum: 1 })).toBe(0.5);
  });

  it('rejects invalid numeric values', () => {
    expect(() => parseIntegerFlagValue('abc', '--timeout')).toThrow('Invalid --timeout value: abc. Expected a numeric value.');
    expect(() => parseIntegerFlagValue('1.5', '--window-size')).toThrow('Invalid --window-size value: 1.5. Expected an integer.');
    expect(() => parseFloatFlagValue('2', '--anomaly-threshold', { maximum: 1 })).toThrow('Invalid --anomaly-threshold value: 2. Expected a value <= 1.');
  });
});
