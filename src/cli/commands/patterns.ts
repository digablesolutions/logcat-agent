import { Command } from 'commander';
import chalk from 'chalk';
import { defaultPatterns } from '../../pipeline/patterns.js';
import { resolveActivePatterns } from '../../pipeline/customPatterns.js';
import type { IPattern } from '../../pipeline/types.js';

type PatternsOptions = Readonly<{
  list?: boolean;
  test?: string;
  patternsFile?: string;
  customPatternsOnly?: boolean;
}>;

const getSeverityIcon = (severity: string): string => {
  switch (severity) {
    case 'error':
      return '🚨';
    case 'warning':
      return '⚠️';
    default:
      return 'ℹ️';
  }
};

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'error':
      return chalk.red;
    case 'warning':
      return chalk.yellow;
    default:
      return chalk.blue;
  }
};

const performPatternAction = async (opts: PatternsOptions): Promise<void> => {
  const patterns: ReadonlyArray<IPattern> = await resolveActivePatterns(
    defaultPatterns,
    opts.patternsFile,
    opts.customPatternsOnly ? 'custom' : 'merge'
  );

  if (opts.test) {
    const testMsg = opts.test;
    console.log(chalk.cyan(`🧪 Testing patterns against: "${testMsg}"`));
    console.log();

    const matches = patterns.filter((pattern) => pattern.regex.test(testMsg));

    matches.forEach((pattern) => {
      console.log(chalk.green(`✅ Match: ${chalk.bold(pattern.name)}`));
      console.log(chalk.gray(`   Pattern: ${pattern.regex.source}`));
      console.log(chalk.gray(`   Severity: ${pattern.severity}`));
      console.log(chalk.gray(`   Description: ${pattern.description}`));
      console.log();
    });

    if (matches.length === 0) {
      console.log(chalk.yellow('⚠️  No patterns matched this message.'));
    } else {
      console.log(chalk.green(`🎯 Found ${matches.length} matching pattern${matches.length > 1 ? 's' : ''}!`));
    }
    return;
  }

  if (opts.list) {
    console.log(chalk.cyan('📋 Available Error Detection Patterns:'));
    console.log(chalk.cyan('═'.repeat(60)));
    console.log();

    const grouped = patterns.reduce(
      (acc, pattern) => {
        const key = pattern.severity;
        acc[key] = [...(acc[key] ?? []), pattern];
        return acc;
      },
      {} as Record<string, IPattern[]>
    );

    Object.entries(grouped).forEach(([severity, group]) => {
      const severityColor = getSeverityColor(severity);
      const icon = getSeverityIcon(severity);

      console.log(severityColor(`${icon} ${severity.toUpperCase()} (${group.length} patterns):`));
      group.forEach((pattern) => {
        console.log(`  • ${chalk.bold(pattern.name)}`);
        console.log(chalk.gray(`    ${pattern.description}`));
      });
      console.log();
    });

    console.log(chalk.gray('💡 Use --test "your log message" to test patterns'));
    return;
  }

  // Default: show summary
  console.log(chalk.cyan('🎯 Pattern Detection System'));
  console.log(chalk.cyan('═'.repeat(40)));
  console.log();
  console.log(`📊 Total patterns: ${chalk.bold(patterns.length)}`);

  const severityCounts = patterns.reduce(
    (acc, p) => {
      acc[p.severity] = (acc[p.severity] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  Object.entries(severityCounts).forEach(([severity, count]) => {
    const icon = getSeverityIcon(severity);
    console.log(`${icon} ${severity}: ${count}`);
  });

  console.log();
  console.log('Commands:');
  console.log('  --list                    Show all patterns');
  console.log('  --test "message"          Test patterns against a message');
  console.log();
};

export const patternsCmd = new Command('patterns')
  .description('Manage error detection patterns')
  .option('-l, --list', 'list all available patterns')
  .option('-t, --test <message>', 'test patterns against a log message')
  .option('--patterns-file <path>', 'JSON file with custom patterns to extend defaults')
  .option('--custom-patterns-only', 'use only patterns from --patterns-file (no built-ins)')
  .action((opts: PatternsOptions) => {
    void performPatternAction(opts);
  });
