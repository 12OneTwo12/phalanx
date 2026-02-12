import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PidFileService } from '../src/daemon/pid-service.js';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('PidFileService', () => {
  let tempDir: string;
  let service: PidFileService;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'phalanx-test-'));
    mkdirSync(join(tempDir, '.phalanx'), { recursive: true });
    service = new PidFileService(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should report not running when no PID file exists', async () => {
    expect(await service.isRunning()).toBe(false);
  });

  it('should report not running for stale PID', async () => {
    // Write a PID that almost certainly doesn't exist
    writeFileSync(join(tempDir, '.phalanx/daemon.pid'), '999999999', 'utf-8');
    expect(await service.isRunning()).toBe(false);
    // Should clean up stale PID file
    expect(existsSync(join(tempDir, '.phalanx/daemon.pid'))).toBe(false);
  });

  it('should report running for the current process PID', async () => {
    writeFileSync(join(tempDir, '.phalanx/daemon.pid'), String(process.pid), 'utf-8');
    expect(await service.isRunning()).toBe(true);
  });

  it('should return status with running info', async () => {
    const status = await service.status();
    expect(status.running).toBe(false);
    expect(status.pid).toBeNull();
    expect(status.platform).toBe('pid-file');
  });

  it('should stop gracefully when not running', async () => {
    // Should not throw
    await service.stop();
  });

  it('should handle invalid PID file content', async () => {
    writeFileSync(join(tempDir, '.phalanx/daemon.pid'), 'not-a-number', 'utf-8');
    expect(await service.isRunning()).toBe(false);
  });

  it('should install without error', async () => {
    await service.install({
      nodePath: process.execPath,
      entryPath: '/tmp/entry.js',
      workDir: tempDir,
      logPath: join(tempDir, 'test.log'),
    });
  });
});
