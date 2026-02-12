import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockExistsSync, mockReadFileSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn<() => boolean>(),
  mockReadFileSync: vi.fn<() => string>(),
}));

vi.mock('fs', () => ({
  default: { existsSync: mockExistsSync, readFileSync: mockReadFileSync },
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
}));

import { loadChannelsConfig } from '../channel-config';

describe('channel-config', () => {
  const originalEnv = process.env.PHALANX_PROJECT_ROOT;

  beforeEach(() => {
    process.env.PHALANX_PROJECT_ROOT = '/test/project';
    mockExistsSync.mockReset();
    mockReadFileSync.mockReset();
  });

  afterEach(() => {
    process.env.PHALANX_PROJECT_ROOT = originalEnv;
  });

  it('returns default config when config file does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    const config = loadChannelsConfig();
    expect(config).toEqual({ web: { enabled: true } });
  });

  it('reads channels section from config.json', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      channels: {
        web: { enabled: true },
        telegram: { enabled: true, accounts: { default: { botToken: 'test' } } },
      },
    }));

    const config = loadChannelsConfig();
    expect(config.web.enabled).toBe(true);
    expect(config.telegram?.enabled).toBe(true);
  });

  it('ensures web is always present', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      channels: {
        telegram: { enabled: true },
      },
    }));

    const config = loadChannelsConfig();
    expect(config.web).toEqual({ enabled: true });
  });

  it('returns default on malformed JSON', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation(() => { throw new Error('parse error'); });

    const config = loadChannelsConfig();
    expect(config).toEqual({ web: { enabled: true } });
  });
});
