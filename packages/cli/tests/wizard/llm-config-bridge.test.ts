import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { toPhalanxLLMConfig } from '../../src/utils/llm-config-bridge.js';
import type { PhalanxConfig } from '../../src/utils/config-loader.js';
import {
  _setCredentialPaths,
  _resetCredentialPaths,
  saveCredential,
} from '../../src/utils/credential-store.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'phalanx-bridge-test-'));
  _setCredentialPaths(tempDir, join(tempDir, 'credentials.json'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  _resetCredentialPaths();
});

function makeConfig(overrides: Partial<PhalanxConfig['llm']> = {}): PhalanxConfig {
  return {
    projectRoot: '/tmp/test',
    dbPath: '.phalanx/phalanx.db',
    dashboardPort: 3000,
    logPath: '.phalanx/phalanx.log',
    llm: {
      systemDefault: 'anthropic/claude-sonnet-4-5-20250929',
      providers: {},
      ...overrides,
    },
    daemon: { autoStart: false },
  };
}

describe('llm-config-bridge', () => {
  it('converts empty providers', () => {
    const result = toPhalanxLLMConfig(makeConfig());
    expect(result).toEqual({
      systemDefault: 'anthropic/claude-sonnet-4-5-20250929',
      providers: {},
    });
  });

  it('filters out disabled providers', () => {
    const config = makeConfig({
      providers: {
        anthropic: { enabled: true },
        openai: { enabled: false },
      },
    });
    const result = toPhalanxLLMConfig(config);
    expect(Object.keys(result.providers)).toEqual(['anthropic']);
  });

  it('passes through baseUrl for Ollama', () => {
    const config = makeConfig({
      providers: {
        ollama: { enabled: true, baseUrl: 'http://localhost:11434', authMode: 'none' },
      },
    });
    const result = toPhalanxLLMConfig(config);
    expect(result.providers.ollama.baseUrl).toBe('http://localhost:11434');
    expect(result.providers.ollama.auth).toBe('none');
  });

  it('passes through defaultModel', () => {
    const config = makeConfig({
      providers: {
        openai: { enabled: true, defaultModel: 'gpt-4o' },
      },
    });
    const result = toPhalanxLLMConfig(config);
    expect(result.providers.openai.defaultModel).toBe('gpt-4o');
  });

  it('uses systemDefault from config', () => {
    const config = makeConfig({ systemDefault: 'openai/gpt-4o' });
    const result = toPhalanxLLMConfig(config);
    expect(result.systemDefault).toBe('openai/gpt-4o');
  });

  // --- New auth-related tests ---

  it('sets auth mode from LLMProviderEntry.authMode', () => {
    const config = makeConfig({
      providers: {
        anthropic: { enabled: true, authMode: 'token' },
      },
    });
    const result = toPhalanxLLMConfig(config);
    expect(result.providers.anthropic.auth).toBe('token');
  });

  it('defaults authMode to api-key when not set', () => {
    const config = makeConfig({
      providers: {
        openai: { enabled: true },
      },
    });
    const result = toPhalanxLLMConfig(config);
    expect(result.providers.openai.auth).toBe('api-key');
  });

  it('injects stored credential as apiKey', () => {
    saveCredential('anthropic', { secret: 'sk-stored-token', authMode: 'token' });
    const config = makeConfig({
      providers: {
        anthropic: { enabled: true, authMode: 'token' },
      },
    });
    const result = toPhalanxLLMConfig(config);
    expect(result.providers.anthropic.apiKey).toBe('sk-stored-token');
  });

  it('does not inject credential for auth mode none', () => {
    saveCredential('ollama', { secret: 'should-not-appear', authMode: 'none' });
    const config = makeConfig({
      providers: {
        ollama: { enabled: true, authMode: 'none', baseUrl: 'http://localhost:11434' },
      },
    });
    const result = toPhalanxLLMConfig(config);
    expect(result.providers.ollama.apiKey).toBeUndefined();
  });

  it('leaves apiKey undefined when no stored credential exists', () => {
    const config = makeConfig({
      providers: {
        gemini: { enabled: true, authMode: 'api-key' },
      },
    });
    const result = toPhalanxLLMConfig(config);
    expect(result.providers.gemini.apiKey).toBeUndefined();
    expect(result.providers.gemini.auth).toBe('api-key');
  });
});
