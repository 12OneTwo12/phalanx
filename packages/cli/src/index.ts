#!/usr/bin/env node
/**
 * Phalanx CLI — entry point.
 * Goal-driven autonomous AI agent team orchestrator.
 */
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { startCommand } from './commands/start.js';
import { stopCommand } from './commands/stop.js';
import { statusCommand } from './commands/status.js';
import { goalCommand } from './commands/goal.js';
import { configCommand } from './commands/config.js';
import { serveCommand } from './commands/serve.js';

const program = new Command()
  .name('phalanx')
  .description('Goal-driven autonomous AI agent team orchestrator')
  .version('0.1.0');

program.addCommand(initCommand);
program.addCommand(startCommand);
program.addCommand(stopCommand);
program.addCommand(statusCommand);
program.addCommand(goalCommand);
program.addCommand(configCommand);
program.addCommand(serveCommand);

program.parse();
