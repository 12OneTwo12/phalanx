import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChannelRegistry } from '../../src/channel/registry.js';
import { BaseChannelProvider } from '../../src/channel/provider.js';
import type {
  ChannelCapabilities,
  ChannelProviderConfig,
  OutboundMessageContext,
  SendResult,
} from '../../src/channel/types.js';

// ---------------------------------------------------------------------------
// Mock provider
// ---------------------------------------------------------------------------

class MockProvider extends BaseChannelProvider {
  readonly id = 'mock';
  readonly name = 'Mock';
  readonly capabilities: ChannelCapabilities = {
    reactions: false,
    threads: false,
    edit: false,
    delete: false,
    buttons: false,
    media: false,
    markdown: false,
  };

  startCalled = false;
  stopCalled = false;

  async start(_config: ChannelProviderConfig): Promise<void> {
    this.startCalled = true;
    this.running = true;
  }

  async stop(): Promise<void> {
    this.stopCalled = true;
    this.running = false;
  }

  async sendMessage(_ctx: OutboundMessageContext): Promise<SendResult> {
    return { ok: true, messageId: 'mock-1' };
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChannelRegistry', () => {
  let registry: ChannelRegistry;

  beforeEach(() => {
    registry = new ChannelRegistry();
  });

  it('registers and retrieves a provider', () => {
    const provider = new MockProvider();
    registry.register(provider);

    expect(registry.has('mock')).toBe(true);
    expect(registry.get('mock')).toBe(provider);
    expect(registry.getIds()).toEqual(['mock']);
  });

  it('throws on duplicate registration', () => {
    registry.register(new MockProvider());
    expect(() => registry.register(new MockProvider())).toThrow(
      'already registered',
    );
  });

  it('unregisters a provider', () => {
    registry.register(new MockProvider());
    expect(registry.unregister('mock')).toBe(true);
    expect(registry.has('mock')).toBe(false);
  });

  it('startAll starts only enabled providers', async () => {
    const p1 = new MockProvider();
    const p2 = new MockProvider();
    // Hack: give p2 a different ID
    Object.defineProperty(p2, 'id', { value: 'mock2' });

    registry.register(p1);
    registry.register(p2);

    await registry.startAll({
      mock: { enabled: true },
      mock2: { enabled: false },
    });

    expect(p1.startCalled).toBe(true);
    expect(p2.startCalled).toBe(false);
  });

  it('stopAll stops running providers', async () => {
    const provider = new MockProvider();
    registry.register(provider);

    await registry.startAll({ mock: { enabled: true } });
    expect(provider.isRunning()).toBe(true);

    await registry.stopAll();
    expect(provider.stopCalled).toBe(true);
  });

  it('setMessageHandler wires to all providers', () => {
    const provider = new MockProvider();
    registry.register(provider);

    const handler = vi.fn();
    registry.setMessageHandler(handler);

    expect(provider['messageHandler']).toBe(handler);
  });

  it('getStatus returns all provider statuses', async () => {
    const provider = new MockProvider();
    registry.register(provider);

    await registry.startAll({ mock: { enabled: true } });

    const statuses = registry.getStatus();
    expect(statuses).toEqual([
      { id: 'mock', name: 'Mock', running: true },
    ]);
  });
});
