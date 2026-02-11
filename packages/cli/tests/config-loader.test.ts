import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initConfig, loadConfig, findProjectRoot } from '../src/utils/config-loader.js';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('config-loader', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'phalanx-config-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('initConfig', () => {
    it('should create .phalanx directory and config file', () => {
      const config = initConfig(tempDir);

      expect(existsSync(join(tempDir, '.phalanx'))).toBe(true);
      expect(existsSync(join(tempDir, '.phalanx/config.json'))).toBe(true);
      expect(config.projectRoot).toBe(tempDir);
      expect(config.dashboardPort).toBe(3000);
    });
  });

  describe('loadConfig', () => {
    it('should return null when no .phalanx exists', () => {
      const config = loadConfig(tempDir);
      expect(config).toBeNull();
    });

    it('should load config after init', () => {
      initConfig(tempDir);
      const config = loadConfig(tempDir);
      expect(config).not.toBeNull();
      expect(config!.projectRoot).toBe(tempDir);
    });
  });

  describe('findProjectRoot', () => {
    it('should return null when no .phalanx exists anywhere', () => {
      const result = findProjectRoot(tempDir);
      expect(result).toBeNull();
    });

    it('should find project root with .phalanx dir', () => {
      initConfig(tempDir);
      const result = findProjectRoot(tempDir);
      expect(result).toBe(tempDir);
    });
  });
});
