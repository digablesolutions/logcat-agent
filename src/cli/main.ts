#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { cleanupCmd } from './commands/cleanup.js';
import { streamCmd } from './commands/stream.js';
import { devicesCmd } from './commands/devices.js';
import { helpCmd } from './commands/help.js';
import { patternsCmd } from './commands/patterns.js';
import { realtimeCmd } from './commands/realtime.js';
import { streamAllCmd } from './commands/streamAll.js';
import { summarizeCmd } from './commands/summarize.js';
import { wifiCmd } from './commands/wifi.js';
import { createPluginManager } from '../pluginManager.js';
import { sicpPlugin } from '../sicpPlugin.js';
import { AppError, formatCliError } from '../errors.js';

const program = new Command();
program.name('logcat-agent').description('AI-assisted ADB logcat agent (CLI POC)').version('0.1.0');

const pluginManager = createPluginManager(program);
await pluginManager.loadPlugin(sicpPlugin);

program.addCommand(streamCmd);
program.addCommand(realtimeCmd);
program.addCommand(streamAllCmd);
program.addCommand(summarizeCmd);
program.addCommand(cleanupCmd);
program.addCommand(wifiCmd);
program.addCommand(devicesCmd);
program.addCommand(helpCmd);
program.addCommand(patternsCmd);

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(formatCliError(err));
  process.exit(err instanceof AppError ? err.exitCode : 1);
});
