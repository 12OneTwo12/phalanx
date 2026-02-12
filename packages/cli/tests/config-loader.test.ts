import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initConfig, loadConfig, saveConfig, findProjectRoot, DEFAULT_MODEL } from '../src/utils/config-loader.js';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
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

    it('should include default llm and daemon settings', () => {
      const config = initConfig(tempDir);

      expect(config.llm).toEqual({
        systemDefault: DEFAULT_MODEL,
        providers: {},
      });
      expect(config.daemon).toEqual({ autoStart: false });
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

    it('should load llm and daemon fields', () => {
      initConfig(tempDir);
      const config = loadConfig(tempDir)!;
      expect(config.llm.systemDefault).toBe(DEFAULT_MODEL);
      expect(config.llm.providers).toEqual({});
      expect(config.daemon.autoStart).toBe(false);
    });

    it('should default missing llm/daemon fields gracefully', () => {
      // Write a config without llm/daemon (simulating old config)
      const configDir = join(tempDir, '.phalanx');
      const { mkdirSync, writeFileSync } = require('node:fs');
      mkdirSync(configDir, { recursive: true });
      writeFileSync(join(configDir, 'config.json'), JSON.stringify({ dbPath: '.phalanx/test.db' }));

      const config = loadConfig(tempDir)!;
      expect(config.dbPath).toBe('.phalanx/test.db');
      expect(config.llm.systemDefault).toBe(DEFAULT_MODEL);
      expect(config.daemon.autoStart).toBe(false);
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

  describe('saveConfig', () => {
    it('should persist llm providers and daemon settings', () => {
      const config = initConfig(tempDir);
      config.llm.providers = {
        anthropic: { enabled: true },
        ollama: { enabled: true, baseUrl: 'http://localhost:11434' },
      };
      config.llm.systemDefault = 'openai/gpt-4o';
      config.daemon.autoStart = true;

      saveConfig(config);

      const raw = readFileSync(join(tempDir, '.phalanx/config.json'), 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed.llm.systemDefault).toBe('openai/gpt-4o');
      expect(parsed.llm.providers.anthropic.enabled).toBe(true);
      expect(parsed.llm.providers.ollama.baseUrl).toBe('http://localhost:11434');
      expect(parsed.daemon.autoStart).toBe(true);
    });

    it('should not persist projectRoot', () => {
      const config = initConfig(tempDir);
      saveConfig(config);

      const raw = readFileSync(join(tempDir, '.phalanx/config.json'), 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed.projectRoot).toBeUndefined();
    });
  });
});
