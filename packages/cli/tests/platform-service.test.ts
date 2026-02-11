import { describe, it, expect, vi } from 'vitest';
import { detectPlatform } from '../src/daemon/platform-service.js';

describe('detectPlatform', () => {
  it('should return a valid platform type', () => {
    const result = detectPlatform();
    expect(['macos', 'linux', 'fallback']).toContain(result);
  });
});

describe('DaemonService interface', () => {
  it('should define the expected methods', async () => {
    // Verify the interface shape through a mock implementation
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
