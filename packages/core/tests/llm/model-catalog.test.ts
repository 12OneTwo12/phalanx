import { describe, it, expect } from 'vitest';
import { MODEL_CATALOG, ModelCatalogRegistry } from '../../src/llm/model-catalog.js';

describe('MODEL_CATALOG', () => {
  it('has entries for all major providers', () => {
    const providers = [...new Set(MODEL_CATALOG.map((e) => e.provider))];
    expect(providers).toContain('anthropic');
    expect(providers).toContain('openai');
    expect(providers).toContain('gemini');
  });

  it('each entry has required fields', () => {
    for (const entry of MODEL_CATALOG) {
      expect(entry.fullId).toBeTruthy();
      expect(entry.id).toBeTruthy();
      expect(entry.name).toBeTruthy();
      expect(entry.provider).toBeTruthy();
      expect(entry.api).toBeTruthy();
      expect(entry.contextWindow).toBeGreaterThan(0);
      expect(entry.maxTokens).toBeGreaterThan(0);
      expect(entry.cost).toBeDefined();
      expect(entry.fullId).toBe(`${entry.provider}/${entry.id}`);
    }
  });

  it('cost values are non-negative', () => {
    for (const entry of MODEL_CATALOG) {
      expect(entry.cost.input).toBeGreaterThanOrEqual(0);
      expect(entry.cost.output).toBeGreaterThanOrEqual(0);
      expect(entry.cost.cacheRead).toBeGreaterThanOrEqual(0);
      expect(entry.cost.cacheWrite).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('ModelCatalogRegistry', () => {
  const registry = new ModelCatalogRegistry();

  it('finds model by provider and id', () => {
    const entry = registry.find('anthropic', 'claude-sonnet-4-5-20250929');
    expect(entry).toBeDefined();
    expect(entry!.name).toBe('Claude Sonnet 4.5');
  });

  it('finds model by fullId', () => {
    const entry = registry.findByFullId('openai/gpt-4o');
    expect(entry).toBeDefined();
    expect(entry!.name).toBe('GPT-4o');
  });

  it('returns undefined for unknown model', () => {
    expect(registry.find('anthropic', 'nonexistent')).toBeUndefined();
    expect(registry.findByFullId('fake/model')).toBeUndefined();
  });

  it('lists models for a provider', () => {
    const anthropicModels = registry.getProviderModels('anthropic');
    expect(anthropicModels.length).toBeGreaterThanOrEqual(3);
    expect(anthropicModels.every((m) => m.provider === 'anthropic')).toBe(true);
  });

  it('returns empty array for unknown provider', () => {
    expect(registry.getProviderModels('nonexistent')).toEqual([]);
  });

  it('returns all entries', () => {
    const all = registry.getAllEntries();
    expect(all.length).toBe(MODEL_CATALOG.length);
  });

  it('registers a new model dynamically', () => {
    const custom = new ModelCatalogRegistry([]);
    custom.register({
      fullId: 'ollama/llama3',
      id: 'llama3',
      name: 'Llama 3',
      provider: 'ollama',
      api: 'ollama-chat',
      reasoning: false,
      input: ['text'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 8_192,
      maxTokens: 4_096,
    });

    expect(custom.findByFullId('ollama/llama3')).toBeDefined();
    expect(custom.getProviderModels('ollama').length).toBe(1);
  });
});
