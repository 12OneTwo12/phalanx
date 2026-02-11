import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { parseModelId, formatModelId } from '../../src/llm/model-id.js';
import { ProviderRegistry } from '../../src/llm/provider-registry.js';
import { ProviderHealthTracker } from '../../src/llm/health-tracker.js';
import { ModelResolver } from '../../src/llm/model-resolver.js';
import type { LLMProvider, ModelResolutionContext } from '../../src/llm/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stubProvider(name: string): LLMProvider {
  return {
    name,
    models: [],
    chat: async () => ({ content: '', stopReason: 'end_turn', usage: { inputTokens: 0, outputTokens: 0 }, model: '' }),
    chatWithTools: async () => ({ content: '', toolCalls: [], stopReason: 'end_turn', usage: { inputTokens: 0, outputTokens: 0 }, model: '' }),
    isAvailable: async () => true,
  };
}

// ---------------------------------------------------------------------------
// parseModelId / formatModelId
// ---------------------------------------------------------------------------

describe('parseModelId', () => {
  it('splits provider/model correctly', () => {
    expect(parseModelId('anthropic/claude-sonnet-4-5')).toEqual({
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
    });
  });

  it('handles models with multiple slashes', () => {
    const result = parseModelId('ollama/meta/llama3');
    expect(result.provider).toBe('ollama');
    expect(result.model).toBe('meta/llama3');
  });

  it('throws on missing slash', () => {
    expect(() => parseModelId('gpt-4o')).toThrow('expected "provider/model" format');
  });
});

describe('formatModelId', () => {
  it('joins provider and model', () => {
    expect(formatModelId('openai', 'gpt-4o')).toBe('openai/gpt-4o');
  });
});

// ---------------------------------------------------------------------------
// ProviderRegistry
// ---------------------------------------------------------------------------

describe('ProviderRegistry', () => {
  it('registers and retrieves providers', () => {
    const registry = new ProviderRegistry();
    registry.register(stubProvider('anthropic'));

    expect(registry.has('anthropic')).toBe(true);
    expect(registry.get('anthropic')?.name).toBe('anthropic');
    expect(registry.has('openai')).toBe(false);
  });

  it('lists all providers', () => {
    const registry = new ProviderRegistry();
    registry.register(stubProvider('anthropic'));
    registry.register(stubProvider('openai'));

    expect(registry.getAll().length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// ProviderHealthTracker
// ---------------------------------------------------------------------------

describe('ProviderHealthTracker', () => {
  let tracker: ProviderHealthTracker;

  beforeEach(() => {
    tracker = new ProviderHealthTracker(100); // 100ms cooldown for fast tests
  });

  it('defaults to healthy for unknown providers', () => {
    expect(tracker.getStatus('unknown')).toBe('healthy');
    expect(tracker.isAvailable('unknown')).toBe(true);
  });

  it('records success and stays healthy', () => {
    tracker.recordSuccess('anthropic');
    expect(tracker.getStatus('anthropic')).toBe('healthy');
  });

  it('becomes degraded after a single failure', () => {
    tracker.recordFailure('anthropic');
    expect(tracker.getStatus('anthropic')).toBe('degraded');
    expect(tracker.isAvailable('anthropic')).toBe(true);
  });

  it('enters cooldown after 3 consecutive failures', () => {
    tracker.recordFailure('anthropic');
    tracker.recordFailure('anthropic');
    tracker.recordFailure('anthropic');
    expect(tracker.getStatus('anthropic')).toBe('cooldown');
    expect(tracker.isAvailable('anthropic')).toBe(false);
  });

  it('resets consecutive failures on success', () => {
    tracker.recordFailure('anthropic');
    tracker.recordFailure('anthropic');
    tracker.recordSuccess('anthropic');
    expect(tracker.getStatus('anthropic')).toBe('healthy');
    expect(tracker.getHealth('anthropic').consecutiveFailures).toBe(0);
  });

  it('recovers from cooldown after timeout', () => {
    vi.useFakeTimers();

    tracker.recordFailure('anthropic');
    tracker.recordFailure('anthropic');
    tracker.recordFailure('anthropic');
    expect(tracker.isAvailable('anthropic')).toBe(false);

    vi.advanceTimersByTime(150);
    expect(tracker.getStatus('anthropic')).toBe('degraded');
    expect(tracker.isAvailable('anthropic')).toBe(true);

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// ModelResolver (5-step pipeline)
// ---------------------------------------------------------------------------

describe('ModelResolver', () => {
  let registry: ProviderRegistry;
  let healthTracker: ProviderHealthTracker;
  let resolver: ModelResolver;

  beforeEach(() => {
    registry = new ProviderRegistry();
    registry.register(stubProvider('anthropic'));
    registry.register(stubProvider('openai'));
    healthTracker = new ProviderHealthTracker();
    resolver = new ModelResolver(registry, healthTracker, 'anthropic/claude-sonnet-4-5-20250929');
  });

  it('step 1: resolves ticket override first', () => {
    const ctx: ModelResolutionContext = {
      ticketModel: 'openai/gpt-4o',
      agentModel: 'anthropic/claude-opus-4-6-20250414',
      systemDefault: 'anthropic/claude-sonnet-4-5-20250929',
    };
    const result = resolver.resolve(ctx);
    expect(result.resolvedFrom).toBe('ticket');
    expect(result.fullId).toBe('openai/gpt-4o');
  });

  it('step 2: falls to agent model when no ticket', () => {
    const ctx: ModelResolutionContext = {
      agentModel: 'anthropic/claude-opus-4-6-20250414',
      systemDefault: 'anthropic/claude-sonnet-4-5-20250929',
    };
    const result = resolver.resolve(ctx);
    expect(result.resolvedFrom).toBe('agent');
    expect(result.fullId).toBe('anthropic/claude-opus-4-6-20250414');
  });

  it('step 3: falls to role default', () => {
    const ctx: ModelResolutionContext = {
      roleDefault: 'openai/gpt-4o',
      systemDefault: 'anthropic/claude-sonnet-4-5-20250929',
    };
    const result = resolver.resolve(ctx);
    expect(result.resolvedFrom).toBe('role');
    expect(result.fullId).toBe('openai/gpt-4o');
  });

  it('step 4: falls to fallback chain', () => {
    const ctx: ModelResolutionContext = {
      fallbackChain: ['openai/gpt-4o', 'anthropic/claude-sonnet-4-5-20250929'],
      systemDefault: 'anthropic/claude-sonnet-4-5-20250929',
    };
    const result = resolver.resolve(ctx);
    expect(result.resolvedFrom).toBe('fallback');
    expect(result.fullId).toBe('openai/gpt-4o');
  });

  it('step 5: falls to system default', () => {
    const ctx: ModelResolutionContext = {
      systemDefault: 'anthropic/claude-sonnet-4-5-20250929',
    };
    const result = resolver.resolve(ctx);
    expect(result.resolvedFrom).toBe('system');
    expect(result.fullId).toBe('anthropic/claude-sonnet-4-5-20250929');
  });

  it('skips unavailable providers in fallback chain', () => {
    // Put openai in cooldown
    healthTracker.recordFailure('openai');
    healthTracker.recordFailure('openai');
    healthTracker.recordFailure('openai');

    const ctx: ModelResolutionContext = {
      fallbackChain: ['openai/gpt-4o', 'anthropic/claude-sonnet-4-5-20250929'],
      systemDefault: 'anthropic/claude-sonnet-4-5-20250929',
    };
    const result = resolver.resolve(ctx);
    expect(result.fullId).toBe('anthropic/claude-sonnet-4-5-20250929');
  });

  it('skips unregistered providers', () => {
    const ctx: ModelResolutionContext = {
      ticketModel: 'fake/nonexistent',
      systemDefault: 'anthropic/claude-sonnet-4-5-20250929',
    };
    const result = resolver.resolve(ctx);
    expect(result.resolvedFrom).toBe('system');
  });

  it('throws when all models unavailable', () => {
    healthTracker.recordFailure('anthropic');
    healthTracker.recordFailure('anthropic');
    healthTracker.recordFailure('anthropic');
    healthTracker.recordFailure('openai');
    healthTracker.recordFailure('openai');
    healthTracker.recordFailure('openai');

    const ctx: ModelResolutionContext = {
      systemDefault: 'anthropic/claude-sonnet-4-5-20250929',
    };
    expect(() => resolver.resolve(ctx)).toThrow('No available model found');
  });

  it('getProvider returns the LLM provider instance', () => {
    const ctx: ModelResolutionContext = {
      systemDefault: 'anthropic/claude-sonnet-4-5-20250929',
    };
    const resolved = resolver.resolve(ctx);
    const provider = resolver.getProvider(resolved);
    expect(provider.name).toBe('anthropic');
  });

  it('getProvider throws for unregistered provider', () => {
    expect(() =>
      resolver.getProvider({ provider: 'fake', model: 'x', fullId: 'fake/x', resolvedFrom: 'system' }),
    ).toThrow('not registered');
  });
});
