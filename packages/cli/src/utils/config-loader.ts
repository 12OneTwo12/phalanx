/**
 * Configuration loader — reads .phalanx/ project configuration.
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LLMProviderEntry {
  enabled: boolean;
  defaultModel?: string;
  /** Base URL override (primarily for Ollama) */
  baseUrl?: string;
}

export interface PhalanxConfig {
  /** Project root directory */
  projectRoot: string;
  /** Database file path */
  dbPath: string;
  /** Dashboard port */
  dashboardPort: number;
  /** Log file path */
  logPath: string;
  /** LLM provider configuration */
  llm: {
    /** System-wide default model in "provider/model" format */
    systemDefault: string;
    /** Per-provider settings */
    providers: Record<string, LLMProviderEntry>;
  };
  /** Daemon settings */
  daemon: {
    /** Whether to start Phalanx automatically on boot */
    autoStart: boolean;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONFIG_DIR = '.phalanx';
const CONFIG_FILE = 'config.json';

const DEFAULT_LLM: PhalanxConfig['llm'] = {
  systemDefault: 'anthropic/claude-sonnet-4-5-20250929',
  providers: {},
};

const DEFAULT_DAEMON: PhalanxConfig['daemon'] = {
  autoStart: false,
};

const DEFAULT_CONFIG: Omit<PhalanxConfig, 'projectRoot'> = {
  dbPath: '.phalanx/phalanx.db',
  dashboardPort: 3000,
  logPath: '.phalanx/phalanx.log',
  llm: DEFAULT_LLM,
  daemon: DEFAULT_DAEMON,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

  if (!existsSync(join(root, CONFIG_DIR))) return null;

  const configPath = join(root, CONFIG_DIR, CONFIG_FILE);

  if (!existsSync(configPath)) {
    return { projectRoot: root, ...DEFAULT_CONFIG };
  }

  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<PhalanxConfig>;
    return {
      projectRoot: root,
      dbPath: parsed.dbPath ?? DEFAULT_CONFIG.dbPath,
      dashboardPort: parsed.dashboardPort ?? DEFAULT_CONFIG.dashboardPort,
      logPath: parsed.logPath ?? DEFAULT_CONFIG.logPath,
      llm: {
        systemDefault: parsed.llm?.systemDefault ?? DEFAULT_LLM.systemDefault,
        providers: parsed.llm?.providers ?? DEFAULT_LLM.providers,
      },
      daemon: {
        autoStart: parsed.daemon?.autoStart ?? DEFAULT_DAEMON.autoStart,
      },
    };
  } catch {
    return { projectRoot: root, ...DEFAULT_CONFIG };
  }
}

/**
 * Initialize the .phalanx directory and write default config.
 * Does NOT run the wizard — callers should invoke the wizard separately.
 */
export function initConfig(projectRoot: string): PhalanxConfig {
  const configDir = join(projectRoot, CONFIG_DIR);

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  const config: PhalanxConfig = { projectRoot, ...DEFAULT_CONFIG };
  saveConfig(config);
  return config;
}

/**
 * Save configuration to the .phalanx/config.json file.
 */
export function saveConfig(config: PhalanxConfig): void {
  const configDir = join(config.projectRoot, CONFIG_DIR);
  const configPath = join(configDir, CONFIG_FILE);

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  // Exclude projectRoot from persisted config (it's derived at load time)
  const { projectRoot: _, ...persistable } = config;
  writeFileSync(configPath, JSON.stringify(persistable, null, 2) + '\n', 'utf-8');
}
