import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  getChannelMessageRepository: vi.fn(() => ({
    create: vi.fn((data: Record<string, unknown>) => ({
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    findAll: vi.fn(() => []),
  })),
}));

vi.mock('@/lib/event-bus', () => ({
  eventBus: { emit: vi.fn() },
}));

vi.mock('@/lib/llm-provider', () => ({
  getLLMProvider: vi.fn(() => null),
}));

vi.mock('@/lib/team-lead-agent', () => ({
  createTeamLeadAgent: vi.fn(() => ({
    run: vi.fn().mockResolvedValue({
      status: 'completed',
      finalContent: 'test response',
      conversationHistory: [],
      iterations: 1,
      toolCallCount: 0,
      totalUsage: { inputTokens: 10, outputTokens: 20 },
    }),
  })),
}));

vi.mock('@/lib/channel-config', () => ({
  loadChannelsConfig: vi.fn(() => ({
    web: { enabled: true },
  })),
}));

describe('channel-wiring', () => {
  beforeEach(() => {
    globalThis.__phalanx_channels__ = undefined;
  });

  afterEach(() => {
    globalThis.__phalanx_channels__ = undefined;
  });

  it('creates channel state with registry, router, and web provider', async () => {
    const { getChannelState } = await import('../channel-wiring');
    const state = getChannelState();

    expect(state.registry).toBeDefined();
    expect(state.router).toBeDefined();
    expect(state.webProvider).toBeDefined();
    expect(state.started).toBe(false);
  });

  it('registers all four providers', async () => {
    const { getChannelRegistry } = await import('../channel-wiring');
    const registry = getChannelRegistry();

    expect(registry.has('web')).toBe(true);
    expect(registry.has('telegram')).toBe(true);
    expect(registry.has('discord')).toBe(true);
    expect(registry.has('slack')).toBe(true);
    expect(registry.getAll()).toHaveLength(4);
  });

  it('starts channels with config', async () => {
    const { startChannels, isChannelSystemRunning, getChannelRegistry } = await import('../channel-wiring');

    await startChannels();

    expect(isChannelSystemRunning()).toBe(true);
    // Only web should be running (others disabled in config)
    const status = getChannelRegistry().getStatus();
    const webStatus = status.find((s) => s.id === 'web');
    expect(webStatus?.running).toBe(true);
  });

  it('startChannels is idempotent', async () => {
    const { startChannels, isChannelSystemRunning } = await import('../channel-wiring');

    await startChannels();
    await startChannels(); // should not throw

    expect(isChannelSystemRunning()).toBe(true);
  });

  it('stops channels gracefully', async () => {
    const { startChannels, stopChannels, isChannelSystemRunning } = await import('../channel-wiring');

    await startChannels();
    expect(isChannelSystemRunning()).toBe(true);

    await stopChannels();
    expect(isChannelSystemRunning()).toBe(false);
  });

  it('getStatus returns provider info', async () => {
    const { getChannelRegistry } = await import('../channel-wiring');
    const status = getChannelRegistry().getStatus();

    expect(status).toHaveLength(4);
    expect(status.map((s) => s.id).sort()).toEqual(['discord', 'slack', 'telegram', 'web']);
  });
});
