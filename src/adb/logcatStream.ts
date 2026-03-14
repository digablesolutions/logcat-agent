import Logcat from '@devicefarmer/adbkit-logcat';
import type { ChildProcess } from 'node:child_process';
import type { Duplex } from 'node:stream';
import type { ILogEntry, Priority } from '../pipeline/types.js';

type RawLogcatEntry = Readonly<{
  date?: Date;
  priority?: number;
  tag?: string;
  pid?: number;
  message?: string;
}> & Record<string, unknown>;

// Mapping from numeric priority to our string representation
const prioMap: Record<number, Priority> = {
  2: 'V',
  3: 'D',
  4: 'I',
  5: 'W',
  6: 'E',
  7: 'F',
};

/**
 * Attaches the adbkit-logcat parser to the given logcat child process.  The
 * supplied callbacks are invoked for each parsed entry and on errors.  The
 * parser will automatically parse binary logcat output.
 */
export function attachLogcatParser(
  proc: ChildProcess,
  onEntry: (e: ILogEntry) => void,
  onError: (err: unknown) => void
): void {
  const stdout = proc.stdout;
  if (!stdout) {
    onError(new Error('adb logcat process did not provide stdout'));
    return;
  }

  const reader = Logcat.readStream(stdout as Duplex, { format: 'binary' });
  reader.on('entry', (e: RawLogcatEntry) => {
    const entry: ILogEntry = {
      timestamp: new Date(e.date?.getTime?.() || Date.now()),
      priority: prioMap[e.priority ?? -1] || 'D',
      tag: e.tag || 'unknown',
      pid: e.pid || 0,
      message: e.message || '',
      raw: e,
    };
    onEntry(entry);
  });
  reader.on('error', onError);
  proc.on('error', onError);
}
