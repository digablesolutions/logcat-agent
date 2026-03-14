import { Command } from 'commander';
import chalk from 'chalk';

const renderSection = (title: string, commands: ReadonlyArray<string>): void => {
  console.log(chalk.yellow(title));
  commands.forEach((cmd) => console.log(cmd));
  console.log();
};

const performHelp = (): void => {
  const cli = 'npx tsx src/cli/main.ts';

  console.log(chalk.cyan('🚀 Android Logcat Agent - Quick Start Guide'));
  console.log(chalk.cyan('═'.repeat(60)));
  console.log();

  renderSection('📱 Device Management:', [
    `  ${cli} devices              # List all devices`,
    `  ${cli} devices --long       # Detailed device info`,
  ]);

  renderSection('🔍 Basic Streaming:', [
    `  ${cli} stream               # Auto-select first device`,
    `  ${cli} stream -s SERIAL     # Use specific device`,
    `  ${cli} stream --interactive  # Pick device interactively`,
  ]);

  renderSection('🎛️  Filtering Options:', [
    `  ${cli} stream -p E          # Only errors and fatal`,
    `  ${cli} stream -p W          # Warnings and above`,
    `  ${cli} stream -t "MyApp,ActivityManager"`,
    `  ${cli} stream -b "main,crash,system"`,
  ]);

  renderSection('🤖 AI Features:', [
    `  ${cli} stream --no-ai       # Disable AI analysis`,
    `  ${cli} stream --model gpt-4 # Use different AI model`,
    `  ${cli} stream --provider openai --openai-base-url http://localhost:11434/v1 --model llama3.1:8b-instruct  # Local SLM via Ollama`,
  ]);

  renderSection('📊 Advanced Options:', [
    `  ${cli} stream --save-logs   # Save session to file`,
    `  ${cli} stream --max-lines 10000 # Memory limit`,
  ]);

  renderSection('🎯 Priority Levels:', [
    '  V = Verbose   D = Debug    I = Info',
    '  W = Warning   E = Error    F = Fatal',
  ]);

  renderSection('💡 Pro Tips:', [
    '  • Use Ctrl+C to exit with session summary',
    '  • Patterns are detected automatically (NPE, ANR, OOM, etc.)',
    '  • AI analyzes errors and suggests solutions',
    '  • Set OPENAI_API_KEY environment variable for AI features',
    '  • Logs are color-coded by priority with emoji indicators',
  ]);

  console.log(chalk.green('✨ Example Session:'));
  console.log(chalk.gray(`  ${cli} stream -s AU1A1703007694 -p W -t "MyApp" --save-logs`));
  console.log();
};

export const helpCmd = new Command('help')
  .description('Show usage examples and tips')
  .action(() => performHelp());
