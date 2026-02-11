import type {
  LLMProvider,
  ModelResolutionContext,
  ResolvedModel,
} from './types.js';
import { parseModelId } from './model-id.js';
import { ProviderRegistry } from './provider-registry.js';
import { ProviderHealthTracker } from './health-tracker.js';

// ---------------------------------------------------------------------------
// 5-step Model Resolver
//
// Priority order:
// 1. Ticket override (specific model for this ticket)
// 2. Agent config (model in agent's config)
// 3. Role default (default model per role)
// 4. Fallback chain (ordered list of fallback models)
// 5. System default (ultimate fallback)
// ---------------------------------------------------------------------------

export class ModelResolver {
  private registry: ProviderRegistry;
  private healthTracker: ProviderHealthTracker;
  private systemDefault: string;

  constructor(
    registry: ProviderRegistry,
    healthTracker: ProviderHealthTracker,
    systemDefault: string,
  ) {
    this.registry = registry;
    this.healthTracker = healthTracker;
    this.systemDefault = systemDefault;
  }

  /**
   * Resolve which model to use based on the 5-step priority pipeline.
   */
  resolve(context: ModelResolutionContext): ResolvedModel {
    // Step 1: Ticket override (highest priority)
    if (context.ticketModel) {
      const resolved = this.tryResolve(context.ticketModel);
      if (resolved) return { ...resolved, resolvedFrom: 'ticket' };
    }

    // Step 2: Agent config
    if (context.agentModel) {
      const resolved = this.tryResolve(context.agentModel);
      if (resolved) return { ...resolved, resolvedFrom: 'agent' };
    }

    // Step 3: Role default
    if (context.roleDefault) {
      const resolved = this.tryResolve(context.roleDefault);
      if (resolved) return { ...resolved, resolvedFrom: 'role' };
    }

    // Step 4: Fallback chain (first available)
    if (context.fallbackChain) {
      for (const modelId of context.fallbackChain) {
        const resolved = this.tryResolve(modelId);
        if (resolved) return { ...resolved, resolvedFrom: 'fallback' };
      }
    }

    // Step 5: System default (always succeeds or throws)
    const systemModel = context.systemDefault || this.systemDefault;
    const resolved = this.tryResolve(systemModel);
    if (resolved) return { ...resolved, resolvedFrom: 'system' };

    throw new Error(
      `No available model found. System default "${systemModel}" is unavailable. ` +
        `Check provider configuration and API keys.`,
    );
  }

  /**
   * Try to resolve a model ID. Returns null if provider is unavailable or in cooldown.
   */
  private tryResolve(fullId: string): Omit<ResolvedModel, 'resolvedFrom'> | null {
    try {
      const { provider, model } = parseModelId(fullId);

      // Check provider exists
      if (!this.registry.has(provider)) return null;

      // Check provider health
      if (!this.healthTracker.isAvailable(provider)) return null;

      return { provider, model, fullId };
    } catch {
      return null;
    }
  }

  /**
   * Get the provider instance for a resolved model.
   */
  getProvider(resolved: ResolvedModel): LLMProvider {
    const provider = this.registry.get(resolved.provider);
    if (!provider) {
      throw new Error(`Provider "${resolved.provider}" not registered`);
    }
    return provider;
  }
}
