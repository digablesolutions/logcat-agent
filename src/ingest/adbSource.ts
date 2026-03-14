import { EventEmitter } from 'eventemitter3';
import type { ChildProcess } from 'node:child_process';
import { spawnLogcatBinary, type LogcatOptions } from '../adb/adbClient.js';
import { attachLogcatParser } from '../adb/logcatStream.js';
import type { ILogSource, LogSourceEvents } from './source.js';

export const createAdbLogcatSource = (options: LogcatOptions): ILogSource => {
  const emitter = new EventEmitter<LogSourceEvents>();
  let proc: ChildProcess | null = null;

  const connect = async (): Promise<void> => {
    proc = spawnLogcatBinary(options);

    proc.stderr?.on('data', (d: Buffer) => {
      emitter.emit('error', new Error(`ADB Error: ${d.toString().trim()}`));
    });

    attachLogcatParser(
      proc,
      (entry) => {
        emitter.emit('entry', entry);
      },
      (err) => {
        emitter.emit('error', err);
      }
    );

    proc.on('close', () => {
      emitter.emit('close');
    });
  };

  const disconnect = async (): Promise<void> => {
    if (proc) {
      proc.kill();
      proc = null;
    }
  };

  return Object.assign(emitter, {
    deviceId: options.serial,
    connect,
    disconnect,
  }) as ILogSource;
};


