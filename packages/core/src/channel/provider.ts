/**
 * ChannelProvider interface — the contract every messenger integration must implement.
 *
 * Inspired by a plugin-based architecture where each messenger is an independent
 * module that registers itself with the central registry.
 */
import type {
  ChannelCapabilities,
  ChannelProviderConfig,
  ChannelProviderId,
  EditMessageContext,
  InboundMessage,
  InboundMessageHandler,
  OutboundMessageContext,
  ReactionContext,
  SendResult,
} from './types.js';

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

export interface ChannelProvider {
  /** Unique provider identifier (e.g. 'telegram', 'discord') */
  readonly id: ChannelProviderId;

  /** Human-readable display name */
  readonly name: string;

  /** What this provider supports */
  readonly capabilities: ChannelCapabilities;

  // -- Lifecycle ------------------------------------------------------------

  /**
   * Start the provider (connect to APIs, start polling/websocket, etc.).
   * Called once during gateway startup.
   */
  start(config: ChannelProviderConfig): Promise<void>;

  /**
   * Gracefully stop the provider.
   */
  stop(): Promise<void>;

  /** Whether the provider is currently running and connected. */
  isRunning(): boolean;

  // -- Inbound --------------------------------------------------------------

  /**
   * Register a handler for incoming messages.
   * The registry calls this to wire inbound messages to the router.
   */
  onMessage(handler: InboundMessageHandler): void;

  // -- Outbound -------------------------------------------------------------

  /**
   * Send a message to a channel/chat.
   */
  sendMessage(ctx: OutboundMessageContext): Promise<SendResult>;

  // -- Optional capabilities ------------------------------------------------

  /** Add a reaction to a message (if capabilities.reactions). */
  sendReaction?(ctx: ReactionContext): Promise<void>;

  /** Edit a previously sent message (if capabilities.edit). */
  editMessage?(ctx: EditMessageContext): Promise<void>;

  /** Delete a previously sent message (if capabilities.delete). */
  deleteMessage?(messageId: string, channelId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Base class with common boilerplate
// ---------------------------------------------------------------------------

export abstract class BaseChannelProvider implements ChannelProvider {
  abstract readonly id: ChannelProviderId;
  abstract readonly name: string;
  abstract readonly capabilities: ChannelCapabilities;

  protected running = false;
  protected messageHandler: InboundMessageHandler | null = null;

  abstract start(config: ChannelProviderConfig): Promise<void>;
  abstract stop(): Promise<void>;
  abstract sendMessage(ctx: OutboundMessageContext): Promise<SendResult>;

  isRunning(): boolean {
    return this.running;
  }

  onMessage(handler: InboundMessageHandler): void {
    this.messageHandler = handler;
  }

  /** Emit an inbound message to the registered handler. */
  protected async emitMessage(message: InboundMessage): Promise<void> {
    if (this.messageHandler) {
      await this.messageHandler(message);
    }
  }

  /**
   * Resolve a token value, supporting "env:VAR_NAME" syntax
   * for environment variable resolution.
   */
  protected resolveToken(value: string | undefined): string | undefined {
    if (!value) return undefined;
    if (value.startsWith('env:')) {
      const envVar = value.slice(4);
      return process.env[envVar];
    }
    return value;
  }
}
