/**
 * DaemonService interface and platform detection.
 * Provides a unified API for managing the Phalanx daemon across platforms.
 */
import { platform } from 'node:os';

export interface DaemonInstallOpts {
  /** Path to the Node.js executable */
  nodePath: string;
  /** Path to the daemon entry script */
  entryPath: string;
  /** Arguments to pass after the entry script */
  args?: string[];
  /** Working directory */
  workDir: string;
  /** Log file path */
  logPath: string;
}

export interface DaemonStatus {
  running: boolean;
  pid: number | null;
  uptime: number | null; // seconds
  platform: string;
}

/**
 * Platform-agnostic daemon service interface.
 */
export interface DaemonService {
  install(opts: DaemonInstallOpts): Promise<void>;
  uninstall(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): Promise<boolean>;
  status(): Promise<DaemonStatus>;
}

export type PlatformType = 'macos' | 'linux' | 'fallback';

/**
 * Detect the current platform for daemon management.
 */
export function detectPlatform(): PlatformType {
  const os = platform();
  if (os === 'darwin') return 'macos';
  if (os === 'linux') return 'linux';
  return 'fallback';
}
