/**
 * `phalanx stop` — Stop the Phalanx daemon.
 */
import { Command } from 'commander';
import { logger } from '../utils/logger.js';
import { loadConfig } from '../utils/config-loader.js';
import { createDaemonService } from './daemon-factory.js';

export const stopCommand = new Command('stop')
  .description('Stop the Phalanx daemon')
  .action(async () => {
    const config = loadConfig();
    if (!config) {
      logger.error('Phalanx not initialized. Run "phalanx init" first.');
      process.exitCode = 1;
      return;
    }

    const service = createDaemonService(config.projectRoot);

    if (!(await service.isRunning())) {
      logger.warn('Daemon is not running.');
      return;
    }

    try {
      await service.stop();
      logger.success('Daemon stopped.');
    } catch (err) {
      logger.error(`Failed to stop daemon: ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
    }
  });
