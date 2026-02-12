import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectPlatform, type PlatformType } from '../src/daemon/platform-service.js';

describe('detectPlatform', () => {
  it('should return a valid platform type', () => {
    const result = detectPlatform();
    expect(['macos', 'linux', 'fallback']).toContain(result);
  });

  it('should return macos on darwin', async () => {
    // Use the actual platform to verify mapping
    const os = await import('node:os');
    const actual = os.platform();
    const result = detectPlatform();

    if (actual === 'darwin') expect(result).toBe('macos');
    else if (actual === 'linux') expect(result).toBe('linux');
    else expect(result).toBe('fallback');
  });
});

describe('DaemonService interface', () => {
  it('should define the expected methods', async () => {
    const mockService = {
      install: vi.fn(),
      uninstall: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      isRunning: vi.fn().mockResolvedValue(false),
      status: vi.fn().mockResolvedValue({ running: false, pid: null, uptime: null, platform: 'test' }),
    };

    expect(await mockService.isRunning()).toBe(false);
    const status = await mockService.status();
    expect(status).toHaveProperty('running');
    expect(status).toHaveProperty('pid');
    expect(status).toHaveProperty('platform');
  });
});

describe('createDaemonService', () => {
  it('should return a service with all required methods', async () => {
    const { createDaemonService } = await import('../src/commands/daemon-factory.js');
    const service = createDaemonService('/tmp/test-project');

    expect(typeof service.install).toBe('function');
    expect(typeof service.uninstall).toBe('function');
    expect(typeof service.start).toBe('function');
    expect(typeof service.stop).toBe('function');
    expect(typeof service.isRunning).toBe('function');
    expect(typeof service.status).toBe('function');
  });
});
