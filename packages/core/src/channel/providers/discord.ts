/**
 * DiscordChannelProvider — Discord Bot API integration.
 *
 * Uses Discord Gateway (WebSocket) for receiving messages and
 * REST API for sending. Lightweight implementation without discord.js.
 */
import { BaseChannelProvider } from '../provider.js';
import type {
  ChannelCapabilities,
  ChannelProviderConfig,
  OutboundMessageContext,
  ReactionContext,
  SendResult,
} from '../types.js';

// ---------------------------------------------------------------------------
// Discord API types (minimal subset)
// ---------------------------------------------------------------------------

interface DiscordMessage {
  id: string;
  channel_id: string;
  author: { id: string; username: string; discriminator: string };
  content: string;
  timestamp: string;
  message_reference?: { message_id: string };
  thread?: { id: string };
}

interface DiscordGatewayPayload {
  op: number;
  d: unknown;
  s?: number;
  t?: string;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class DiscordChannelProvider extends BaseChannelProvider {
  readonly id = 'discord' as const;
  readonly name = 'Discord';
  readonly capabilities: ChannelCapabilities = {
    reactions: true,
    threads: true,
    edit: true,
    delete: true,
    buttons: true,
    media: true,
    markdown: true,
  };

  private token: string | null = null;
  private botUserId: string | null = null;
  private ws: WebSocket | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private lastSequence: number | null = null;
  /** Guild IDs to filter events (empty = all guilds). Used in handleMessageCreate. */
  private readonly guildIds: Set<string> = new Set();
  private readonly apiBase = 'https://discord.com/api/v10';

  async start(config: ChannelProviderConfig): Promise<void> {
    const account =
      config.accounts?.['default'] ??
      config.accounts?.[Object.keys(config.accounts)[0]];
    if (!account) {
      throw new Error('[Discord] No account configured');
    }

    this.token = this.resolveToken(account.botToken) ?? null;
    if (!this.token) {
      throw new Error('[Discord] Bot token is required');
    }

    if (account.guildIds?.length) {
      for (const gid of account.guildIds) {
        this.guildIds.add(gid);
      }
    }

    // Verify token and get bot user ID
    const me = await this.apiCall<{ id: string; username: string }>('GET', '/users/@me');
    if (!me) {
      throw new Error('[Discord] Failed to verify bot token');
    }
    this.botUserId = me.id;

    this.running = true;
    await this.connectGateway();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'Shutting down');
      this.ws = null;
    }
  }

  async sendMessage(ctx: OutboundMessageContext): Promise<SendResult> {
    try {
      const body: Record<string, unknown> = { content: ctx.content };

      if (ctx.replyToId) {
        body['message_reference'] = { message_id: ctx.replyToId };
      }

      const result = await this.apiCall<DiscordMessage>(
        'POST',
        `/channels/${ctx.channelId}/messages`,
        body,
      );

      if (result) {
        return { ok: true, messageId: result.id };
      }
      return { ok: false, error: 'Failed to send message' };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  async sendReaction(ctx: ReactionContext): Promise<void> {
    const encoded = encodeURIComponent(ctx.emoji);
    await this.apiCall(
      'PUT',
      `/channels/${ctx.channelId}/messages/${ctx.messageId}/reactions/${encoded}/@me`,
    );
  }

  async editMessage(ctx: {
    channelId: string;
    messageId: string;
    content: string;
  }): Promise<void> {
    await this.apiCall('PATCH', `/channels/${ctx.channelId}/messages/${ctx.messageId}`, {
      content: ctx.content,
    });
  }

  async deleteMessage(messageId: string, channelId: string): Promise<void> {
    await this.apiCall('DELETE', `/channels/${channelId}/messages/${messageId}`);
  }

  // -- Private ---------------------------------------------------------------

  private async connectGateway(): Promise<void> {
    const gateway = await this.apiCall<{ url: string }>('GET', '/gateway/bot');
    if (!gateway?.url) {
      throw new Error('[Discord] Failed to get gateway URL');
    }

    const wsUrl = `${gateway.url}?v=10&encoding=json`;
    this.ws = new WebSocket(wsUrl);

    this.ws.addEventListener('message', (event) => {
      void this.handleGatewayMessage(
        JSON.parse(String(event.data)) as DiscordGatewayPayload,
      );
    });

    this.ws.addEventListener('close', () => {
      if (this.running) {
        console.warn('[Discord] Gateway disconnected, reconnecting...');
        setTimeout(() => void this.connectGateway(), 5000);
      }
    });

    this.ws.addEventListener('error', (err) => {
      console.error('[Discord] WebSocket error:', err);
    });
  }

  private async handleGatewayMessage(payload: DiscordGatewayPayload): Promise<void> {
    if (payload.s !== undefined) {
      this.lastSequence = payload.s;
    }

    switch (payload.op) {
      case 10: {
        // Hello — start heartbeating and identify
        const data = payload.d as { heartbeat_interval: number };
        this.startHeartbeat(data.heartbeat_interval);
        this.identify();
        break;
      }
      case 0: {
        // Dispatch
        if (payload.t === 'MESSAGE_CREATE') {
          await this.handleMessageCreate(payload.d as DiscordMessage);
        }
        break;
      }
    }
  }

  private startHeartbeat(intervalMs: number): void {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      this.ws?.send(JSON.stringify({ op: 1, d: this.lastSequence }));
    }, intervalMs);
  }

  private identify(): void {
    this.ws?.send(
      JSON.stringify({
        op: 2,
        d: {
          token: this.token,
          intents: 1 << 9 | 1 << 15, // GUILD_MESSAGES | MESSAGE_CONTENT
          properties: {
            os: 'linux',
            browser: 'phalanx',
            device: 'phalanx',
          },
        },
      }),
    );
  }

  private async handleMessageCreate(msg: DiscordMessage): Promise<void> {
    // Ignore own messages
    if (msg.author.id === this.botUserId) return;

    // Ignore messages from bots
    if ((msg.author as { bot?: boolean }).bot) return;

    // Guild filtering (if configured)
    if (this.guildIds.size > 0) {
      const guildId = (msg as unknown as { guild_id?: string }).guild_id;
      if (guildId && !this.guildIds.has(guildId)) return;
    }

    await this.emitMessage({
      id: msg.id,
      provider: 'discord',
      channelId: msg.channel_id,
      senderId: msg.author.id,
      senderName: msg.author.username,
      content: msg.content,
      replyToId: msg.message_reference?.message_id,
      threadId: msg.thread?.id,
      timestamp: new Date(msg.timestamp),
    });
  }

  private async apiCall<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T | null> {
    if (!this.token) return null;

    const resp = await fetch(`${this.apiBase}${path}`, {
      method,
      headers: {
        Authorization: `Bot ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error(`[Discord] API error ${method} ${path}: ${resp.status} ${text}`);
      return null;
    }

    if (resp.status === 204) return null;
    return (await resp.json()) as T;
  }
}
