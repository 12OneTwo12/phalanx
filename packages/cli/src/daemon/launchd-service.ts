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
  const extraArgs = (opts.args ?? []).map((a) => `    <string>${a}</string>`).join('\n');
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
${extraArgs}
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
 * Parse `ps` elapsed time format (e.g. "01:23", "2-03:45:12") into total seconds.
 */
function parseEtime(etime: string): number {
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
  let seconds = 0;
  if (segments.length === 3) {
    hours = segments[0];
    minutes = segments[1];
    seconds = segments[2];
  } else if (segments.length === 2) {
    minutes = segments[0];
    seconds = segments[1];
  }
  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
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

    let uptime: number | null = null;
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
