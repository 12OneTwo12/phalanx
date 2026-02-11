/**
 * CLI logger with chalk-based colorized output.
 */
import chalk from 'chalk';

export const logger = {
  info(message: string): void {
    console.log(chalk.blue('ℹ'), message);
  },

  success(message: string): void {
    console.log(chalk.green('✔'), message);
  },

  warn(message: string): void {
    console.log(chalk.yellow('⚠'), message);
  },

  error(message: string): void {
    console.error(chalk.red('✖'), message);
  },

  heading(message: string): void {
    console.log(chalk.bold.cyan(message));
  },

  dim(message: string): void {
    console.log(chalk.dim(message));
  },

  /** List item display */
  item(message: string): void {
    console.log(`  ${message}`);
  },

  /** Key-value pair display */
  kv(key: string, value: string | number | boolean): void {
    console.log(`  ${chalk.gray(key + ':')} ${value}`);
  },
};
