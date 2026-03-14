import { Command } from 'commander';
import chalk from 'chalk';
import { createRequire } from 'node:module';
import {
  adbConnect,
  adbPair,
  ensureAdbSupportsWifi,
  formatAdbQr,
  generateRandomHex,
  startMdns,
} from '../../adb/wifi.js';
import { getErrorMessage } from '../../errors.js';
import { parseIntegerFlagValue } from '../logCommandSupport.js';

const require = createRequire(import.meta.url);
const qrcode = require('qrcode-terminal');

type WifiOptions = Readonly < {
  qr: boolean;
  name?: string;
  pass?: string;
  timeout: string;
}>;

const performWifiAction = async (opts: WifiOptions): Promise<void> => {
  const name = opts.name || `debug-${generateRandomHex(4)}`;
  const pass = opts.pass || generateRandomHex(8);
  const timeoutMs = parseIntegerFlagValue(opts.timeout, '--timeout', { minimum: 0 });

  console.log(chalk.cyan('━'.repeat(80)));
  console.log(chalk.cyan('📶 ADB Wi‑Fi Discovery'));
  console.log(chalk.cyan(`Name: ${name}`));
  console.log(chalk.cyan(`Pass: ${pass}`));

  if (opts.qr !== false) {
    console.log(
      chalk.gray(
        '\nScan this QR on your Android device: Settings → Developer options → Wireless debugging → Pair device with QR code\n'
      )
    );
    qrcode.generate(formatAdbQr(name, pass), { small: true });
  }

  console.log(chalk.gray('\nSearching mDNS for adb-tls-pairing and adb-tls-connect ...'));

  const attempted = new Set<string>();
  const successes = new Set<string>();

  try {
    const { version } = await ensureAdbSupportsWifi();
    if (version) console.log(chalk.gray(`adb version: ${version}`));
  } catch (error: unknown) {
    console.error(chalk.red(getErrorMessage(error)));
    process.exit(1);
  }

  const mdnsHandle = startMdns((svc) => {
    void (async () => {
      const key = `${svc.type}:${svc.host}:${svc.port}`;
      if (attempted.has(key)) return;
      attempted.add(key);

      if (svc.type === 'pairing') {
        console.log(chalk.white(`\n📡 ${svc.name} — ${svc.host}:${svc.port} (Pairing)`));
        process.stdout.write(chalk.gray('↪ adb pair ... '));
        const { success, message } = await adbPair(svc.host, svc.port, pass);
        if (success) {
          console.log(chalk.green('success'));
          successes.add(key);
        } else {
          console.log(chalk.red('failed'));
          if (message) console.log(chalk.gray(message));
        }
      } else {
        console.log(chalk.white(`\n📡 ${svc.name} — ${svc.host}:${svc.port} (Connect)`));
        process.stdout.write(chalk.gray('↪ adb connect ... '));
        const { success, message } = await adbConnect(svc.host, svc.port);
        if (success) {
          console.log(chalk.green('connected'));
          successes.add(key);
        } else {
          console.log(chalk.red('failed'));
          if (message) console.log(chalk.gray(message));
        }
      }
    })();
  });

  let timer: NodeJS.Timeout | undefined;
  if (timeoutMs > 0) {
    timer = setTimeout(() => {
      console.log(chalk.gray(`\n⏱️  Stopping discovery after ${timeoutMs} ms`));
      mdnsHandle.stop();
      const paired = Array.from(successes).filter((k) => k.startsWith('pairing:')).length;
      const connected = Array.from(successes).filter((k) => k.startsWith('connect:')).length;
      console.log(chalk.cyan(`Done. Paired: ${paired}, Connected: ${connected}`));
      process.exit(0);
    }, timeoutMs);
  }

  process.on('SIGINT', () => {
    if (timer) clearTimeout(timer);
    mdnsHandle.stop();
    console.log('\n' + chalk.gray('Stopped.'));
    process.exit(0);
  });
};

export const wifiCmd = new Command('wifi')
  .description('Discover ADB over Wi‑Fi via mDNS, show QR for pairing, and auto pair/connect')
  .option('--no-qr', 'do not display QR code')
  .option('--name <name>', 'custom ADB Wi‑Fi name (default: debug-XXXX)')
  .option('--pass <pass>', 'custom ADB Wi‑Fi password (default: random)')
  .option('--timeout <ms>', 'stop discovery after this many ms (0 = never)', '90000')
  .action((opts: WifiOptions) => {
    void performWifiAction(opts);
  });
