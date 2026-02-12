/**
 * Linux systemd-based daemon service.
 * Generates and manages a systemd user service for the Phalanx daemon.
 */
import { existsSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';
import type { DaemonService, DaemonInstallOpts, DaemonStatus } from './platform-service.js';

const SERVICE_NAME = 'phalanx';

function getServicePath(): string {
  return join(homedir(), '.config', 'systemd', 'user', `${SERVICE_NAME}.service`);
}

function buildUnit(opts: DaemonInstallOpts): string {
  return `[Unit]
Description=Phalanx AI Team Daemon
After=network.target

[Service]
Type=simple
ExecStart=${opts.nodePath} ${opts.entryPath}
WorkingDirectory=${opts.workDir}
Restart=on-failure
RestartSec=10
StandardOutput=append:${opts.logPath}
StandardError=append:${opts.logPath}
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
`;
}

export class SystemdService implements DaemonService {
  async install(opts: DaemonInstallOpts): Promise<void> {
    const servicePath = getServicePath();
    const dir = join(homedir(), '.config', 'systemd', 'user');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(servicePath, buildUnit(opts), 'utf-8');
    execSync('systemctl --user daemon-reload', { stdio: 'ignore' });
  }

  async uninstall(): Promise<void> {
    await this.stop();
    const servicePath = getServicePath();
    if (existsSync(servicePath)) {
      unlinkSync(servicePath);
      execSync('systemctl --user daemon-reload', { stdio: 'ignore' });
    }
  }

  async start(): Promise<void> {
    execSync(`systemctl --user start ${SERVICE_NAME}`, { stdio: 'ignore' });
  }

  async stop(): Promise<void> {
    try {
      execSync(`systemctl --user stop ${SERVICE_NAME}`, { stdio: 'ignore' });
    } catch {
      // May not be running
    }
  }

  async isRunning(): Promise<boolean> {
    try {
      const output = execSync(`systemctl --user is-active ${SERVICE_NAME}`, { encoding: 'utf-8' });
      return output.trim() === 'active';
    } catch {
      return false;
    }
  }

  async status(): Promise<DaemonStatus> {
    const running = await this.isRunning();
    let pid: number | null = null;
    let uptime: number | null = null;

    if (running) {
      try {
        const pidOutput = execSync(
          `systemctl --user show ${SERVICE_NAME} --property=MainPID --value`,
          { encoding: 'utf-8' },
        );
        pid = parseInt(pidOutput.trim(), 10) || null;

        const timestampOutput = execSync(
          `systemctl --user show ${SERVICE_NAME} --property=ActiveEnterTimestamp --value`,
          { encoding: 'utf-8' },
        );
        const startTime = new Date(timestampOutput.trim()).getTime();
        if (!isNaN(startTime)) {
          uptime = Math.floor((Date.now() - startTime) / 1000);
        }
      } catch {
        // Ignore parse errors
      }
    }

    return {
      running,
      pid,
      uptime,
      platform: 'systemd',
    };
  }
}
