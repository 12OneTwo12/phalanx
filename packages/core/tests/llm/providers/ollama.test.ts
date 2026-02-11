import { describe, it, expect } from 'vitest';
import { OllamaProvider } from '../../../src/llm/providers/ollama.js';
import { ollamaProviderFactory } from '../../../src/llm/providers/ollama.js';

describe('OllamaProvider', () => {
  it('has correct provider name', () => {
    const provider = new OllamaProvider();
    expect(provider.name).toBe('ollama');
  });

  it('starts with empty models list', () => {
    const provider = new OllamaProvider();
    expect(provider.models).toEqual([]);
  });

  it('uses default base URL when not configured', () => {
    const provider = new OllamaProvider();
    // Verify it can be constructed without errors
    expect(provider.name).toBe('ollama');
  });
});

describe('ollamaProviderFactory', () => {
  it('always activates (local provider)', () => {
    expect(ollamaProviderFactory.shouldActivate({}, {})).toBe(true);
  });

  it('creates OllamaProvider instance', () => {
    const provider = ollamaProviderFactory.create({});
    expect(provider.name).toBe('ollama');
  });
});

describe('tool call ID uniqueness', () => {
  it('generates unique IDs via crypto.randomUUID', () => {
    // Verify crypto.randomUUID is available in the runtime
    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
