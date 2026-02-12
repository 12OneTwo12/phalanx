/**
 * Factory for creating platform-appropriate DaemonService instances.
 */
import { detectPlatform, type DaemonService } from '../daemon/platform-service.js';
import { PidFileService } from '../daemon/pid-service.js';
import { LaunchdService } from '../daemon/launchd-service.js';
import { SystemdService } from '../daemon/systemd-service.js';

/**
 * Create a DaemonService for the current platform.
 */
export function createDaemonService(projectRoot: string): DaemonService {
  const platform = detectPlatform();

  switch (platform) {
    case 'macos':
      return new LaunchdService();
    case 'linux':
      return new SystemdService();
    case 'fallback':
    default:
      return new PidFileService(projectRoot);
  }
}
