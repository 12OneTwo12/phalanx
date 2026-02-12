/**
 * SlackChannelProvider — Slack Socket Mode integration.
 *
 * Uses Slack's Socket Mode (WebSocket) for receiving events and
 * Web API for sending messages. No heavy Bolt framework dependency.
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
// Slack API types (minimal subset)
// ---------------------------------------------------------------------------

interface SlackMessage {
  type: string;
  subtype?: string;
  user?: string;
  text: string;
  ts: string;
  channel: string;
  thread_ts?: string;
  reply_broadcast?: boolean;
}

interface SlackSocketEvent {
  type: string;
  envelope_id?: string;
  payload?: {
    event?: SlackMessage & { type: string };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface SlackApiResponse {
  ok: boolean;
  error?: string;
  ts?: string;
  channel?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class SlackChannelProvider extends BaseChannelProvider {
  readonly id = 'slack' as const;
  readonly name = 'Slack';
  readonly capabilities: ChannelCapabilities = {
    reactions: true,
    threads: true,
    edit: true,
    delete: true,
    buttons: true,
    media: true,
    markdown: true, // Slack uses mrkdwn, close enough
  };

  private botToken: string | null = null;
  private appToken: string | null = null;
  private botUserId: string | null = null;
  private ws: WebSocket | null = null;
  private readonly apiBase = 'https://slack.com/api';

  async start(config: ChannelProviderConfig): Promise<void> {
    const account =
      config.accounts?.['default'] ??
      config.accounts?.[Object.keys(config.accounts)[0]];
    if (!account) {
      throw new Error('[Slack] No account configured');
    }

    this.botToken = this.resolveToken(account.botToken) ?? null;
    this.appToken = this.resolveToken(account.appToken) ?? null;

    if (!this.botToken) {
      throw new Error('[Slack] Bot token (xoxb-) is required');
    }
    if (!this.appToken) {
      throw new Error('[Slack] App token (xapp-) is required for Socket Mode');
    }

    // Verify bot token and get bot user ID
    const auth = await this.webApi<{ user_id: string; user: string }>(
      'auth.test',
      {},
    );
    if (!auth?.user_id) {
      throw new Error('[Slack] Failed to verify bot token');
    }
    this.botUserId = auth.user_id;

    this.running = true;
    await this.connectSocketMode();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.ws) {
      this.ws.close(1000, 'Shutting down');
      this.ws = null;
    }
  }

  async sendMessage(ctx: OutboundMessageContext): Promise<SendResult> {
    try {
      const params: Record<string, string> = {
        channel: ctx.channelId,
        text: ctx.content,
      };

      if (ctx.threadId) {
        params['thread_ts'] = ctx.threadId;
      }

      const result = await this.webApi<{ ts: string; channel: string }>(
        'chat.postMessage',
        params,
      );

      if (result?.ts) {
        return { ok: true, messageId: result.ts };
      }
      return { ok: false, error: 'Failed to send message' };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  async sendReaction(ctx: ReactionContext): Promise<void> {
    await this.webApi('reactions.add', {
      channel: ctx.channelId,
      timestamp: ctx.messageId,
      name: ctx.emoji.replace(/:/g, ''),
    });
  }

  async editMessage(ctx: {
    channelId: string;
    messageId: string;
    content: string;
  }): Promise<void> {
    await this.webApi('chat.update', {
      channel: ctx.channelId,
      ts: ctx.messageId,
      text: ctx.content,
    });
  }

  async deleteMessage(messageId: string, channelId: string): Promise<void> {
    await this.webApi('chat.delete', {
      channel: channelId,
      ts: messageId,
    });
  }

  // -- Private ---------------------------------------------------------------

  private async connectSocketMode(): Promise<void> {
    // Open a WebSocket connection via apps.connections.open
    const resp = await fetch(`${this.apiBase}/apps.connections.open`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.appToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = (await resp.json()) as SlackApiResponse & { url?: string };
    if (!data.ok || !data.url) {
      throw new Error(`[Slack] Failed to open socket: ${data.error ?? 'no url'}`);
    }

    this.ws = new WebSocket(data.url);

    this.ws.addEventListener('message', (event) => {
      void this.handleSocketEvent(
        JSON.parse(String(event.data)) as SlackSocketEvent,
      );
    });

    this.ws.addEventListener('close', () => {
      if (this.running) {
        console.warn('[Slack] Socket disconnected, reconnecting...');
        setTimeout(() => void this.connectSocketMode(), 5000);
      }
    });

    this.ws.addEventListener('error', (err) => {
      console.error('[Slack] WebSocket error:', err);
    });
  }

  private async handleSocketEvent(event: SlackSocketEvent): Promise<void> {
    // Acknowledge the envelope
    if (event.envelope_id) {
      this.ws?.send(JSON.stringify({ envelope_id: event.envelope_id }));
    }

    if (event.type !== 'events_api' || !event.payload?.event) return;

    const msg = event.payload.event;
    if (msg.type !== 'message') return;
    if (msg.subtype) return; // Ignore bot messages, edits, etc.
    if (msg.user === this.botUserId) return;

    // Resolve sender name (best effort)
    let senderName: string | undefined;
    try {
      const info = await this.webApi<{ user: { real_name: string } }>(
        'users.info',
        { user: msg.user ?? '' },
      );
      senderName = info?.user?.real_name;
    } catch {
      // Ignore name resolution failures
    }

    await this.emitMessage({
      id: msg.ts,
      provider: 'slack',
      channelId: msg.channel,
      senderId: msg.user ?? 'unknown',
      senderName,
      content: msg.text,
      threadId: msg.thread_ts,
      timestamp: new Date(Number(msg.ts.split('.')[0]) * 1000),
    });
  }

  private async webApi<T>(
    method: string,
    params: Record<string, string>,
  ): Promise<T | null> {
    if (!this.botToken) return null;

    const resp = await fetch(`${this.apiBase}/${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.botToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(params),
    });

    const data = (await resp.json()) as SlackApiResponse & T;
    if (!data.ok) {
      console.error(`[Slack] API error on ${method}: ${data.error}`);
      return null;
    }
    return data as T;
  }
}
