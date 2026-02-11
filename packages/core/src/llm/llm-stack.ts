import type { ProviderConfig, ProviderFactory } from './types.js';
import { ProviderRegistry } from './provider-registry.js';
import { ProviderHealthTracker } from './health-tracker.js';
import { ModelResolver } from './model-resolver.js';
import { anthropicProviderFactory } from './providers/anthropic.js';
import { openaiProviderFactory } from './providers/openai.js';
import { ollamaProviderFactory } from './providers/ollama.js';
import { geminiProviderFactory } from './providers/gemini.js';

// ---------------------------------------------------------------------------
// Built-in provider factories
// ---------------------------------------------------------------------------

export const BUILT_IN_PROVIDER_FACTORIES: ProviderFactory[] = [
  anthropicProviderFactory,
  openaiProviderFactory,
  ollamaProviderFactory,
  geminiProviderFactory,
];

// ---------------------------------------------------------------------------
// Factory: create fully configured resolver
// ---------------------------------------------------------------------------

export interface PhalanxLLMConfig {
  /** Per-provider configuration, keyed by provider name */
  providers?: Record<string, ProviderConfig>;
  /** System-wide default model (provider/model format) */
  systemDefault?: string;
  /** Cooldown duration in ms after consecutive failures */
  cooldownMs?: number;
  /** Additional provider factories to register beyond built-ins */
  additionalFactories?: ProviderFactory[];
  /** Environment variables (defaults to process.env, injectable for testing) */
  env?: Record<string, string | undefined>;
}

export function createLLMStack(config: PhalanxLLMConfig = {}): {
  registry: ProviderRegistry;
  healthTracker: ProviderHealthTracker;
  resolver: ModelResolver;
} {
  const registry = new ProviderRegistry();
  const healthTracker = new ProviderHealthTracker(config.cooldownMs);

  const env = config.env ?? (process.env as Record<string, string | undefined>);
  const factories = [...BUILT_IN_PROVIDER_FACTORIES, ...(config.additionalFactories ?? [])];

  for (const factory of factories) {
    const providerConfig = config.providers?.[factory.name] ?? {};
    if (factory.shouldActivate(providerConfig, env)) {
      registry.register(factory.create(providerConfig));
    }
  }

  const systemDefault = config.systemDefault ?? 'anthropic/claude-sonnet-4-5-20250929';
  const resolver = new ModelResolver(registry, healthTracker, systemDefault);

  return { registry, healthTracker, resolver };
}
