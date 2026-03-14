import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';

/**
 * Represents a device returned by `adb devices -l`.
 */
export interface Device {
  serial: string;
  model?: string;
  status: 'device' | 'offline' | 'unauthorized' | string;
}

const isDeviceStatus = (value: string | undefined): value is Device['status'] =>
  typeof value === 'string' && value.length > 0;

/**
 * Lists currently connected devices.  Parses the output of `adb devices -l`.
 */
export async function listDevices(): Promise<Device[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn('adb', ['devices', '-l'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', d => (stdout += d.toString()));
    proc.stderr?.on('data', d => (stderr += d.toString()));
    proc.on('close', code => {
      if (code !== 0) {
        return reject(new Error(stderr || `adb exited with code ${code}`));
      }
      const lines = stdout.split(/\r?\n/).slice(1).filter(Boolean);
      const devices: Device[] = [];
      for (const raw of lines) {
        const line = raw.trim();
        if (!line || line.startsWith('*')) continue;
        const parts = line.split(/\s+/);
        const serial = parts[0];
        const status = parts[1];
        if (!serial) continue; // skip malformed line
        const rest = parts.slice(2);
        const modelKV = rest.find(x => x.startsWith('model:'));
        const model = modelKV ? modelKV.split(':')[1] : undefined;
        const device: Device = { serial, status: isDeviceStatus(status) ? status : 'unknown' };
        if (model) device.model = model;
        devices.push(device);
      }
      resolve(devices);
    });
  });
}

/**
 * Options used when spawning an `adb logcat` process.
 */
export interface LogcatOptions {
  serial?: string | undefined;
  buffers?: string[] | undefined;
  filterExpr?: string[] | undefined;
}

/**
 * Spawns an adb process running `logcat -B` (binary output) with the given options.
 * The caller is responsible for handling stdout and stderr.  On Windows, you
 * should ensure that `adb.exe` is in your PATH or provide an absolute path.
 */
export function spawnLogcatBinary(opts: LogcatOptions): ChildProcess {
  const args: string[] = [];
  if (opts.serial) {
    args.push('-s', opts.serial);
  }
  // Start logcat in binary mode
  args.push('logcat', '-B');
  if (opts.buffers && opts.buffers.length) {
    for (const b of opts.buffers) {
      args.push('-b', b);
    }
  }
  if (opts.filterExpr && opts.filterExpr.length) {
    args.push(...opts.filterExpr);
  }
  return spawn('adb', args, { stdio: ['ignore', 'pipe', 'pipe'] });
}
