import { Command } from 'commander';
import { createReadStream, existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { getErrorMessage } from '../../errors.js';

type SummarizeOptions = Readonly <{
  dir: string;
  day?: string;
  device?: string;
  out: string;
  httpEndpoint?: string;
}>;

interface JsonlRec {
  readonly ts: string;
  readonly device: string;
  readonly priority: 'V' | 'D' | 'I' | 'W' | 'E' | 'F';
  readonly tag: string;
  readonly pid: number;
  readonly message: string;
  readonly matches?: ReadonlyArray <{
    readonly name: string;
    readonly severity: string;
    readonly signature?: string;
  }>;
}

interface DeviceStats {
  count: number;
  priorities: Record <string, number>;
  patterns: Record <string, number>;
  signatures: Record <string, number>;
}

const performSummarize = async (opts: SummarizeOptions): Promise <void> => {
  const { dir: baseDir, day: optsDay, device, out, httpEndpoint } = opts;
  const day = optsDay || new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
  const dayDir = join(baseDir, day);

  if (!existsSync(dayDir)) {
    console.error(`No data for day ${day} at ${dayDir}`);
    process.exit(1);
  }

  const allFiles = readdirSync(dayDir);
  const files = allFiles.filter((f) => f.endsWith('.jsonl'));
  const targets = device ? files.filter((f) => f.startsWith(device)) : files;

  if (targets.length === 0) {
    console.error('No JSONL files found to summarize.');
    process.exit(1);
  }

  const totalsByDevice: Record <string, DeviceStats> = {};

  const processFile = async (filePath: string) => {
    const fileName = filePath.split(/[\\/]/).pop()!;
    const devName = fileName.replace(/\.jsonl$/, '');
    const stats = (totalsByDevice[devName] ??= {
      count: 0,
      priorities: {},
      patterns: {},
      signatures: {},
    });

    const rl = createInterface({
      input: createReadStream(filePath),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const rec: JsonlRec = JSON.parse(line);
        stats.count++;
        const p = rec.priority || 'I';
        stats.priorities[p] = (stats.priorities[p] ?? 0) + 1;
        (rec.matches || []).forEach((m) => {
          stats.patterns[m.name] = (stats.patterns[m.name] ?? 0) + 1;
          if (m.signature) stats.signatures[m.signature] = (stats.signatures[m.signature] ?? 0) + 1;
        });
      } catch {
        /* skip malformed lines */
      }
    }
  };

  for (const f of targets) {
    await processFile(join(dayDir, f));
  }

  const summary = { day, devices: totalsByDevice };

  // Write files
  mkdirSync(out, { recursive: true });
  const base = join(out, `summary-${day}`);

  writeFileSync(`${base}.json`, JSON.stringify(summary, null, 2));

  const mdContent = [
    `# Daily Log Summary - ${day}`,
    ...Object.entries(totalsByDevice).flatMap(([dev, stats]) => [
      `\n## Device ${dev}`,
      `- Total: ${stats.count}`,
      `- Priorities: ${Object.entries(stats.priorities).map(([k, v]) => `${k}:${v}`).join(', ') || '-'}`,
      ...(Object.keys(stats.patterns).length
        ? [
            `- Top patterns`,
            ...Object.entries(stats.patterns)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([name, cnt]) => `  - ${name}: ${cnt}`),
          ]
        : []),
    ]),
  ].join('\n');

  writeFileSync(`${base}.md`, mdContent);

  const htmlContent = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Daily Log Summary ${day}</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    section { margin-bottom: 40px; border-bottom: 1px solid #ccc; }
  </style>
</head>
<body>
  <h1>Daily Log Summary - ${day}</h1>
  ${Object.entries(totalsByDevice)
    .map(
      ([dev, stats]) => `
    <section>
      <h2>Device ${dev}</h2>
      <ul>
        <li>Total: ${stats.count}</li>
        <li>Priorities: ${Object.entries(stats.priorities).map(([k, v]) => `${k}:${v}`).join(', ') || '-' }</li>
        <li>Top patterns:
          <ul>
            ${Object.entries(stats.patterns)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([n, c]) => `<li>${n}: ${c}</li>`)
              .join('') || '<li>-</li>'}
          </ul>
        </li>
      </ul>
    </section>
  `
    )
    .join('')}
</body>
</html>`;

  writeFileSync(`${base}.html`, htmlContent);

  console.log(JSON.stringify(summary, null, 2));

  if (httpEndpoint) {
    try {
      await fetch(httpEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(summary),
      });
      console.error(`Posted summary to ${httpEndpoint}`);
    } catch (error: unknown) {
      console.error(`Failed to POST summary: ${getErrorMessage(error)}`);
    }
  }
};

export const summarizeCmd = new Command('summarize')
  .description('Summarize a day of JSONL logs exported by stream/stream-all')
  .requiredOption('--dir <path>', 'base directory passed to --export-jsonl')
  .option('--day <YYYY-MM-DD>', 'day folder under base dir; defaults to yesterday')
  .option('--device <serial>', 'summarize only this device (default: all)')
  .option('--out <path>', 'output directory for summaries (JSON + markdown + html)', './reports')
  .option('--http-endpoint <url>', 'optional HTTP endpoint to POST the JSON summary')
  .action((opts: SummarizeOptions) => {
    void performSummarize(opts).catch((err: unknown) => {
      console.error(`Summarize failed: ${getErrorMessage(err)}`);
      process.exit(1);
    });
  });
