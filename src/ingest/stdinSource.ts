import { EventEmitter } from 'eventemitter3';
import { createInterface } from 'node:readline';
import type { ILogSource, LogSourceEvents } from './source.js';
import type { ILogEntry } from '../pipeline/types.js';

export const createStdinSource = (): ILogSource => {
  const emitter = new EventEmitter<LogSourceEvents>();

  const connect = async (): Promise<void> => {
    const rl = createInterface({
      input: process.stdin,
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      if (!line.trim()) return;

      const entry: ILogEntry = {
        timestamp: new Date(),
        priority: 'I',
        tag: 'Stdin',
        pid: 0,
        message: line,
      };
      emitter.emit('entry', entry);
    });

    rl.on('close', () => {
      emitter.emit('close');
    });

    rl.on('error', (err) => {
      emitter.emit('error', err);
    });
  };

  const disconnect = async (): Promise<void> => {
    process.stdin.pause();
  };

  return Object.assign(emitter, {
    deviceId: 'stdin',
    connect,
    disconnect,
  }) as ILogSource;
};
