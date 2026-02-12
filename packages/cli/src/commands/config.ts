/**
 * `phalanx config` — View or update Phalanx configuration.
 */
import { Command } from 'commander';
import { logger } from '../utils/logger.js';
import { loadConfig } from '../utils/config-loader.js';
import { runSetupWizard } from '../wizard/setup-wizard.js';
import { PROVIDER_ENV_VARS } from '../wizard/provider-validator.js';

export const configCommand = new Command('config')
  .description('View or update Phalanx configuration')
  .action(async () => {
    const config = loadConfig();
    if (!config) {
      logger.error('Phalanx not initialized. Run "phalanx init" first.');
      process.exitCode = 1;
      return;
    }

    if (!process.stdout.isTTY) {
      logger.error('Interactive terminal required. Use "phalanx config show" instead.');
      process.exitCode = 1;
      return;
    }

    await runSetupWizard(config);
  });

configCommand
  .command('show')
  .description('Display current configuration')
  .action(() => {
    const config = loadConfig();
    if (!config) {
      logger.error('Phalanx not initialized. Run "phalanx init" first.');
      process.exitCode = 1;
      return;
    }

    logger.heading('Phalanx Configuration');
    logger.kv('Project root', config.projectRoot);
    logger.kv('Database', config.dbPath);
    logger.kv('Dashboard port', config.dashboardPort);
    logger.kv('Log path', config.logPath);

    console.log();
    logger.heading('LLM');
    logger.kv('System default', config.llm.systemDefault);

    const providers = config.llm.providers;
    if (Object.keys(providers).length === 0) {
      logger.dim('  No providers configured. Run "phalanx config" to set up.');
    } else {
      for (const [name, entry] of Object.entries(providers)) {
        const status = entry.enabled ? 'enabled' : 'disabled';
        const envVar = PROVIDER_ENV_VARS[name];
        const hasKey = envVar ? !!process.env[envVar] : false;
        const keyStatus = hasKey ? 'key set' : 'key missing';
        logger.kv(`  ${name}`, `${status} (${keyStatus})`);
        if (entry.defaultModel) {
          logger.dim(`    model: ${entry.defaultModel}`);
        }
        if (entry.baseUrl) {
          logger.dim(`    url: ${entry.baseUrl}`);
        }
      }
    }

    console.log();
    logger.heading('Daemon');
    logger.kv('Auto-start', config.daemon.autoStart ? 'yes' : 'no');
  });
