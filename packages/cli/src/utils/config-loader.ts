/**
 * Configuration loader — reads .phalanx/ project configuration.
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface PhalanxConfig {
  /** Project root directory */
  projectRoot: string;
  /** Database file path */
  dbPath: string;
  /** Dashboard port */
  dashboardPort: number;
  /** Log file path */
  logPath: string;
}

const CONFIG_DIR = '.phalanx';
const CONFIG_FILE = 'config.json';

const DEFAULT_CONFIG: Omit<PhalanxConfig, 'projectRoot'> = {
  dbPath: '.phalanx/phalanx.db',
  dashboardPort: 3000,
  logPath: '.phalanx/phalanx.log',
};

/**
 * Find the .phalanx directory by walking up from the given path.
 * Returns the project root or null if not found.
 */
export function findProjectRoot(from: string = process.cwd()): string | null {
  let dir = resolve(from);
  const root = resolve('/');

  while (dir !== root) {
    if (existsSync(join(dir, CONFIG_DIR))) {
      return dir;
    }
    dir = resolve(dir, '..');
  }

  return null;
}

/**
 * Load configuration from the .phalanx directory.
 */
export function loadConfig(projectRoot?: string): PhalanxConfig | null {
  const root = projectRoot ?? findProjectRoot();
  if (!root) return null;

  // Verify the .phalanx directory exists
  if (!existsSync(join(root, CONFIG_DIR))) return null;

  const configPath = join(root, CONFIG_DIR, CONFIG_FILE);

  if (!existsSync(configPath)) {
    return {
      projectRoot: root,
      ...DEFAULT_CONFIG,
    };
  }

  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<PhalanxConfig>;
    return {
      projectRoot: root,
      dbPath: parsed.dbPath ?? DEFAULT_CONFIG.dbPath,
      dashboardPort: parsed.dashboardPort ?? DEFAULT_CONFIG.dashboardPort,
      logPath: parsed.logPath ?? DEFAULT_CONFIG.logPath,
    };
  } catch {
    return {
      projectRoot: root,
      ...DEFAULT_CONFIG,
    };
  }
}

/**
 * Initialize the .phalanx directory and config file.
 */
export function initConfig(projectRoot: string): PhalanxConfig {
  const configDir = join(projectRoot, CONFIG_DIR);
  const configPath = join(configDir, CONFIG_FILE);

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  const config: PhalanxConfig = {
    projectRoot,
    ...DEFAULT_CONFIG,
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  return config;
}
