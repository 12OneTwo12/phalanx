/**
 * TelegramChannelProvider — Telegram Bot API integration.
 *
 * Supports long-polling mode for message reception.
 * Uses the Telegram Bot API directly via fetch (no heavy deps).
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
// Telegram API types (minimal subset)
// ---------------------------------------------------------------------------

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
}

interface TelegramMessage {
  message_id: number;
  from?: { id: number; first_name: string; last_name?: string; username?: string };
  chat: { id: number; type: string; title?: string };
  text?: string;
  reply_to_message?: TelegramMessage;
  message_thread_id?: number;
  date: number;
}

interface TelegramApiResponse<T = unknown> {
  ok: boolean;
  result?: T;
  description?: string;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class TelegramChannelProvider extends BaseChannelProvider {
  readonly id = 'telegram' as const;
  readonly name = 'Telegram';
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
  private baseUrl = 'https://api.telegram.org';
  private pollOffset = 0;
  private pollAbort: AbortController | null = null;
  private allowFrom: Set<string> = new Set();

  async start(config: ChannelProviderConfig): Promise<void> {
    const account = config.accounts?.['default'] ?? config.accounts?.[Object.keys(config.accounts)[0]];
    if (!account) {
      throw new Error('[Telegram] No account configured');
    }

    this.token = this.resolveToken(account.botToken) ?? null;
    if (!this.token) {
      throw new Error('[Telegram] Bot token is required');
    }

    if (account.allowFrom?.length) {
      this.allowFrom = new Set(account.allowFrom.map(String));
    }

    // Verify bot token
    const me = await this.apiCall<{ id: number; first_name: string }>('getMe');
    if (!me) {
      throw new Error('[Telegram] Failed to verify bot token');
    }

    this.running = true;
    this.startPolling();
  }

  async stop(): Promise<void> {
    this.running = false;
    this.pollAbort?.abort();
    this.pollAbort = null;
  }

  async sendMessage(ctx: OutboundMessageContext): Promise<SendResult> {
    try {
      const params: Record<string, unknown> = {
        chat_id: ctx.channelId,
        text: ctx.content,
        parse_mode: 'Markdown',
      };

      if (ctx.replyToId) {
        params['reply_parameters'] = { message_id: Number(ctx.replyToId) };
      }

      if (ctx.threadId) {
        params['message_thread_id'] = Number(ctx.threadId);
      }

      const result = await this.apiCall<TelegramMessage>('sendMessage', params);
      if (result) {
        return { ok: true, messageId: String(result.message_id) };
      }
      return { ok: false, error: 'Failed to send message' };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  async sendReaction(ctx: ReactionContext): Promise<void> {
    await this.apiCall('setMessageReaction', {
      chat_id: ctx.channelId,
      message_id: Number(ctx.messageId),
      reaction: [{ type: 'emoji', emoji: ctx.emoji }],
    });
  }

  async editMessage(ctx: { channelId: string; messageId: string; content: string }): Promise<void> {
    await this.apiCall('editMessageText', {
      chat_id: ctx.channelId,
      message_id: Number(ctx.messageId),
      text: ctx.content,
      parse_mode: 'Markdown',
    });
  }

  async deleteMessage(messageId: string, channelId: string): Promise<void> {
    await this.apiCall('deleteMessage', {
      chat_id: channelId,
      message_id: Number(messageId),
    });
  }

  // -- Private ---------------------------------------------------------------

  private startPolling(): void {
    const poll = async () => {
      this.pollAbort = new AbortController();

      while (this.running) {
        try {
          const updates = await this.apiCall<TelegramUpdate[]>('getUpdates', {
            offset: this.pollOffset,
            timeout: 30,
            allowed_updates: ['message', 'edited_message'],
          }, this.pollAbort.signal);

          if (!updates?.length) continue;

          for (const update of updates) {
            this.pollOffset = update.update_id + 1;
            const msg = update.message ?? update.edited_message;
            if (!msg?.text) continue;

            // Access control
            if (this.allowFrom.size > 0 && msg.from) {
              const senderId = String(msg.from.id);
              const username = msg.from.username;
              if (!this.allowFrom.has(senderId) && (!username || !this.allowFrom.has(username))) {
                continue;
              }
            }

            const senderName = msg.from
              ? [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ')
              : undefined;

            await this.emitMessage({
              id: String(msg.message_id),
              provider: 'telegram',
              channelId: String(msg.chat.id),
              senderId: msg.from ? String(msg.from.id) : 'unknown',
              senderName,
              content: msg.text,
              replyToId: msg.reply_to_message
                ? String(msg.reply_to_message.message_id)
                : undefined,
              threadId: msg.message_thread_id
                ? String(msg.message_thread_id)
                : undefined,
              timestamp: new Date(msg.date * 1000),
            });
          }
        } catch (err) {
          if (this.running) {
            console.error('[Telegram] Polling error:', err);
            // Back off on error
            await new Promise((r) => setTimeout(r, 5000));
          }
        }
      }
    };

    // Fire and forget
    void poll();
  }

  private async apiCall<T>(
    method: string,
    params?: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<T | null> {
    if (!this.token) return null;

    const url = `${this.baseUrl}/bot${this.token}/${method}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: params ? JSON.stringify(params) : undefined,
      signal,
    });

    const data = (await resp.json()) as TelegramApiResponse<T>;
    if (!data.ok) {
      console.error(`[Telegram] API error on ${method}: ${data.description}`);
      return null;
    }
    return data.result ?? null;
  }
}
