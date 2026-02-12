// Core channel abstraction
export type {
  ChannelProviderId,
  ChannelCapabilities,
  InboundMessage,
  OutboundMessageContext,
  SendResult,
  ReactionContext,
  EditMessageContext,
  ChannelProviderConfig,
  ChannelAccountConfig,
  ChannelsConfig,
  InboundMessageHandler,
} from './types.js';

export type { ChannelProvider } from './provider.js';
export { BaseChannelProvider } from './provider.js';
export { ChannelRegistry } from './registry.js';
export { ChannelRouter } from './router.js';
export type { ResponseCallback, ResponseGenerator } from './router.js';

// Providers
export {
  WebChannelProvider,
  TelegramChannelProvider,
  DiscordChannelProvider,
  SlackChannelProvider,
} from './providers/index.js';

// Legacy — Team Lead chat service
export {
  TeamLeadChatService,
  type ChatMessage,
  type ProjectContext,
  type TeamLeadChatConfig,
} from './team-lead-chat.js';
