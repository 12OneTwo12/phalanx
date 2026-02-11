import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initCommand } from '../src/commands/init.js';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('init command', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'phalanx-cmd-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should create .phalanx directory', () => {
    // Simulate command action
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    initCommand.parseAsync(['node', 'test', '-d', tempDir]);

    expect(existsSync(join(tempDir, '.phalanx'))).toBe(true);
    expect(existsSync(join(tempDir, '.phalanx/config.json'))).toBe(true);
    consoleSpy.mockRestore();
  });

  it('should warn if already initialized', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    // Init twice
    initCommand.parseAsync(['node', 'test', '-d', tempDir]);
    initCommand.parseAsync(['node', 'test', '-d', tempDir]);

    // Second call should warn
    const calls = consoleSpy.mock.calls.flat().join(' ');
    expect(calls).toContain('already initialized');
    consoleSpy.mockRestore();
  });
});

describe('logger', () => {
  it('should export all log methods', async () => {
    const { logger } = await import('../src/utils/logger.js');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.success).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.heading).toBe('function');
    expect(typeof logger.dim).toBe('function');
    expect(typeof logger.kv).toBe('function');
  });
});
