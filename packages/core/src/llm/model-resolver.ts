import type {
  LLMProvider,
  ModelResolutionContext,
  ResolvedModel,
  ProviderHealth,
  ProviderStatus,
  ProviderConfig,
} from './types.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { OpenAIProvider } from './providers/openai.js';
import { OllamaProvider } from './providers/ollama.js';
import { GeminiProvider } from './providers/gemini.js';

// ---------------------------------------------------------------------------
// Parse "provider/model" format
// ---------------------------------------------------------------------------

export function parseModelId(fullId: string): { provider: string; model: string } {
  const slashIndex = fullId.indexOf('/');
  if (slashIndex === -1) {
    throw new Error(`Invalid model ID "${fullId}": expected "provider/model" format`);
  }
  return {
    provider: fullId.slice(0, slashIndex),
    model: fullId.slice(slashIndex + 1),
  };
}

export function formatModelId(provider: string, model: string): string {
  return `${provider}/${model}`;
}

// ---------------------------------------------------------------------------
// Provider registry
// ---------------------------------------------------------------------------

export class ProviderRegistry {
  private providers = new Map<string, LLMProvider>();

  register(provider: LLMProvider): void {
    this.providers.set(provider.name, provider);
  }

  get(name: string): LLMProvider | undefined {
    return this.providers.get(name);
  }

  getAll(): LLMProvider[] {
    return [...this.providers.values()];
  }

  has(name: string): boolean {
    return this.providers.has(name);
  }
}

// ---------------------------------------------------------------------------
// Health tracker (for fallback chain)
// ---------------------------------------------------------------------------

const DEFAULT_COOLDOWN_MS = 60_000; // 1 minute cooldown on failure
const MAX_CONSECUTIVE_FAILURES = 3;

export class ProviderHealthTracker {
  private health = new Map<string, ProviderHealth>();
  private cooldownMs: number;

  constructor(cooldownMs = DEFAULT_COOLDOWN_MS) {
    this.cooldownMs = cooldownMs;
  }

  recordSuccess(providerName: string): void {
    const h = this.getOrCreate(providerName);
    h.status = 'healthy';
    h.lastSuccess = new Date();
    h.consecutiveFailures = 0;
    h.cooldownUntil = undefined;
  }

  recordFailure(providerName: string): void {
    const h = this.getOrCreate(providerName);
    h.lastFailure = new Date();
    h.consecutiveFailures += 1;

    if (h.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      h.status = 'cooldown';
      h.cooldownUntil = new Date(Date.now() + this.cooldownMs);
    } else {
      h.status = 'degraded';
    }
  }

  getStatus(providerName: string): ProviderStatus {
    const h = this.health.get(providerName);
    if (!h) return 'healthy'; // Unknown providers assumed healthy

    // Check if cooldown expired
    if (h.status === 'cooldown' && h.cooldownUntil && h.cooldownUntil <= new Date()) {
      h.status = 'degraded'; // Allow retry after cooldown
      h.cooldownUntil = undefined;
    }

    return h.status;
  }

  isAvailable(providerName: string): boolean {
    const status = this.getStatus(providerName);
    return status !== 'cooldown' && status !== 'unavailable';
  }

  getHealth(providerName: string): ProviderHealth {
    return this.getOrCreate(providerName);
  }

  getAllHealth(): ProviderHealth[] {
    return [...this.health.values()];
  }

  private getOrCreate(providerName: string): ProviderHealth {
    let h = this.health.get(providerName);
    if (!h) {
      h = {
        provider: providerName,
        status: 'healthy',
        consecutiveFailures: 0,
      };
      this.health.set(providerName, h);
    }
    return h;
  }
}

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

// ---------------------------------------------------------------------------
// Factory: create fully configured resolver
// ---------------------------------------------------------------------------

export interface PhalanxLLMConfig {
  providers?: {
    anthropic?: ProviderConfig;
    openai?: ProviderConfig;
    ollama?: ProviderConfig;
    gemini?: ProviderConfig;
  };
  systemDefault?: string;
  cooldownMs?: number;
}

export function createLLMStack(config: PhalanxLLMConfig = {}): {
  registry: ProviderRegistry;
  healthTracker: ProviderHealthTracker;
  resolver: ModelResolver;
} {
  const registry = new ProviderRegistry();
  const healthTracker = new ProviderHealthTracker(config.cooldownMs);

  // Register providers (only if API key is available or it's a local provider)
  const anthropicConfig = config.providers?.anthropic ?? {};
  if (anthropicConfig.apiKey || process.env.ANTHROPIC_API_KEY) {
    registry.register(new AnthropicProvider(anthropicConfig));
  }

  const openaiConfig = config.providers?.openai ?? {};
  if (openaiConfig.apiKey || process.env.OPENAI_API_KEY) {
    registry.register(new OpenAIProvider(openaiConfig));
  }

  // Ollama is always registered (local, might not be running)
  const ollamaConfig = config.providers?.ollama ?? {};
  registry.register(new OllamaProvider(ollamaConfig));

  const geminiConfig = config.providers?.gemini ?? {};
  if (geminiConfig.apiKey || process.env.GEMINI_API_KEY) {
    registry.register(new GeminiProvider(geminiConfig));
  }

  const systemDefault = config.systemDefault ?? 'anthropic/claude-sonnet-4-5-20250929';
  const resolver = new ModelResolver(registry, healthTracker, systemDefault);

  return { registry, healthTracker, resolver };
}
