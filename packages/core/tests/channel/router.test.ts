import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChannelRegistry } from '../../src/channel/registry.js';
import { ChannelRouter } from '../../src/channel/router.js';
import { BaseChannelProvider } from '../../src/channel/provider.js';
import type {
  ChannelCapabilities,
  ChannelProviderConfig,
  InboundMessage,
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
    reactions: false, threads: false, edit: false,
    delete: false, buttons: false, media: false, markdown: false,
  };

  sentMessages: OutboundMessageContext[] = [];

  async start(_config: ChannelProviderConfig): Promise<void> {
    this.running = true;
  }
  async stop(): Promise<void> {
    this.running = false;
  }
  async sendMessage(ctx: OutboundMessageContext): Promise<SendResult> {
    this.sentMessages.push(ctx);
    return { ok: true, messageId: 'reply-1' };
  }

  /** Simulate an inbound message. */
  async simulateInbound(msg: InboundMessage): Promise<void> {
    await this.emitMessage(msg);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChannelRouter', () => {
  let registry: ChannelRegistry;
  let router: ChannelRouter;
  let provider: MockProvider;

  beforeEach(async () => {
    registry = new ChannelRegistry();
    router = new ChannelRouter(registry);
    provider = new MockProvider();

    registry.register(provider);
    router.init();
    await provider.start({ enabled: true });
  });

  it('routes inbound message to response generator and sends reply', async () => {
    router.setResponseGenerator(async () => 'Hello back!');

    await provider.simulateInbound({
      id: 'msg-1',
      provider: 'mock',
      channelId: 'ch-1',
      senderId: 'user-1',
      content: 'Hello',
      timestamp: new Date(),
    });

    // Wait for async processing
    await new Promise((r) => setTimeout(r, 50));

    expect(provider.sentMessages).toHaveLength(1);
    expect(provider.sentMessages[0].content).toBe('Hello back!');
    expect(provider.sentMessages[0].channelId).toBe('ch-1');
    expect(provider.sentMessages[0].replyToId).toBe('msg-1');
  });

  it('does not send when generator returns null', async () => {
    router.setResponseGenerator(async () => null);

    await provider.simulateInbound({
      id: 'msg-2',
      provider: 'mock',
      channelId: 'ch-1',
      senderId: 'user-1',
      content: 'Ignored',
      timestamp: new Date(),
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(provider.sentMessages).toHaveLength(0);
  });

  it('calls before/after response hooks', async () => {
    const beforeFn = vi.fn();
    const afterFn = vi.fn();

    router.setResponseGenerator(async () => 'response');
    router.setBeforeResponse(beforeFn);
    router.setAfterResponse(afterFn);

    await provider.simulateInbound({
      id: 'msg-3',
      provider: 'mock',
      channelId: 'ch-1',
      senderId: 'user-1',
      content: 'test',
      timestamp: new Date(),
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(beforeFn).toHaveBeenCalledOnce();
    expect(afterFn).toHaveBeenCalledOnce();
    expect(beforeFn.mock.calls[0][1]).toBe('response');
  });

  it('send returns error for unknown provider', async () => {
    const result = await router.send('nonexistent', {
      channelId: 'ch-1',
      content: 'test',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('not found');
  });
});
