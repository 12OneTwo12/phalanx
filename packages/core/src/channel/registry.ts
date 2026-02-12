/**
 * ChannelRegistry — central registry for channel providers.
 *
 * Manages provider registration, lifecycle (start/stop), and lookup.
 * New messenger integrations register themselves here at startup.
 */
import type { ChannelProvider } from './provider.js';
import type {
  ChannelProviderId,
  ChannelsConfig,
  InboundMessageHandler,
} from './types.js';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export class ChannelRegistry {
  private readonly providers = new Map<ChannelProviderId, ChannelProvider>();
  private messageHandler: InboundMessageHandler | null = null;

  /**
   * Register a channel provider.
   * Throws if a provider with the same ID is already registered.
   */
  register(provider: ChannelProvider): void {
    if (this.providers.has(provider.id)) {
      throw new Error(`Channel provider "${provider.id}" is already registered`);
    }
    this.providers.set(provider.id, provider);

    // Wire inbound messages if a handler is already set
    if (this.messageHandler) {
      provider.onMessage(this.messageHandler);
    }
  }

  /**
   * Unregister a provider by ID.
   */
  unregister(id: ChannelProviderId): boolean {
    return this.providers.delete(id);
  }

  /**
   * Get a provider by ID.
   */
  get(id: ChannelProviderId): ChannelProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Get all registered providers.
   */
  getAll(): ChannelProvider[] {
    return [...this.providers.values()];
  }

  /**
   * Get all registered provider IDs.
   */
  getIds(): ChannelProviderId[] {
    return [...this.providers.keys()];
  }

  /**
   * Check if a provider is registered.
   */
  has(id: ChannelProviderId): boolean {
    return this.providers.has(id);
  }

  /**
   * Set the global inbound message handler.
   * All registered (and future) providers will forward messages here.
   */
  setMessageHandler(handler: InboundMessageHandler): void {
    this.messageHandler = handler;
    for (const provider of this.providers.values()) {
      provider.onMessage(handler);
    }
  }

  /**
   * Start all enabled providers based on config.
   * Providers not in config or marked disabled are skipped.
   */
  async startAll(config: ChannelsConfig): Promise<void> {
    const startPromises: Promise<void>[] = [];

    for (const [id, provider] of this.providers) {
      const providerConfig = config[id];
      if (!providerConfig?.enabled) continue;

      startPromises.push(
        provider.start(providerConfig).catch((err) => {
          console.error(`[ChannelRegistry] Failed to start provider "${id}":`, err);
        }),
      );
    }

    await Promise.all(startPromises);
  }

  /**
   * Stop all running providers.
   */
  async stopAll(): Promise<void> {
    const stopPromises: Promise<void>[] = [];

    for (const provider of this.providers.values()) {
      if (provider.isRunning()) {
        stopPromises.push(
          provider.stop().catch((err) => {
            console.error(`[ChannelRegistry] Failed to stop provider "${provider.id}":`, err);
          }),
        );
      }
    }

    await Promise.all(stopPromises);
  }

  /**
   * Get status of all providers.
   */
  getStatus(): Array<{ id: string; name: string; running: boolean }> {
    return this.getAll().map((p) => ({
      id: p.id,
      name: p.name,
      running: p.isRunning(),
    }));
  }
}
