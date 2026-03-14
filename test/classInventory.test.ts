import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type ClassEntry = Readonly<{
  file: string;
  symbol: string;
}>;

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const srcDir = join(repoRoot, 'src');
const auditPath = join(repoRoot, 'docs', 'class-audit.md');

const normalizePath = (path: string): string => {
  return path.replaceAll('\\', '/');
};

const compareClassEntries = (left: ClassEntry, right: ClassEntry): number => {
  return left.file.localeCompare(right.file) || left.symbol.localeCompare(right.symbol);
};

const collectClassInventory = (directoryPath: string): ClassEntry[] => {
  const entries: ClassEntry[] = [];

  for (const child of readdirSync(directoryPath, { withFileTypes: true })) {
    const childPath = join(directoryPath, child.name);

    if (child.isDirectory()) {
      entries.push(...collectClassInventory(childPath));
      continue;
    }

    if (!child.isFile() || !child.name.endsWith('.ts')) {
      continue;
    }

    const contents = readFileSync(childPath, 'utf8');
    const relativePath = normalizePath(relative(repoRoot, childPath));

    for (const match of contents.matchAll(/^\s*export\s+class\s+([A-Za-z0-9_]+)/gm)) {
      entries.push({
        file: relativePath,
        symbol: match[1]!,
      });
    }
  }

  return entries.sort(compareClassEntries);
};

const readAuditedKeepList = (): ClassEntry[] => {
  const contents = readFileSync(auditPath, 'utf8');

  return Array.from(contents.matchAll(/^\| `([^`]+)` \| `([^`]+)` \| `keep` \|/gm), (match) => ({
    file: match[1]!,
    symbol: match[2]!,
  })).sort(compareClassEntries);
};

describe('src class inventory', () => {
  it('stays confined to the audited keep-list', () => {
    expect(collectClassInventory(srcDir)).toEqual(readAuditedKeepList());
  });
});
