import type { ILogEntry } from '../../pipeline/types.js';

export interface LogBuffer {
  add(entry: ILogEntry): Promise<void>;
  getRecent(count: number): Promise<ILogEntry[]>;
  getWindow(start: Date, end: Date): Promise<ILogEntry[]>;
  clear(): Promise<void>;
  close(): Promise<void>;
  size(): Promise<number>;
}
