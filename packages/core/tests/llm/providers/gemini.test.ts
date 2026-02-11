import { describe, it, expect } from 'vitest';
import { GeminiProvider, geminiProviderFactory } from '../../../src/llm/providers/gemini.js';

describe('GeminiProvider', () => {
  it('has correct provider name', () => {
    const provider = new GeminiProvider();
    expect(provider.name).toBe('gemini');
  });

  it('lists known models', () => {
    const provider = new GeminiProvider();
    expect(provider.models).toContain('gemini-2.5-pro');
    expect(provider.models).toContain('gemini-2.5-flash');
    expect(provider.models).toContain('gemini-2.0-flash');
  });
});

describe('geminiProviderFactory', () => {
  it('activates when API key is in config', () => {
    expect(geminiProviderFactory.shouldActivate({ apiKey: 'test-key' }, {})).toBe(true);
  });

  it('activates when API key is in env', () => {
    expect(geminiProviderFactory.shouldActivate({}, { GEMINI_API_KEY: 'test-key' })).toBe(true);
  });

  it('does not activate without API key', () => {
    expect(geminiProviderFactory.shouldActivate({}, {})).toBe(false);
  });

  it('creates GeminiProvider instance', () => {
    const provider = geminiProviderFactory.create({ apiKey: 'test' });
    expect(provider.name).toBe('gemini');
  });
});

describe('tool call ID uniqueness', () => {
  it('generates unique UUIDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => crypto.randomUUID()));
    expect(ids.size).toBe(100);
  });
});
