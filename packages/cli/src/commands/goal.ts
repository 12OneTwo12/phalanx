/**
 * `phalanx goal` — Manage goals.
 */
import { Command } from 'commander';
import { logger } from '../utils/logger.js';
import { loadConfig } from '../utils/config-loader.js';

export const goalCommand = new Command('goal')
  .description('Manage goals');

goalCommand
  .command('add')
  .description('Add a new goal')
  .argument('<description>', 'Goal description')
  .action(async (description: string) => {
    const config = loadConfig();
    if (!config) {
      logger.error('Phalanx not initialized. Run "phalanx init" first.');
      process.exitCode = 1;
      return;
    }

    // Connect to database and create goal
    try {
      const core = await import('@phalanx/core');
      const db = core.DatabaseManager.create({ path: config.dbPath });
      core.migrateUp(db);
      const goalRepo = new core.GoalRepository(db.orm);
      const manager = new core.GoalManager(goalRepo);
      const goal = manager.create(description);
      logger.success(`Goal created: ${goal.id}`);
      logger.kv('Description', description);
      db.close();
    } catch (err) {
      logger.error(`Failed to create goal: ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
    }
  });

goalCommand
  .command('list')
  .description('List all goals')
  .action(async () => {
    const config = loadConfig();
    if (!config) {
      logger.error('Phalanx not initialized. Run "phalanx init" first.');
      process.exitCode = 1;
      return;
    }

    try {
      const core = await import('@phalanx/core');
      const db = core.DatabaseManager.create({ path: config.dbPath });
      core.migrateUp(db);
      const goalRepo = new core.GoalRepository(db.orm);
      const goals = goalRepo.findAll();

      if (goals.length === 0) {
        logger.info('No goals found. Use "phalanx goal add" to create one.');
      } else {
        logger.heading('Goals');
        for (const goal of goals) {
          const statusIcon = goal.status === 'active' ? '●' : goal.status === 'completed' ? '✔' : '◯';
          logger.item(`${statusIcon} [${goal.id.slice(0, 8)}] ${goal.description} (${goal.status}, ${goal.progress}%)`);
        }
      }
      db.close();
    } catch (err) {
      logger.error(`Failed to list goals: ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
    }
  });
