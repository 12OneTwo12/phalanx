/**
 * `phalanx status` — Display current daemon and project status.
 */
import { Command } from 'commander';
import { logger } from '../utils/logger.js';
import { loadConfig } from '../utils/config-loader.js';
import { createDaemonService } from './daemon-factory.js';

export const statusCommand = new Command('status')
  .description('Show current Phalanx status')
  .action(async () => {
    const config = loadConfig();
    if (!config) {
      logger.error('Phalanx not initialized. Run "phalanx init" first.');
      process.exitCode = 1;
      return;
    }

    const service = createDaemonService(config.projectRoot);
    const daemonStatus = await service.status();

    logger.heading('Phalanx Status');
    logger.kv('Project', config.projectRoot);
    logger.kv('Daemon', daemonStatus.running ? 'running' : 'stopped');
    logger.kv('Platform', daemonStatus.platform);

    if (daemonStatus.pid) {
      logger.kv('PID', daemonStatus.pid);
    }

    if (daemonStatus.uptime !== null) {
      logger.kv('Uptime', `${daemonStatus.uptime}s`);
    }

    logger.kv('Database', config.dbPath);
    logger.kv('Dashboard', `http://localhost:${config.dashboardPort}`);
  });
