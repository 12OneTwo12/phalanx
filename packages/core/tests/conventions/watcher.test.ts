import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ConventionWatcher } from '../../src/conventions/watcher.js';

describe('ConventionWatcher', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phalanx-watch-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should start and stop without error', async () => {
    const watcher = new ConventionWatcher({ watchDir: tmpDir, debounceMs: 50 });
    expect(watcher.isWatching).toBe(false);
    await watcher.start();
    expect(watcher.isWatching).toBe(true);
    await watcher.stop();
    expect(watcher.isWatching).toBe(false);
  });

  it('should not start twice', async () => {
    const watcher = new ConventionWatcher({ watchDir: tmpDir });
    await watcher.start();
    await watcher.start(); // No-op
    expect(watcher.isWatching).toBe(true);
    await watcher.stop();
  });

  it('should stop gracefully when not started', async () => {
    const watcher = new ConventionWatcher({ watchDir: tmpDir });
    await watcher.stop(); // Should not throw
    expect(watcher.isWatching).toBe(false);
  });

  it('should accept custom patterns', async () => {
    const watcher = new ConventionWatcher({
      watchDir: tmpDir,
      patterns: ['*.json'],
      debounceMs: 50,
    });
    await watcher.start();
    expect(watcher.isWatching).toBe(true);
    await watcher.stop();
  });
});
