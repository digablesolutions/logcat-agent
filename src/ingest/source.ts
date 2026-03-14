import type { EventEmitter } from 'eventemitter3';
import type { ILogEntry } from '../pipeline/types.js';

export interface LogSourceEvents {
  entry: [ILogEntry];
  error: [unknown];
  close: [];
}

export interface ILogSource extends EventEmitter<LogSourceEvents> {
  readonly deviceId?: string;
  readonly connect: () => Promise<void>;
  readonly disconnect: () => Promise<void>;
}
