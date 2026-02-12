/**
 * WebChannelProvider — wraps the existing Dashboard web chat as a channel provider.
 *
 * This is a "virtual" provider: it doesn't connect to an external service.
 * Instead, it receives messages from the Dashboard API and emits them
 * as standard InboundMessages. Outbound messages are stored in the DB
 * and pushed to clients via SSE.
 */
import { BaseChannelProvider } from '../provider.js';
import type {
  ChannelCapabilities,
  ChannelProviderConfig,
  OutboundMessageContext,
  SendResult,
} from '../types.js';

export class WebChannelProvider extends BaseChannelProvider {
  readonly id = 'web' as const;
  readonly name = 'Web Dashboard';
  readonly capabilities: ChannelCapabilities = {
    reactions: false,
    threads: false,
    edit: false,
    delete: false,
    buttons: false,
    media: false,
    markdown: true,
  };

  private outboundHandler:
    | ((ctx: OutboundMessageContext) => Promise<SendResult>)
    | null = null;

  async start(_config: ChannelProviderConfig): Promise<void> {
    this.running = true;
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  /**
   * Set external handler for outbound messages (called by Dashboard API layer).
   * The Dashboard API sets this to persist the message and push via SSE.
   */
  setOutboundHandler(
    handler: (ctx: OutboundMessageContext) => Promise<SendResult>,
  ): void {
    this.outboundHandler = handler;
  }

  async sendMessage(ctx: OutboundMessageContext): Promise<SendResult> {
    if (this.outboundHandler) {
      return this.outboundHandler(ctx);
    }
    // Default: just return success (message was generated, caller persists it)
    return { ok: true, messageId: `web-${Date.now()}` };
  }

  /**
   * Called by the Dashboard API when a user sends a message via the web UI.
   * Converts it to an InboundMessage and forwards to the router.
   */
  async receiveFromWeb(params: {
    messageId: string;
    content: string;
    senderId?: string;
    senderName?: string;
  }): Promise<void> {
    await this.emitMessage({
      id: params.messageId,
      provider: 'web',
      channelId: 'dashboard',
      senderId: params.senderId ?? 'web-user',
      senderName: params.senderName ?? 'User',
      content: params.content,
      timestamp: new Date(),
    });
  }
}
