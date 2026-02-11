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
  .action((description: string) => {
    const config = loadConfig();
    if (!config) {
      logger.error('Phalanx not initialized. Run "phalanx init" first.');
      process.exitCode = 1;
      return;
    }

    // Connect to database and create goal
    try {
      const { DatabaseManager, GoalRepository, migrateUp } = require('@phalanx/core');
      const db = DatabaseManager.create({ path: config.dbPath });
      migrateUp(db.raw);
      const goalRepo = new GoalRepository(db.orm);
      const { GoalManager } = require('@phalanx/core');
      const manager = new GoalManager(
        goalRepo,
        { findByGoalId: () => [] } as any,
        { findByEpicId: () => [] } as any,
      );
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
  .action(() => {
    const config = loadConfig();
    if (!config) {
      logger.error('Phalanx not initialized. Run "phalanx init" first.');
      process.exitCode = 1;
      return;
    }

    try {
      const { DatabaseManager, GoalRepository, migrateUp } = require('@phalanx/core');
      const db = DatabaseManager.create({ path: config.dbPath });
      migrateUp(db.raw);
      const goalRepo = new GoalRepository(db.orm);
      const goals = goalRepo.findAll();

      if (goals.length === 0) {
        logger.info('No goals found. Use "phalanx goal add" to create one.');
      } else {
        logger.heading('Goals');
        for (const goal of goals) {
          const statusIcon = goal.status === 'active' ? '●' : goal.status === 'completed' ? '✔' : '◯';
          console.log(`  ${statusIcon} [${goal.id.slice(0, 8)}] ${goal.description} (${goal.status}, ${goal.progress}%)`);
        }
      }
      db.close();
    } catch (err) {
      logger.error(`Failed to list goals: ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 1;
    }
  });
