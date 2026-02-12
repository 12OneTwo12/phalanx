/**
 * Unified channel messaging types.
 *
 * Provides a provider-agnostic abstraction for multi-messenger integration.
 * Each messenger (Telegram, Discord, Slack, Web) normalizes its messages
 * into these common types.
 */

// ---------------------------------------------------------------------------
// Channel identifiers
// ---------------------------------------------------------------------------

/** Supported channel provider IDs. Extensible via string literal union. */
export type ChannelProviderId = 'web' | 'telegram' | 'discord' | 'slack' | (string & {});

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

export interface ChannelCapabilities {
  /** Supports emoji reactions on messages */
  reactions: boolean;
  /** Supports threaded replies */
  threads: boolean;
  /** Supports editing sent messages */
  edit: boolean;
  /** Supports deleting sent messages */
  delete: boolean;
  /** Supports inline buttons / interactive components */
  buttons: boolean;
  /** Supports media attachments (images, files) */
  media: boolean;
  /** Supports markdown formatting */
  markdown: boolean;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/** A normalized inbound message from any channel provider. */
export interface InboundMessage {
  /** Unique message ID from the provider */
  id: string;
  /** Which provider this came from */
  provider: ChannelProviderId;
  /** Provider-specific channel/chat ID */
  channelId: string;
  /** Sender ID in the provider's system */
  senderId: string;
  /** Human-readable sender name */
  senderName?: string;
  /** Message text content */
  content: string;
  /** Reply-to message ID (if threaded) */
  replyToId?: string;
  /** Thread ID for threaded conversations */
  threadId?: string;
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
  /** When the message was created */
  timestamp: Date;
}

/** Context for sending an outbound message. */
export interface OutboundMessageContext {
  /** Target channel/chat ID */
  channelId: string;
  /** Message text */
  content: string;
  /** Reply to a specific message */
  replyToId?: string;
  /** Thread ID */
  threadId?: string;
  /** Account ID (for multi-account providers) */
  accountId?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/** Result of sending a message. */
export interface SendResult {
  /** Whether the send succeeded */
  ok: boolean;
  /** Provider's message ID for the sent message */
  messageId?: string;
  /** Error message if failed */
  error?: string;
}

/** Context for adding a reaction. */
export interface ReactionContext {
  channelId: string;
  messageId: string;
  emoji: string;
  accountId?: string;
}

/** Context for editing a message. */
export interface EditMessageContext {
  channelId: string;
  messageId: string;
  content: string;
  accountId?: string;
}

// ---------------------------------------------------------------------------
// Provider configuration
// ---------------------------------------------------------------------------

/** Base config shared by all providers. */
export interface ChannelProviderConfig {
  enabled: boolean;
  accounts?: Record<string, ChannelAccountConfig>;
}

/** Per-account config. Fields vary by provider. */
export interface ChannelAccountConfig {
  /** Bot token (supports "env:VAR_NAME" for env-based resolution) */
  botToken?: string;
  /** App-level token (Slack Socket Mode) */
  appToken?: string;
  /** Allowed sender IDs (empty = allow all) */
  allowFrom?: string[];
  /** Connection mode */
  mode?: 'polling' | 'webhook' | 'socket';
  /** Webhook URL for webhook mode */
  webhookUrl?: string;
  /** Guild/server IDs (Discord) */
  guildIds?: string[];
  /** Additional provider-specific options */
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Channels config section (for .phalanx/config.json)
// ---------------------------------------------------------------------------

export interface ChannelsConfig {
  [providerId: string]: ChannelProviderConfig;
}

// ---------------------------------------------------------------------------
// Inbound message handler
// ---------------------------------------------------------------------------

/** Handler called when a message is received from any channel. */
export type InboundMessageHandler = (message: InboundMessage) => Promise<void>;
