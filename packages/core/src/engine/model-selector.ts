/**
 * ModelSelector — selects optimal provider/model based on ticket complexity.
 * Maps complexity levels to model tiers and verifies provider availability.
 */
import type { ProviderRegistry } from '../llm/provider-registry.js';
import type { ResolvedModel } from '../llm/types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TicketComplexity = 'low' | 'medium' | 'high';

export interface TicketAnalysis {
  requiredRole: string;
  techStack: string[];
  complexity: TicketComplexity;
  requiredTools: string[];
  domain: string;
  specializations: string[];
}

interface ModelTier {
  provider: string;
  model: string;
}

export interface ModelSelectorConfig {
  high: ModelTier;
  medium: ModelTier;
  low: ModelTier;
}

const DEFAULT_MODEL_TIERS: ModelSelectorConfig = {
  high: { provider: 'anthropic', model: 'claude-opus-4-6' },
  medium: { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
  low: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
};

// ---------------------------------------------------------------------------
// ModelSelector
// ---------------------------------------------------------------------------

export class ModelSelector {
  private readonly tiers: ModelSelectorConfig;

  constructor(
    private readonly providerRegistry: ProviderRegistry,
    tiers?: Partial<ModelSelectorConfig>,
  ) {
    this.tiers = { ...DEFAULT_MODEL_TIERS, ...tiers };
  }

  /**
   * Select the best model for a given ticket analysis.
   * Verifies provider availability and falls back if needed.
   */
  select(analysis: TicketAnalysis): ResolvedModel {
    const tier = this.tiers[analysis.complexity];

    // Verify provider is available
    if (this.providerRegistry.has(tier.provider)) {
      return {
        provider: tier.provider,
        model: tier.model,
        fullId: `${tier.provider}/${tier.model}`,
        resolvedFrom: 'role',
      };
    }

    // Fallback: use any available provider
    const allProviders = this.providerRegistry.getAll();
    if (allProviders.length > 0) {
      const fallback = allProviders[0];
      const fallbackModel = fallback.models[0] ?? tier.model;
      return {
        provider: fallback.name,
        model: fallbackModel,
        fullId: `${fallback.name}/${fallbackModel}`,
        resolvedFrom: 'fallback',
      };
    }

    // No providers available — cannot proceed
    throw new Error(
      `No LLM providers available. Configured provider "${tier.provider}" not found and no fallbacks registered.`,
    );
  }
}
