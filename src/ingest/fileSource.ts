import { EventEmitter } from 'eventemitter3';
import { createReadStream, statSync, watch, type FSWatcher } from 'node:fs';
import { createInterface } from 'node:readline';
import type { ILogSource, LogSourceEvents } from './source.js';
import type { ILogEntry } from '../pipeline/types.js';

export const createFileSource = (filePath: string, follow = true): ILogSource => {
  const emitter = new EventEmitter<LogSourceEvents>();
  let currentSize = 0;
  let watcher: FSWatcher | null = null;
  let isWatching = false;

  const readNewContent = async (): Promise<void> => {
    try {
      const stats = statSync(filePath);
      if (stats.size < currentSize) {
        currentSize = 0;
      }

      if (stats.size === currentSize) return;

      const stream = createReadStream(filePath, {
        start: currentSize,
        end: stats.size - 1,
        encoding: 'utf8',
      });

      currentSize = stats.size;

      const rl = createInterface({
        input: stream,
        crlfDelay: Infinity,
      });

      for await (const line of rl) {
        if (!line.trim()) continue;

        const entry: ILogEntry = {
          timestamp: new Date(),
          priority: 'I',
          tag: 'File',
          pid: 0,
          message: line,
        };

        emitter.emit('entry', entry);
      }
    } catch (err) {
      emitter.emit('error', err instanceof Error ? err : new Error(String(err)));
    }
  };

  const connect = async (): Promise<void> => {
    try {
      statSync(filePath);
      await readNewContent();

      if (follow) {
        isWatching = true;
        watcher = watch(filePath, (eventType) => {
          if (eventType === 'change' && isWatching) {
            void readNewContent();
          }
        });
      } else {
        emitter.emit('close');
      }
    } catch (err) {
      emitter.emit('error', err instanceof Error ? err : new Error(String(err)));
    }
  };

  const disconnect = async (): Promise<void> => {
    isWatching = false;
    if (watcher) {
      watcher.close();
      watcher = null;
    }
  };

  return Object.assign(emitter, {
    deviceId: `file:${filePath}`,
    connect,
    disconnect,
  }) as ILogSource;
};


