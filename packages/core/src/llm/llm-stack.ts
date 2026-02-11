import type { ProviderConfig } from './types.js';
import { ProviderRegistry } from './provider-registry.js';
import { ProviderHealthTracker } from './health-tracker.js';
import { ModelResolver } from './model-resolver.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { OpenAIProvider } from './providers/openai.js';
import { OllamaProvider } from './providers/ollama.js';
import { GeminiProvider } from './providers/gemini.js';

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
