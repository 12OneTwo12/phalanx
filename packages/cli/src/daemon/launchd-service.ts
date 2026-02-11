/**
 * macOS launchd-based daemon service.
 * Generates and manages a launchd plist for the Phalanx daemon.
 */
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';
import type { DaemonService, DaemonInstallOpts, DaemonStatus } from './platform-service.js';

const LABEL = 'com.phalanx.daemon';

function getPlistPath(): string {
  return join(homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
}

function buildPlist(opts: DaemonInstallOpts): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${opts.nodePath}</string>
    <string>${opts.entryPath}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${opts.workDir}</string>
  <key>StandardOutPath</key>
  <string>${opts.logPath}</string>
  <key>StandardErrorPath</key>
  <string>${opts.logPath}</string>
  <key>RunAtLoad</key>
  <false/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>`;
}

/**
 * Parse `ps` elapsed time format (e.g. "01:23", "2-03:45:12") into
 * a human-readable string like "2d 3h 45m".
 */
function parseEtime(etime: string): string {
  // Format: [[DD-]HH:]MM:SS
  const parts = etime.split('-');
  let days = 0;
  let timePart = etime;
  if (parts.length === 2) {
    days = parseInt(parts[0], 10);
    timePart = parts[1];
  }
  const segments = timePart.split(':').map((s) => parseInt(s, 10));
  let hours = 0;
  let minutes = 0;
  if (segments.length === 3) {
    hours = segments[0];
    minutes = segments[1];
  } else if (segments.length === 2) {
    minutes = segments[0];
  }
  const result: string[] = [];
  if (days > 0) result.push(`${days}d`);
  if (hours > 0) result.push(`${hours}h`);
  if (minutes > 0 || result.length === 0) result.push(`${minutes}m`);
  return result.join(' ');
}

export class LaunchdService implements DaemonService {
  async install(opts: DaemonInstallOpts): Promise<void> {
    const plistPath = getPlistPath();
    writeFileSync(plistPath, buildPlist(opts), 'utf-8');
  }

  async uninstall(): Promise<void> {
    await this.stop();
    const plistPath = getPlistPath();
    if (existsSync(plistPath)) {
      unlinkSync(plistPath);
    }
  }

  async start(): Promise<void> {
    const plistPath = getPlistPath();
    if (!existsSync(plistPath)) {
      throw new Error('Daemon not installed. Run "phalanx init" first.');
    }
    execSync(`launchctl load ${plistPath}`, { stdio: 'ignore' });
  }

  async stop(): Promise<void> {
    const plistPath = getPlistPath();
    if (!existsSync(plistPath)) return;

    try {
      execSync(`launchctl unload ${plistPath}`, { stdio: 'ignore' });
    } catch {
      // May not be loaded
    }
  }

  async isRunning(): Promise<boolean> {
    try {
      const output = execSync(`launchctl list ${LABEL} 2>/dev/null`, { encoding: 'utf-8' });
      return output.includes(LABEL);
    } catch {
      return false;
    }
  }

  async status(): Promise<DaemonStatus> {
    const running = await this.isRunning();
    let pid: number | null = null;

    if (running) {
      try {
        const output = execSync(`launchctl list ${LABEL}`, { encoding: 'utf-8' });
        const pidMatch = output.match(/"PID"\s*=\s*(\d+)/);
        if (pidMatch) pid = parseInt(pidMatch[1], 10);
      } catch {
        // Ignore
      }
    }

    let uptime: string | null = null;
    if (pid) {
      try {
        const etime = execSync(`ps -p ${pid} -o etime=`, { encoding: 'utf-8' }).trim();
        uptime = parseEtime(etime);
      } catch {
        // Process may have just exited
      }
    }

    return {
      running,
      pid,
      uptime,
      platform: 'launchd',
    };
  }
}
