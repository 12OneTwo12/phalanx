import { describe, it, expect } from 'vitest';
import { createLLMStack, BUILT_IN_PROVIDER_FACTORIES } from '../../src/llm/llm-stack.js';
import type { LLMProvider, ProviderFactory } from '../../src/llm/types.js';

// ---------------------------------------------------------------------------
// createLLMStack integration tests
// ---------------------------------------------------------------------------

describe('createLLMStack', () => {
  it('registers providers whose API keys are present in env', () => {
    const { registry } = createLLMStack({
      env: { ANTHROPIC_API_KEY: 'test-key' },
    });

    expect(registry.has('anthropic')).toBe(true);
    expect(registry.has('openai')).toBe(false);
    expect(registry.has('gemini')).toBe(false);
    expect(registry.has('ollama')).toBe(false);
  });

  it('does not register any provider when no keys are set', () => {
    const { registry } = createLLMStack({ env: {} });

    expect(registry.getAll()).toHaveLength(0);
  });

  it('registers multiple providers when multiple keys exist', () => {
    // env is now passed to both shouldActivate and create — no duplication needed
    const { registry } = createLLMStack({
      env: {
        ANTHROPIC_API_KEY: 'ak',
        OPENAI_API_KEY: 'ok',
        GEMINI_API_KEY: 'gk',
      },
    });

    expect(registry.has('anthropic')).toBe(true);
    expect(registry.has('openai')).toBe(true);
    expect(registry.has('gemini')).toBe(true);
  });

  it('registers additional custom factories', () => {
    const customProvider: LLMProvider = {
      name: 'custom',
      models: ['custom-model'],
      chat: async () => ({ content: '', stopReason: 'end_turn', usage: { inputTokens: 0, outputTokens: 0 }, model: '' }),
      chatWithTools: async () => ({ content: '', toolCalls: [], stopReason: 'end_turn', usage: { inputTokens: 0, outputTokens: 0 }, model: '' }),
      isAvailable: async () => true,
    };

    const customFactory: ProviderFactory = {
      name: 'custom',
      shouldActivate: () => true,
      create: (_config, _env) => customProvider,
    };

    const { registry } = createLLMStack({
      env: {},
      additionalFactories: [customFactory],
    });

    expect(registry.has('custom')).toBe(true);
    expect(registry.getAll()).toHaveLength(1);
  });

  it('passes provider-specific config to factory', () => {
    const { registry } = createLLMStack({
      providers: {
        anthropic: { apiKey: 'direct-key', timeout: 5000 },
      },
      env: {},
    });

    // Provider should be registered via config.apiKey
    expect(registry.has('anthropic')).toBe(true);
  });

  it('uses custom system default model', () => {
    const { resolver } = createLLMStack({
      env: { ANTHROPIC_API_KEY: 'test' },
      systemDefault: 'anthropic/claude-opus-4-20250514',
    });

    const resolved = resolver.resolve({
      systemDefault: 'anthropic/claude-opus-4-20250514',
    });
    expect(resolved.fullId).toBe('anthropic/claude-opus-4-20250514');
  });

  it('Ollama registers when OLLAMA_BASE_URL is set', () => {
    const { registry } = createLLMStack({
      env: { OLLAMA_BASE_URL: 'http://localhost:11434' },
    });

    expect(registry.has('ollama')).toBe(true);
  });
});

describe('BUILT_IN_PROVIDER_FACTORIES', () => {
  it('contains all 4 built-in providers', () => {
    const names = BUILT_IN_PROVIDER_FACTORIES.map((f) => f.name);
    expect(names).toEqual(['anthropic', 'openai', 'ollama', 'gemini']);
  });
});
