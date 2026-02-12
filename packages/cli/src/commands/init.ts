/**
 * `phalanx init` — Initialize a project directory for Phalanx.
 * Creates .phalanx/ directory with default configuration and runs the setup wizard.
 */
import { Command } from 'commander';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { logger } from '../utils/logger.js';
import { initConfig } from '../utils/config-loader.js';
import { runSetupWizard } from '../wizard/setup-wizard.js';

export const initCommand = new Command('init')
  .description('Initialize Phalanx in the current directory')
  .option('-d, --dir <path>', 'Target directory', '.')
  .option('--no-wizard', 'Skip interactive setup wizard')
  .action(async (opts: { dir: string; wizard: boolean }) => {
    const projectRoot = resolve(opts.dir);
    const configDir = join(projectRoot, '.phalanx');

    if (existsSync(configDir)) {
      logger.warn('Phalanx is already initialized in this directory.');
      logger.dim('Run "phalanx config" to reconfigure.');
      return;
    }

    const config = initConfig(projectRoot);
    logger.success('Phalanx initialized.');
    logger.kv('Config directory', configDir);
    logger.kv('Database', config.dbPath);
    logger.kv('Dashboard port', config.dashboardPort);

    // Run interactive wizard if TTY is available and not skipped
    if (opts.wizard && process.stdout.isTTY) {
      console.log();
      await runSetupWizard(config);
    } else if (!opts.wizard) {
      logger.dim('Wizard skipped. Run "phalanx config" to configure providers.');
    } else {
      logger.dim('Non-interactive terminal detected. Run "phalanx config" to configure.');
    }
  });
