import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { syncConventionToDisk, syncAllConventionsToDisk } from '../convention-sync';

describe('convention-sync', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = resolve(tmpdir(), `phalanx-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('syncConventionToDisk', () => {
    it('writes conventions type to CONVENTIONS.md', () => {
      const path = syncConventionToDisk('conventions', '# My Conventions', testDir);
      expect(path).toBe(resolve(testDir, '.phalanx', 'CONVENTIONS.md'));
      expect(readFileSync(path!, 'utf-8')).toBe('# My Conventions');
    });

    it('writes architecture type to ARCHITECTURE.md', () => {
      const path = syncConventionToDisk('architecture', '# Arch', testDir);
      expect(path).toBe(resolve(testDir, '.phalanx', 'ARCHITECTURE.md'));
    });

    it('writes style type to STYLE.md', () => {
      const path = syncConventionToDisk('style', '# Style Guide', testDir);
      expect(path).toBe(resolve(testDir, '.phalanx', 'STYLE.md'));
    });

    it('returns null for unknown type', () => {
      expect(syncConventionToDisk('unknown', 'content', testDir)).toBeNull();
    });

    it('creates .phalanx directory if missing', () => {
      const phalanxDir = resolve(testDir, '.phalanx');
      expect(existsSync(phalanxDir)).toBe(false);
      syncConventionToDisk('conventions', 'test', testDir);
      expect(existsSync(phalanxDir)).toBe(true);
    });

    it('overwrites existing file', () => {
      syncConventionToDisk('conventions', 'v1', testDir);
      syncConventionToDisk('conventions', 'v2', testDir);
      const path = resolve(testDir, '.phalanx', 'CONVENTIONS.md');
      expect(readFileSync(path, 'utf-8')).toBe('v2');
    });
  });

  describe('syncAllConventionsToDisk', () => {
    it('syncs multiple conventions', () => {
      const written = syncAllConventionsToDisk([
        { type: 'conventions', content: '# Conv' },
        { type: 'style', content: '# Style' },
      ], testDir);
      expect(written).toHaveLength(2);
      expect(existsSync(resolve(testDir, '.phalanx', 'CONVENTIONS.md'))).toBe(true);
      expect(existsSync(resolve(testDir, '.phalanx', 'STYLE.md'))).toBe(true);
    });

    it('skips unknown types', () => {
      const written = syncAllConventionsToDisk([
        { type: 'conventions', content: '# Conv' },
        { type: 'unknown', content: 'skip' },
      ], testDir);
      expect(written).toHaveLength(1);
    });
  });
});
