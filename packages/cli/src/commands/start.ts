/**
 * `phalanx start` — Start the Phalanx daemon.
 * Spawns `phalanx serve` as a background daemon process.
 * Follows OpenClaw's pattern: daemon entry point = CLI itself + subcommand.
 */
import { Command } from 'commander';
import { resolve } from 'node:path';
import { logger } from '../utils/logger.js';
import { loadConfig } from '../utils/config-loader.js';
import { createDaemonService } from './daemon-factory.js';

/**
 * Resolve the CLI entry point path for daemon spawning.
 * Uses process.argv[1] (the currently running script).
 */
function resolveCliEntryPath(): string {
  const argv1 = process.argv[1];
  if (!argv1) {
    throw new Error('Unable to resolve CLI entry point path');
  }
  return resolve(argv1);
}

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
      const cliEntry = resolveCliEntryPath();

      await service.install({
        nodePath: process.execPath,
        entryPath: cliEntry,
        args: ['serve', '--port', String(config.dashboardPort)],
        workDir: config.projectRoot,
        logPath: resolve(config.projectRoot, config.logPath),
      });
      await service.start();
      logger.success('Daemon started.');
      logger.info(`Dashboard: http://localhost:${config.dashboardPort}`);
    } catch (err) {
      logger.error(`Failed to start daemon: ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
    }
  });
