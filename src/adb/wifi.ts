import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { AdbError, getErrorMessage } from '../errors.js';

const require = createRequire(import.meta.url);
// multicast-dns is CJS
const mdnsFactory = require('multicast-dns');

type Mdns = ReturnType<typeof mdnsFactory>;
type MdnsRecordType = 'PTR' | 'SRV' | 'A' | 'AAAA' | string;

interface MdnsRecord {
  type: MdnsRecordType;
  name: string;
  data?: unknown;
}

interface MdnsSrvData {
  target: string;
  port: number;
}

const isRecordObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isMdnsRecord = (value: unknown): value is MdnsRecord =>
  isRecordObject(value) && typeof value['type'] === 'string' && typeof value['name'] === 'string';

const isMdnsSrvData = (value: unknown): value is MdnsSrvData =>
  isRecordObject(value) && typeof value['target'] === 'string' && typeof value['port'] === 'number';

const getMdnsRecords = (value: unknown): MdnsRecord[] =>
  Array.isArray(value) ? value.filter(isMdnsRecord) : [];

const normalizeMdnsName = (value: string): string => value.replace(/\.$/, '');

export interface DiscoveredService {
  type: 'pairing' | 'connect';
  name: string;
  host: string;
  port: number;
}

export function generateRandomHex(lenBytes: number): string {
  return randomBytes(lenBytes).toString('hex');
}

export function formatAdbQr(name: string, pass: string): string {
  return `WIFI:T:ADB;S:${name};P:${pass};;`;
}

async function runAdb(
  args: string[],
  { captureStdout = false }: { captureStdout?: boolean } = {}
): Promise<{ code: number | null; stdout: string; stderr: string; error?: Error }> {
  return await new Promise<{ code: number | null; stdout: string; stderr: string; error?: Error }>(
    resolve => {
      try {
        const proc = spawn('adb', args, {
          stdio: ['ignore', captureStdout ? 'pipe' : 'pipe', 'pipe'],
        });
        let out = '';
        let err = '';
        proc.stdout?.on('data', d => (out += d.toString()));
        proc.stderr?.on('data', d => (err += d.toString()));
        proc.on('error', e => resolve({ code: 127, stdout: out, stderr: err, error: e }));
        proc.on('close', code => resolve({ code, stdout: out, stderr: err }));
      } catch (error: unknown) {
        resolve({
          code: 127,
          stdout: '',
          stderr: getErrorMessage(error),
          error: error instanceof Error ? error : new Error(getErrorMessage(error)),
        });
      }
    }
  );
}

export async function ensureAdbSupportsWifi(): Promise<{ version: string | undefined }> {
  const ver = await runAdb(['version'], { captureStdout: true });
  if (ver.error || ver.code === 127) {
    throw new AdbError(
      'adb not found in PATH. Please install Android platform-tools and ensure adb is available.'
    );
  }
  const versionLine = ver.stdout
    .split(/\r?\n/)
    .find(l => l.toLowerCase().includes('android debug bridge version'));
  const version = versionLine?.split(/version/i)[1]?.trim();
  const help = await runAdb(['--help'], { captureStdout: true });
  if (!help.stdout.toLowerCase().includes('pair')) {
    // As a fallback, try `adb pair --help`
    const pairHelp = await runAdb(['pair', '--help'], { captureStdout: true });
    if ((pairHelp.code ?? 1) !== 0 && !pairHelp.stdout.toLowerCase().includes('pair')) {
      throw new AdbError(
        'Your adb build does not support wireless pairing (missing "adb pair"). Update platform-tools.'
      );
    }
  }
  return { version: version as string | undefined };
}

export async function adbPair(
  host: string,
  port: number,
  pass: string
): Promise<{ success: boolean; message: string }> {
  const { code, stdout, stderr } = await runAdb(['pair', `${host}:${port}`, pass], {
    captureStdout: true,
  });
  const out = (stdout + '\n' + stderr).toLowerCase();
  const success = (code === 0 && out.includes('paired')) || out.includes('success');
  const message = stdout.trim() || stderr.trim();
  return { success, message };
}

export async function adbConnect(
  host: string,
  port: number
): Promise<{ success: boolean; message: string }> {
  const { code, stdout, stderr } = await runAdb(['connect', `${host}:${port}`], {
    captureStdout: true,
  });
  const out = (stdout + '\n' + stderr).toLowerCase();
  const success = out.includes('connected to') || out.includes('already connected');
  const message = stdout.trim() || stderr.trim() || (code === 0 ? 'connected' : 'failed');
  return { success, message };
}

export function startMdns(onService: (s: DiscoveredService) => void): { stop: () => void } {
  const mdns: Mdns = mdnsFactory();
  const PAIR = '_adb-tls-pairing._tcp.local';
  const CONN = '_adb-tls-connect._tcp.local';
  const wanted = new Set([PAIR, CONN]);

  function sendQueries() {
    for (const name of wanted) mdns.query([{ name, type: 'PTR' }]);
  }

  mdns.on('response', (res: unknown) => {
    const response = isRecordObject(res) ? res : {};
    const records = [
      ...getMdnsRecords(response['answers']),
      ...getMdnsRecords(response['additionals']),
    ];
    const ptrs = records.filter(
      (record): record is MdnsRecord & { data: string } =>
        record.type === 'PTR' && wanted.has(record.name) && typeof record.data === 'string'
    );
    if (!ptrs.length) return;

    for (const ptr of ptrs) {
      const type: DiscoveredService['type'] = ptr.name === PAIR ? 'pairing' : 'connect';
      const instance = ptr.data;
      const srv = records.find(
        (record): record is MdnsRecord & { data: MdnsSrvData } =>
          record.type === 'SRV' && record.name === instance && isMdnsSrvData(record.data)
      );
      if (!srv) continue;

      const host = normalizeMdnsName(srv.data.target);
      const port = srv.data.port;
      const addressRecord = records.find(
        (record): record is MdnsRecord & { data: string } =>
          (record.type === 'A' || record.type === 'AAAA') &&
          typeof record.data === 'string' &&
          normalizeMdnsName(record.name) === host
      );

      const hostIp = addressRecord?.data ?? host;
      const name = String(instance.split('._adb-')[0] || instance);
      onService({ type, name, host: hostIp, port });
    }
  });

  sendQueries();
  const interval = setInterval(sendQueries, 2000);
  mdns.on('error', () => {
    /* ignore */
  });
  return {
    stop: () => {
      try {
        clearInterval(interval);
      } catch {}
      try {
        mdns.destroy();
      } catch {}
    },
  };
}

export async function wifiAutoConnect(opts: {
  timeoutMs?: number;
  pass?: string;
  onEvent?: (e: {
    kind: 'pair-attempt' | 'pair-result' | 'connect-attempt' | 'connect-result';
    host: string;
    port: number;
    ok?: boolean;
    message?: string;
  }) => void;
}): Promise<{ connected: string | null }> {
  const timeoutMs = Math.max(1, opts.timeoutMs ?? 60000);
  const attempted = new Set<string>();
  let resolved = false;
  let resolveFn!: (v: { connected: string | null }) => void;
  const p = new Promise<{ connected: string | null }>(r => (resolveFn = r));

  const stopAndResolve = (val: { connected: string | null }) => {
    if (resolved) return;
    resolved = true;
    try {
      handle.stop();
    } catch {}
    resolveFn(val);
  };

  const handle = startMdns(svc => {
    void (async () => {
      const key = `${svc.type}:${svc.host}:${svc.port}`;
      if (attempted.has(key)) return;
      attempted.add(key);
      if (svc.type === 'pairing') {
        opts.onEvent?.({ kind: 'pair-attempt', host: svc.host, port: svc.port });
        const { success, message } = await adbPair(svc.host, svc.port, opts.pass || '');
        opts.onEvent?.({
          kind: 'pair-result',
          host: svc.host,
          port: svc.port,
          ok: success,
          message,
        });
      } else {
        opts.onEvent?.({ kind: 'connect-attempt', host: svc.host, port: svc.port });
        const { success, message } = await adbConnect(svc.host, svc.port);
        opts.onEvent?.({
          kind: 'connect-result',
          host: svc.host,
          port: svc.port,
          ok: success,
          message,
        });
        if (success) {
          stopAndResolve({ connected: `${svc.host}:${svc.port}` });
        }
      }
    })();
  });

  const timer = setTimeout(() => stopAndResolve({ connected: null }), timeoutMs);
  const out = await p;
  clearTimeout(timer);
  return out;
}
