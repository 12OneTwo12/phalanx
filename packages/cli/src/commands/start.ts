/**
 * `phalanx start` — Start the Phalanx daemon.
 * Detects the platform and uses the appropriate service manager.
 */
import { Command } from 'commander';
import { resolve } from 'node:path';
import { logger } from '../utils/logger.js';
import { loadConfig } from '../utils/config-loader.js';
import { createDaemonService } from './daemon-factory.js';

export const startCommand = new Command('start')
  .description('Start the Phalanx daemon')
  .action(async () => {
    const config = loadConfig();
    if (!config) {
      logger.error('Phalanx not initialized. Run "phalanx init" first.');
      process.exitCode = 1;
      return;
    }

    const service = createDaemonService(config.projectRoot);

    if (await service.isRunning()) {
      logger.warn('Daemon is already running.');
      return;
    }

    try {
      await service.install({
        nodePath: process.execPath,
        entryPath: resolve(config.projectRoot, 'node_modules/@phalanx/core/dist/index.js'),
        workDir: config.projectRoot,
        logPath: resolve(config.projectRoot, config.logPath),
      });
      await service.start();
      logger.success('Daemon started.');
    } catch (err) {
      logger.error(`Failed to start daemon: ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
    }
  });
