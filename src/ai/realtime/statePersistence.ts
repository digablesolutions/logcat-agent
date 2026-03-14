import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

export interface StatePersistence {
  save<T>(key: string, state: T): Promise<void>;
  load<T>(key: string): Promise<T | null>;
}

export class FileStatePersistence implements StatePersistence {
  constructor(private baseDir: string) {}

  async save<T>(key: string, state: T): Promise<void> {
    const path = join(this.baseDir, `${key}.json`);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(state, null, 2));
  }

  async load<T>(key: string): Promise<T | null> {
    const path = join(this.baseDir, `${key}.json`);
    try {
      const content = await readFile(path, 'utf-8');
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }
}
