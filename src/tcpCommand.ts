import { Command } from 'commander';
import chalk from 'chalk';
import net from 'node:net';
import { getErrorMessage } from './errors.js';
import {
  toAscii,
  toHex,
  parseSicpFrame,
  classifySicpReply,
  buildSicp,
  buildSicpGetSerial,
  buildSicpRestart,
  parseSerialFromReport,
} from './protocols/sicp.js';

export type TcpOptions = Readonly<{
  port: string;
  remoteHost: string;
  sendHex?: string;
  sendSicp?: string;
  getSerial?: string;
  restart?: string;
  target: string;
  timeout: string;
  retry500ms?: boolean;
}>;

export interface TcpCommandConfig {
  description?: string;
}

const parseHexBytes = (hex: string): Uint8Array => {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  if (clean.length % 2 !== 0) throw new Error('Hex string must have even length');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    out[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return out;
};

const toNum = (value: string): number =>
  value.toLowerCase().startsWith('0x') ? parseInt(value, 16) : parseInt(value, 10);

const wireConnection = (conn: net.Socket, opts: TcpOptions, timeoutMs: number, oneShot: boolean): void => {
  let done = false;
  let retried = false;
  const sentPayloads: Buffer[] = [];

  const send = (payload: Uint8Array, label: string): void => {
    console.log(chalk.gray(label));
    const buffer = Buffer.from(payload);
    conn.write(buffer);
    sentPayloads.push(buffer);
  };

  if (opts.sendHex) {
    const payload = parseHexBytes(opts.sendHex);
    send(payload, `> ${toHex(payload)}  | ${toAscii(payload)}`);
  }

  if (opts.sendSicp) {
    const parts = opts.sendSicp.split(',').map(part => part.trim());
    if (parts.length < 2) throw new Error('send-sicp needs at least control,group');
    const control = toNum(parts[0]!);
    const group = toNum(parts[1]!);
    const data = parts.slice(2).filter(Boolean).map(toNum);
    const frame = buildSicp(control, group, data);
    send(frame, `> SICP ${toHex(frame)}`);
  }

  if (opts.getSerial) {
    const frame = buildSicpGetSerial(toNum(opts.getSerial));
    send(frame, `> SICP GET-SERIAL ${toHex(frame)}`);
  }

  if (opts.restart) {
    const target = toNum(opts.target) & 0xff;
    const frame = buildSicpRestart(toNum(opts.restart), target);
    send(frame, `> SICP RESTART target=${target} ${toHex(frame)}`);
  }

  let retryTimer: NodeJS.Timeout | undefined;
  let responseTimer: NodeJS.Timeout | undefined;

  if (oneShot) {
    if (opts.retry500ms && sentPayloads.length === 1) {
      retryTimer = setTimeout(() => {
        if (!done && !retried) {
          retried = true;
          console.log(chalk.yellow('⟲ No response in 500 ms, retrying once...'));
          try {
            conn.write(sentPayloads[0]!);
          } catch {}
        }
      }, 500);
    } else if (opts.retry500ms && sentPayloads.length !== 1) {
      console.log(chalk.gray('Skipping retry: multiple requests were sent.'));
    }

    responseTimer = setTimeout(() => {
      if (!done) {
        console.error(chalk.red(`❌ Timeout waiting for response after ${timeoutMs} ms`));
        try {
          conn.end();
        } catch {}
      }
    }, timeoutMs);

    console.log(chalk.gray(`⏱️ Waiting up to ${timeoutMs} ms for response...`));
  }

  conn.on('data', (buf: Buffer) => {
    const bytes = new Uint8Array(buf);
    const hex = toHex(bytes);
    const ascii = toAscii(bytes);
    const parsed = parseSicpFrame(bytes);
    console.log(chalk.white(`\n< ${hex}\n  ${ascii}`));

    if (parsed) {
      const kind = classifySicpReply(parsed);
      console.log(
        chalk.yellow(
          `  SICP: size=${parsed.size} control=${parsed.control} group=${parsed.group} data=[${parsed.data.join(',')}] checksum=${parsed.checksum} valid=${parsed.valid} kind=${kind}`
        )
      );
      const serial = parseSerialFromReport(parsed);
      if (serial) {
        console.log(chalk.green(`  Serial: ${serial}`));
      }
    }

    if (oneShot && !done) {
      done = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (responseTimer) clearTimeout(responseTimer);
      setTimeout(() => {
        try {
          conn.end();
        } catch {}
      }, 50);
    }
  });

  conn.on('close', () => console.log(chalk.gray('Connection closed.')));
};

export const performTcpAction = async (opts: TcpOptions): Promise<void> => {
  const port = parseInt(opts.port, 10) || 5000;
  const remoteHost = opts.remoteHost.trim();
  const oneShot = Boolean(opts.sendHex || opts.sendSicp || opts.getSerial || opts.restart);
  const timeoutMs = Math.max(1, parseInt(opts.timeout, 10) || 2000);

  if (!remoteHost) {
    console.error('You must provide --remote-host <ip-or-hostname>.');
    process.exit(1);
  }

  if (!oneShot) {
    console.error(
      chalk.red(
        'Sniffing mode is not supported. Provide one of --send-hex, --send-sicp, or --get-serial.'
      )
    );
    process.exit(1);
  }

  console.log(chalk.cyan(`Opening TCP from host -> ${remoteHost}:${port} ...`));

  const conn = net.createConnection({ host: remoteHost, port }, () => {
    console.log(chalk.green('TCP connection open.'));
    try {
      wireConnection(conn, opts, timeoutMs, oneShot);
    } catch (error: unknown) {
      console.error(chalk.red(`TCP session setup failed: ${getErrorMessage(error)}`));
      conn.end();
      process.exit(1);
    }
  });

  conn.on('error', (error: unknown) => {
    console.error(chalk.red(`TCP error: ${getErrorMessage(error)}`));
  });

  conn.on('close', () => {
    if (process.stdin.isTTY) {
      try {
        process.stdin.pause();
      } catch {}
    }
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log(`\n${chalk.gray('Closing...')}`);
    try {
      conn.end();
    } catch {}
    setTimeout(() => process.exit(0), 500);
  });
};

export const createTcpCommand = (config: TcpCommandConfig = {}): Command => {
  return new Command('tcp')
    .description(
      config.description ??
        'Connect from this host (PC) to remote host:port (default port 5000). Useful for Philips SICP over TCP port 5000.'
    )
    .option('-p, --port <port>', 'TCP port to connect to', '5000')
    .option('--remote-host <host>', 'remote host/IP to connect to (e.g. display LAN IP)')
    .option(
      '--send-hex <hex>',
      'send raw hex bytes once connected (e.g. "050300191F" for get power state)'
    )
    .option(
      '--send-sicp <control,group,data...>',
      'send a SICP frame: control,group,comma-separated data bytes (decimal or hex like 0x19)'
    )
    .option(
      '--get-serial <control>',
      'send SICP Get-Serial (data[0]=0x15) with the given Monitor ID (decimal or 0xNN)'
    )
    .option(
      '--restart <control>',
      'send SICP Monitor Restart with given Monitor ID (decimal or 0xNN); see --target'
    )
    .option('--target <code>', 'restart target: 0x00=Android, 0x01=Scalar (default 0x00)', '0x00')
    .option('--timeout <ms>', 'response timeout in milliseconds (one-shot only)', '2000')
    .option('--retry-500ms', 'retry once at 500 ms if no response yet (one-shot only)')
    .action((opts: TcpOptions) => {
      void performTcpAction(opts).catch((error: unknown) => {
        console.error(chalk.red(`TCP command failed: ${getErrorMessage(error)}`));
        process.exit(1);
      });
    });
};
