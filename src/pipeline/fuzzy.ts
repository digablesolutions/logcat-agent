// Lightweight SimHash for near-duplicate stack/message grouping
// No external deps; 64-bit FNV-1a based bit contributions.

/** Normalize a stack/message to reduce noise like numbers and addresses */
export const normalizeMessage = (msg: string): string => {
  const s = msg.toLowerCase()
    .replace(/0x[0-9a-f]+/g, '')
    .replace(/\b\d+\b/g, '#')
    .replace(/(\.\w+|\w+\.java|\w+\.kt|\w+\.cpp|\w+\.mm|\w+\.m):#/g, '$1:#')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
};

/** Tokenize, preserving class/method dotted tokens */
export const tokenize = (s: string): ReadonlyArray<string> => {
  if (!s) return [];
  return s.split(/[^a-z0-9._#$]+/g).filter(Boolean);
};

/** 64-bit FNV-1a hash for a string (BigInt) */
export const fnv1a64 = (str: string): bigint => {
  let hash = 0xcbf29ce484222325n; // offset basis
  const prime = 0x100000001b3n;
  for (let i = 0; i < str.length; i++) {
    hash ^= BigInt(str.charCodeAt(i) & 0xff);
    hash = (hash * prime) & 0xffffffffffffffffn; // mod 2^64
  }
  return hash;
};

/** Compute 64-bit SimHash from tokens; returns BigInt */
export const simhash64FromTokens = (tokens: ReadonlyArray<string>): bigint => {
  const V = new Array<number>(64).fill(0);
  // simple term weighting by frequency (log-scaled)
  const freq = new Map<string, number>();
  tokens.forEach(t => freq.set(t, (freq.get(t) || 0) + 1));

  freq.forEach((c, t) => {
    const w = 1 + Math.log2(1 + c);
    const h = fnv1a64(t);
    for (let bit = 0; bit < 64; bit++) {
      const isOne = (h & (1n << BigInt(bit))) !== 0n;
      V[bit]! += isOne ? w : -w;
    }
  });

  let out = 0n;
  for (let bit = 0; bit < 64; bit++) {
    if (V[bit]! > 0) out |= 1n << BigInt(bit);
  }
  return out;
};

/** Compute SimHash hex (16+ hex chars) for a message */
export const simhash64HexForMessage = (msg: string): string => {
  const norm = normalizeMessage(msg);
  const toks = tokenize(norm);
  const h = simhash64FromTokens(toks);
  const hex = h.toString(16);
  return hex.length < 16 ? hex.padStart(16, '0') : hex;
};

/** Hamming distance between two 64-bit hex simhash strings */
export const hammingDistanceHex = (a: string, b: string): number => {
  const aa = BigInt('0x' + a);
  const bb = BigInt('0x' + b);
  const x = aa ^ bb;
  let n = 0;
  let y = x;
  while (y) {
    y &= y - 1n;
    n++;
  }
  return n;
};