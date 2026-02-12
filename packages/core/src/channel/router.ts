/**
 * ChannelRouter — routes inbound messages to the TeamLeadChatService
 * and sends responses back through the originating provider.
 *
 * Acts as the bridge between channel providers and the core AI logic.
 */
import type { ChannelRegistry } from './registry.js';
import type { InboundMessage, OutboundMessageContext, SendResult } from './types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Callback invoked after a response is generated. */
export type ResponseCallback = (
  inbound: InboundMessage,
  response: string,
) => Promise<void>;

/** Function that generates a response for an inbound message. */
export type ResponseGenerator = (
  message: InboundMessage,
) => Promise<string | null>;

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export class ChannelRouter {
  private responseGenerator: ResponseGenerator | null = null;
  private beforeResponse: ResponseCallback | null = null;
  private afterResponse: ResponseCallback | null = null;

  constructor(private readonly registry: ChannelRegistry) {}

  /**
   * Initialize the router — wires itself as the inbound message handler
   * on the registry.
   */
  init(): void {
    this.registry.setMessageHandler(this.handleInbound.bind(this));
  }

  /**
   * Set the function that generates responses (typically wraps TeamLeadChatService).
   */
  setResponseGenerator(generator: ResponseGenerator): void {
    this.responseGenerator = generator;
  }

  /**
   * Hook called before sending the response (e.g. to persist messages to DB).
   */
  setBeforeResponse(callback: ResponseCallback): void {
    this.beforeResponse = callback;
  }

  /**
   * Hook called after the response is sent (e.g. for logging).
   */
  setAfterResponse(callback: ResponseCallback): void {
    this.afterResponse = callback;
  }

  /**
   * Send a message through a specific provider.
   */
  async send(
    providerId: string,
    ctx: OutboundMessageContext,
  ): Promise<SendResult> {
    const provider = this.registry.get(providerId);
    if (!provider) {
      return { ok: false, error: `Provider "${providerId}" not found` };
    }
    if (!provider.isRunning()) {
      return { ok: false, error: `Provider "${providerId}" is not running` };
    }
    return provider.sendMessage(ctx);
  }

  // -- Private ---------------------------------------------------------------

  private async handleInbound(message: InboundMessage): Promise<void> {
    if (!this.responseGenerator) {
      console.warn('[ChannelRouter] No response generator set, ignoring message');
      return;
    }

    try {
      const response = await this.responseGenerator(message);
      if (!response) return;

      // Before-send hook
      if (this.beforeResponse) {
        await this.beforeResponse(message, response);
      }

      // Send response through the originating provider
      const result = await this.send(message.provider, {
        channelId: message.channelId,
        content: response,
        replyToId: message.id,
        threadId: message.threadId,
      });

      if (!result.ok) {
        console.error(
          `[ChannelRouter] Failed to send response via "${message.provider}":`,
          result.error,
        );
      }

      // After-send hook
      if (this.afterResponse) {
        await this.afterResponse(message, response);
      }
    } catch (err) {
      console.error('[ChannelRouter] Error handling inbound message:', err);
    }
  }
}
