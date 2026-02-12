/**
 * `phalanx init` — Initialize a project directory for Phalanx.
 * Creates .phalanx/ directory with default configuration.
 */
import { Command } from 'commander';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { logger } from '../utils/logger.js';
import { initConfig } from '../utils/config-loader.js';

export const initCommand = new Command('init')
  .description('Initialize Phalanx in the current directory')
  .option('-d, --dir <path>', 'Target directory', '.')
  .action((opts: { dir: string }) => {
    const projectRoot = resolve(opts.dir);
    const configDir = join(projectRoot, '.phalanx');

    if (existsSync(configDir)) {
      logger.warn('Phalanx is already initialized in this directory.');
      return;
    }

    const config = initConfig(projectRoot);
    logger.success('Phalanx initialized successfully.');
    logger.kv('Config directory', configDir);
    logger.kv('Database', config.dbPath);
    logger.kv('Dashboard port', config.dashboardPort);
    logger.dim('Run "phalanx start" to launch the daemon.');
  });
