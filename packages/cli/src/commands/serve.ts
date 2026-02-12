/**
 * `phalanx serve` — Run the dashboard server in the foreground.
 * This is the daemon entry point, spawned by `phalanx start`.
 * Not intended to be called directly by users.
 */
import { Command } from 'commander';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { fork } from 'node:child_process';
import { logger } from '../utils/logger.js';
import { loadConfig } from '../utils/config-loader.js';

export const serveCommand = new Command('serve')
  .description('Run the dashboard server (used by daemon)')
  .option('--port <port>', 'Override dashboard port')
  .action(async (opts) => {
    const config = loadConfig();
    if (!config) {
      logger.error('Phalanx not initialized.');
      process.exitCode = 1;
      return;
    }

    const port = opts.port ?? config.dashboardPort;

    // Resolve dashboard package — try multiple locations
    const dashboardDir = resolveDashboardDir(config.projectRoot);
    if (!dashboardDir) {
      logger.error('Dashboard package not found. Ensure @phalanx/dashboard is installed.');
      process.exitCode = 1;
      return;
    }

    const nextBin = resolveNextBin(dashboardDir);
    if (!nextBin) {
      logger.error('Next.js binary not found. Run "pnpm install" first.');
      process.exitCode = 1;
      return;
    }

    logger.info(`Starting dashboard on port ${port}...`);

    // Start Next.js in the dashboard directory
    const child = fork(nextBin, ['start', '--port', String(port)], {
      cwd: dashboardDir,
      env: {
        ...process.env,
        PHALANX_PROJECT_ROOT: config.projectRoot,
        PHALANX_DB_PATH: resolve(config.projectRoot, config.dbPath),
      },
      stdio: 'inherit',
    });

    child.on('exit', (code) => {
      process.exitCode = code ?? 1;
    });
  });

/**
 * Resolve the @phalanx/dashboard package directory.
 * Checks: CLI sibling (monorepo), node_modules, projectRoot node_modules.
 */
function resolveDashboardDir(projectRoot: string): string | null {
  const candidates = [
    // Monorepo sibling: packages/cli/dist -> packages/dashboard
    resolve(import.meta.dirname, '..', '..', 'dashboard'),
    // node_modules relative to CLI package
    resolve(import.meta.dirname, '..', 'node_modules', '@phalanx', 'dashboard'),
    // node_modules relative to project root
    resolve(projectRoot, 'node_modules', '@phalanx', 'dashboard'),
  ];

  for (const dir of candidates) {
    if (existsSync(resolve(dir, 'package.json'))) {
      return dir;
    }
  }
  return null;
}

/**
 * Resolve the Next.js JS entry point (not the shell wrapper in .bin/).
 * fork() requires a JS module, not a shell script.
 */
function resolveNextBin(dashboardDir: string): string | null {
  const candidates = [
    resolve(dashboardDir, 'node_modules', 'next', 'dist', 'bin', 'next'),
    resolve(dashboardDir, '..', '..', 'node_modules', 'next', 'dist', 'bin', 'next'),
  ];

  for (const bin of candidates) {
    if (existsSync(bin)) {
      return bin;
    }
  }
  return null;
}
