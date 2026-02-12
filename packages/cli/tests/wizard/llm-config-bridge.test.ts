import { describe, it, expect } from 'vitest';
import { toPhalanxLLMConfig } from '../../src/utils/llm-config-bridge.js';
import type { PhalanxConfig } from '../../src/utils/config-loader.js';

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
        ollama: { enabled: true, baseUrl: 'http://localhost:11434' },
      },
    });
    const result = toPhalanxLLMConfig(config);
    expect(result.providers.ollama).toEqual({ baseUrl: 'http://localhost:11434' });
  });

  it('passes through defaultModel', () => {
    const config = makeConfig({
      providers: {
        openai: { enabled: true, defaultModel: 'gpt-4o' },
      },
    });
    const result = toPhalanxLLMConfig(config);
    expect(result.providers.openai).toEqual({ defaultModel: 'gpt-4o' });
  });

  it('uses systemDefault from config', () => {
    const config = makeConfig({ systemDefault: 'openai/gpt-4o' });
    const result = toPhalanxLLMConfig(config);
    expect(result.systemDefault).toBe('openai/gpt-4o');
  });
});
