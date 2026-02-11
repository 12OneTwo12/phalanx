/**
 * PID file-based daemon service — fallback implementation.
 * Uses fork + PID file for platforms without native service managers.
 */
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { fork } from 'node:child_process';
import { join, dirname } from 'node:path';
import type { DaemonService, DaemonInstallOpts, DaemonStatus } from './platform-service.js';

const PID_FILE = '.phalanx/daemon.pid';

export class PidFileService implements DaemonService {
  private pidPath: string;
  private opts: DaemonInstallOpts | null = null;

  constructor(private readonly projectRoot: string) {
    this.pidPath = join(projectRoot, PID_FILE);
  }

  async install(opts: DaemonInstallOpts): Promise<void> {
    this.opts = opts;
  }

  async uninstall(): Promise<void> {
    await this.stop();
    this.opts = null;
  }

  async start(): Promise<void> {
    if (await this.isRunning()) {
      throw new Error('Daemon is already running');
    }

    if (!this.opts) {
      throw new Error('Daemon not installed. Run "phalanx init" first.');
    }

    const child = fork(this.opts.entryPath, [], {
      cwd: this.opts.workDir,
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        PHALANX_DB_PATH: join(this.projectRoot, '.phalanx/phalanx.db'),
        PHALANX_LOG_PATH: this.opts.logPath,
      },
    });

    child.unref();

    if (child.pid) {
      this.writePid(child.pid);
    }
  }

  async stop(): Promise<void> {
    const pid = this.readPid();
    if (pid === null) return;

    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Process may already be gone
    }

    this.removePid();
  }

  async isRunning(): Promise<boolean> {
    const pid = this.readPid();
    if (pid === null) return false;

    try {
      // Signal 0 checks if process exists without sending a signal
      process.kill(pid, 0);
      return true;
    } catch {
      // Process doesn't exist, clean up stale PID file
      this.removePid();
      return false;
    }
  }

  async status(): Promise<DaemonStatus> {
    const running = await this.isRunning();
    const pid = this.readPid();

    return {
      running,
      pid,
      uptime: null, // PID file doesn't track start time
      platform: 'pid-file',
    };
  }

  private readPid(): number | null {
    if (!existsSync(this.pidPath)) return null;

    try {
      const content = readFileSync(this.pidPath, 'utf-8').trim();
      const pid = parseInt(content, 10);
      return isNaN(pid) ? null : pid;
    } catch {
      return null;
    }
  }

  private writePid(pid: number): void {
    const dir = dirname(this.pidPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.pidPath, String(pid), 'utf-8');
  }

  private removePid(): void {
    try {
      if (existsSync(this.pidPath)) {
        unlinkSync(this.pidPath);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}
