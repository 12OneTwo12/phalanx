import { describe, it, expect } from 'vitest';
import {
  resolveAnthropicThinking,
  resolveOpenAIThinking,
  supportsThinking,
  effectiveThinkingLevel,
} from '../../src/llm/thinking-level.js';

describe('resolveAnthropicThinking', () => {
  it('returns disabled when level is off', () => {
    expect(resolveAnthropicThinking('off')).toEqual({ type: 'disabled' });
  });

  it('returns enabled with budget for low', () => {
    const config = resolveAnthropicThinking('low');
    expect(config.type).toBe('enabled');
    expect(config.budgetTokens).toBe(4_096);
  });

  it('returns enabled with budget for medium', () => {
    const config = resolveAnthropicThinking('medium');
    expect(config.type).toBe('enabled');
    expect(config.budgetTokens).toBe(16_384);
  });

  it('returns enabled with budget for high', () => {
    const config = resolveAnthropicThinking('high');
    expect(config.type).toBe('enabled');
    expect(config.budgetTokens).toBe(32_768);
  });
});

describe('resolveOpenAIThinking', () => {
  it('maps off to none', () => {
    expect(resolveOpenAIThinking('off')).toEqual({ reasoningEffort: 'none' });
  });

  it('maps low/medium/high directly', () => {
    expect(resolveOpenAIThinking('low').reasoningEffort).toBe('low');
    expect(resolveOpenAIThinking('medium').reasoningEffort).toBe('medium');
    expect(resolveOpenAIThinking('high').reasoningEffort).toBe('high');
  });
});

describe('supportsThinking', () => {
  it('returns true for exact thinking-capable models', () => {
    expect(supportsThinking('o3')).toBe(true);
    expect(supportsThinking('o3-mini')).toBe(true);
    expect(supportsThinking('o4-mini')).toBe(true);
  });

  it('returns true for prefix matches', () => {
    expect(supportsThinking('claude-opus-4-20250514')).toBe(true);
    expect(supportsThinking('claude-sonnet-4-5-20250929')).toBe(true);
  });

  it('returns false for non-thinking models', () => {
    expect(supportsThinking('gpt-4o')).toBe(false);
    expect(supportsThinking('gpt-4o-mini')).toBe(false);
    expect(supportsThinking('gemini-2.5-pro')).toBe(false);
  });
});

describe('effectiveThinkingLevel', () => {
  it('returns off when requested is undefined', () => {
    expect(effectiveThinkingLevel(undefined, 'claude-opus-4-20250514')).toBe('off');
  });

  it('returns off when requested is off', () => {
    expect(effectiveThinkingLevel('off', 'claude-opus-4-20250514')).toBe('off');
  });

  it('returns requested level for thinking-capable model', () => {
    expect(effectiveThinkingLevel('high', 'claude-opus-4-20250514')).toBe('high');
    expect(effectiveThinkingLevel('medium', 'o3')).toBe('medium');
  });

  it('degrades to off for non-thinking model', () => {
    expect(effectiveThinkingLevel('high', 'gpt-4o')).toBe('off');
    expect(effectiveThinkingLevel('medium', 'gpt-4o-mini')).toBe('off');
  });
});
