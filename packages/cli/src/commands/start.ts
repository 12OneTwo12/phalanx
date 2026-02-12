/**
 * `phalanx start` — Start the Phalanx daemon.
 * Spawns `phalanx serve` as a background daemon process.
 * Follows OpenClaw's pattern: daemon entry point = CLI itself + subcommand.
 */
import { Command } from 'commander';
import { resolve } from 'node:path';
import { createConnection } from 'node:net';
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

/**
 * Wait until a TCP port is accepting connections.
 */
function waitForPort(port: number, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  return new Promise((resolve) => {
    function attempt() {
      if (Date.now() - start > timeoutMs) {
        resolve(false);
        return;
      }
      const socket = createConnection({ port, host: '127.0.0.1' }, () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('error', () => {
        socket.destroy();
        setTimeout(attempt, 1000);
      });
    }
    attempt();
  });
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

      const port = config.dashboardPort;
      const ready = await waitForPort(port, 30_000);
      if (ready) {
        logger.success(`Dashboard ready: http://localhost:${port}`);
      } else {
        logger.warn(`Dashboard is starting on port ${port} (may take a few more seconds).`);
        logger.dim(`Check logs: ${resolve(config.projectRoot, config.logPath)}`);
      }
    } catch (err) {
      logger.error(`Failed to start daemon: ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
    }
  });
