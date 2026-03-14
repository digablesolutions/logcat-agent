import { Command } from 'commander';
import { runRetention, type RetentionPolicy } from '../../ingest/retention.js';
import { getConfigStore } from '../../configService.js';
import { parseFloatFlagValue, parseIntegerFlagValue } from '../logCommandSupport.js';

type CleanupOptions = Readonly<{
  dir?: string;
  days?: number;
  size?: number;
  dryRun?: boolean;
}>;

const performCleanup = async (options: CleanupOptions): Promise<void> => {
  const config = getConfigStore();
  const baseDir = options.dir || config.get('exportJsonlDir');

  if (!baseDir) {
    console.error('Error: No export directory specified. Use --dir or set LOGCAT_EXPORT_DIR.');
    process.exit(1);
  }

  const { days, size, dryRun } = options;

  if (!days && !size) {
    console.error('Error: Must specify --days or --size for cleanup.');
    process.exit(1);
  }

  console.log(`Cleaning up logs in ${baseDir}...`);
  if (dryRun) {
    console.log('(DRY RUN - no files will be deleted)');
  }

  const policy: RetentionPolicy = {
    maxAgeDays: days,
    maxSizeGb: size,
    dryRun: !!dryRun,
  };

  const { deletedDirs, totalDeletedBytes } = await runRetention(baseDir, policy);

  if (deletedDirs.length === 0) {
    console.log('No files needed cleaning up.');
    return;
  }

  console.log(`Deleted ${deletedDirs.length} directories:`);
  deletedDirs.forEach((d) => console.log(`  - ${d}`));
  const mb = (totalDeletedBytes / (1024 * 1024)).toFixed(2);
  console.log(`Total space freed: ${mb} MB`);
};

export const cleanupCmd = new Command('cleanup')
  .description('Cleanup old logs based on retention policy')
  .option('--dir <path>', 'Base directory for logs')
  .option('--days <number>', 'Maximum age in days', (v) => parseIntegerFlagValue(v, '--days', { minimum: 1 }))
  .option('--size <number>', 'Maximum total size in GB', (v) => parseFloatFlagValue(v, '--size', { minimum: 0 }))
  .option('--dry-run', 'List files that would be deleted without deleting them')
  .action((options: CleanupOptions) => {
    void performCleanup(options).catch((err) => {
      console.error(`Cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    });
  });
