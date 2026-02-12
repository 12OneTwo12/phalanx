import { describe, it, expect } from 'vitest';
import { WebChannelProvider } from '../../src/channel/providers/web.js';
import { TelegramChannelProvider } from '../../src/channel/providers/telegram.js';
import { DiscordChannelProvider } from '../../src/channel/providers/discord.js';
import { SlackChannelProvider } from '../../src/channel/providers/slack.js';

describe('WebChannelProvider', () => {
  it('has correct id and name', () => {
    const provider = new WebChannelProvider();
    expect(provider.id).toBe('web');
    expect(provider.name).toBe('Web Dashboard');
  });

  it('starts and stops', async () => {
    const provider = new WebChannelProvider();
    await provider.start({ enabled: true });
    expect(provider.isRunning()).toBe(true);
    await provider.stop();
    expect(provider.isRunning()).toBe(false);
  });

  it('sendMessage returns success by default', async () => {
    const provider = new WebChannelProvider();
    await provider.start({ enabled: true });
    const result = await provider.sendMessage({
      channelId: 'dashboard',
      content: 'Hello',
    });
    expect(result.ok).toBe(true);
  });

  it('receiveFromWeb emits inbound message', async () => {
    const provider = new WebChannelProvider();
    await provider.start({ enabled: true });

    const messages: unknown[] = [];
    provider.onMessage(async (msg) => {
      messages.push(msg);
    });

    await provider.receiveFromWeb({
      messageId: 'web-1',
      content: 'Hello from web',
      senderId: 'user-1',
    });

    expect(messages).toHaveLength(1);
    expect((messages[0] as { content: string }).content).toBe('Hello from web');
  });

  it('uses custom outbound handler', async () => {
    const provider = new WebChannelProvider();
    await provider.start({ enabled: true });

    provider.setOutboundHandler(async (ctx) => ({
      ok: true,
      messageId: `custom-${ctx.channelId}`,
    }));

    const result = await provider.sendMessage({
      channelId: 'test-ch',
      content: 'Hi',
    });

    expect(result.ok).toBe(true);
    expect(result.messageId).toBe('custom-test-ch');
  });
});

describe('TelegramChannelProvider', () => {
  it('has correct id and capabilities', () => {
    const provider = new TelegramChannelProvider();
    expect(provider.id).toBe('telegram');
    expect(provider.capabilities.reactions).toBe(true);
    expect(provider.capabilities.threads).toBe(true);
    expect(provider.capabilities.markdown).toBe(true);
  });

  it('throws without bot token', async () => {
    const provider = new TelegramChannelProvider();
    await expect(
      provider.start({ enabled: true, accounts: { default: {} } }),
    ).rejects.toThrow('Bot token is required');
  });
});

describe('DiscordChannelProvider', () => {
  it('has correct id and capabilities', () => {
    const provider = new DiscordChannelProvider();
    expect(provider.id).toBe('discord');
    expect(provider.capabilities.reactions).toBe(true);
    expect(provider.capabilities.buttons).toBe(true);
  });

  it('throws without bot token', async () => {
    const provider = new DiscordChannelProvider();
    await expect(
      provider.start({ enabled: true, accounts: { default: {} } }),
    ).rejects.toThrow('Bot token is required');
  });
});

describe('SlackChannelProvider', () => {
  it('has correct id and capabilities', () => {
    const provider = new SlackChannelProvider();
    expect(provider.id).toBe('slack');
    expect(provider.capabilities.threads).toBe(true);
  });

  it('throws without bot token', async () => {
    const provider = new SlackChannelProvider();
    await expect(
      provider.start({ enabled: true, accounts: { default: {} } }),
    ).rejects.toThrow('Bot token');
  });

  it('throws without app token', async () => {
    const provider = new SlackChannelProvider();
    await expect(
      provider.start({
        enabled: true,
        accounts: { default: { botToken: 'xoxb-test' } },
      }),
    ).rejects.toThrow('App token');
  });
});
