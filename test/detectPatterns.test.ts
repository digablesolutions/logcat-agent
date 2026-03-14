import { describe, it, expect } from 'vitest';
import { detectPatterns } from '../src/pipeline/dispatcher.js';
import { hammingDistanceHex, simhash64HexForMessage } from '../src/pipeline/fuzzy.js';
import { defaultPatterns } from '../src/pipeline/patterns.js';

describe('detectPatterns', () => {
  it('detects a NullPointerException', () => {
    const entry = {
      timestamp: new Date(),
      priority: 'E' as const,
      tag: 'MyApp',
      pid: 123,
      message: 'java.lang.NullPointerException: Attempt to read from null',
    };
    const matches = detectPatterns(entry, defaultPatterns);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]?.pattern.name).toBe('NullPointerException');
  });

  it('computes similar fuzzy signatures for near-duplicate messages', () => {
    const a =
      'java.lang.NullPointerException: Attempt to read from null at com.example.Foo.bar(Foo.java:123)';
    const b =
      'java.lang.NullPointerException: Attempt to read from null at com.example.Foo.bar(Foo.java:456)';
    const ha = simhash64HexForMessage(a);
    const hb = simhash64HexForMessage(b);
    const dist = hammingDistanceHex(ha, hb);
    expect(dist).toBeLessThan(8);
  });

  it('dispatcher emits fuzzySignature when enabled', () => {
    const entry = {
      timestamp: new Date(),
      priority: 'E' as const,
      tag: 'MyApp',
      pid: 123,
      message:
        'java.lang.NullPointerException: Attempt to read from null at com.example.Foo.bar(Foo.java:99)',
    };
    const matches = detectPatterns(entry, defaultPatterns, 'both');
    expect(matches.length).toBeGreaterThan(0);
    // at least one match should carry fuzzySignature
    expect(matches.some(m => !!m.fuzzySignature)).toBe(true);
  });
});
