/**
 * Channel system wiring for the Dashboard.
 *
 * Instantiates the ChannelRegistry + ChannelRouter, registers all providers,
 * and bridges the router's ResponseGenerator to the TeamLeadChatService.
 *
 * Uses globalThis to survive Next.js hot-module reloads in development.
 */
import {
  ChannelRegistry,
  ChannelRouter,
  WebChannelProvider,
  TelegramChannelProvider,
  DiscordChannelProvider,
  SlackChannelProvider,
  type InboundMessage,
  type OutboundMessageContext,
  type SendResult,
} from '@phalanx/core';
import { getChannelMessageRepository } from './db';
import { eventBus } from './event-bus';
import { createTeamLeadAgent } from './team-lead-agent';
import { getLLMProvider } from './llm-provider';
import { loadChannelsConfig } from './channel-config';

// ---------------------------------------------------------------------------
// globalThis guard for HMR
// ---------------------------------------------------------------------------

interface ChannelState {
  registry: ChannelRegistry;
  router: ChannelRouter;
  webProvider: WebChannelProvider;
  started: boolean;
}

declare global {
  // biome-ignore: globalThis requires var
  var __phalanx_channels__: ChannelState | undefined;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function newId(): string {
  return crypto.randomUUID();
}

function createChannelState(): ChannelState {
  const registry = new ChannelRegistry();
  const router = new ChannelRouter(registry);

  // Register providers
  const webProvider = new WebChannelProvider();
  registry.register(webProvider);
  registry.register(new TelegramChannelProvider());
  registry.register(new DiscordChannelProvider());
  registry.register(new SlackChannelProvider());

  // Wire the outbound handler for web provider: persist + SSE
  webProvider.setOutboundHandler(async (ctx: OutboundMessageContext): Promise<SendResult> => {
    try {
      const repo = getChannelMessageRepository();
      const msg = repo.create({
        id: newId(),
        role: 'team-lead',
        content: ctx.content,
      });
      eventBus.emit('channel:message', { messageId: msg.id, role: msg.role });
      return { ok: true, messageId: msg.id };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // Wire the response generator: uses TeamLeadChatService via createTeamLeadAgent
  router.setResponseGenerator(async (message: InboundMessage): Promise<string | null> => {
    const llm = getLLMProvider();
    if (!llm) {
      return 'LLM provider is not configured. Run `phalanx init` to set up a provider.';
    }

    try {
      // Load recent history from DB for context
      const repo = getChannelMessageRepository();
      const history = repo.findAll({ limit: 50, offset: 0 });
      const chatHistory = history.map((m: { role: string; content: string }) => ({
        role: m.role === 'user' ? ('user' as const) : ('team-lead' as const),
        content: m.content,
      }));

      // Add the current inbound message
      chatHistory.push({ role: 'user', content: message.content });

      const agent = createTeamLeadAgent(llm.provider, llm.model);
      const result = await agent.run(chatHistory);
      return result.finalContent;
    } catch (err) {
      console.error('[channel-wiring] Response generation failed:', err);
      return `Failed to generate response: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
  });

  // Wire before-response hook: persist user message for non-web providers
  router.setBeforeResponse(async (inbound: InboundMessage, _response: string) => {
    if (inbound.provider === 'web') return; // Web messages are already persisted by the API route

    try {
      const repo = getChannelMessageRepository();
      repo.create({
        id: newId(),
        role: 'user',
        content: inbound.content,
        metadata: JSON.stringify({
          provider: inbound.provider,
          channelId: inbound.channelId,
          senderId: inbound.senderId,
          senderName: inbound.senderName,
        }),
      });
    } catch (err) {
      console.error('[channel-wiring] Failed to persist inbound message:', err);
    }
  });

  // Initialize the router (wires it as the inbound handler on the registry)
  router.init();

  return { registry, router, webProvider, started: false };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get (or create) the channel system singleton.
 */
export function getChannelState(): ChannelState {
  if (!globalThis.__phalanx_channels__) {
    globalThis.__phalanx_channels__ = createChannelState();
  }
  return globalThis.__phalanx_channels__;
}

/** Get the ChannelRegistry. */
export function getChannelRegistry(): ChannelRegistry {
  return getChannelState().registry;
}

/** Get the ChannelRouter. */
export function getChannelRouter(): ChannelRouter {
  return getChannelState().router;
}

/** Get the WebChannelProvider instance. */
export function getWebProvider(): WebChannelProvider {
  return getChannelState().webProvider;
}

/**
 * Start all channel providers based on config.
 * Idempotent — calling multiple times is safe.
 */
export async function startChannels(): Promise<void> {
  const state = getChannelState();
  if (state.started) return;

  const config = loadChannelsConfig();
  await state.registry.startAll(config);
  state.started = true;

  const running = state.registry.getStatus().filter((s) => s.running);
  console.log(
    `[phalanx] Channel system started — ${running.length} provider(s) active: ${running.map((s) => s.id).join(', ')}`,
  );
}

/**
 * Stop all channel providers. For graceful shutdown.
 */
export async function stopChannels(): Promise<void> {
  const state = globalThis.__phalanx_channels__;
  if (!state?.started) return;

  await state.registry.stopAll();
  state.started = false;
  console.log('[phalanx] Channel system stopped.');
}

/** Whether the channel system has been started. */
export function isChannelSystemRunning(): boolean {
  return globalThis.__phalanx_channels__?.started ?? false;
}
