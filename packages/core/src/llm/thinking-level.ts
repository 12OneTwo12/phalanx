import type { ThinkingLevel } from './types.js';
import { ModelCatalogRegistry, isModelMatch } from './model-catalog.js';

// ---------------------------------------------------------------------------
// Thinking budget mappings per provider
// ---------------------------------------------------------------------------

const ANTHROPIC_THINKING_BUDGETS: Record<ThinkingLevel, number> = {
  off: 0,
  low: 4_096,
  medium: 16_384,
  high: 32_768,
};

const OPENAI_REASONING_EFFORT: Record<ThinkingLevel, string> = {
  off: 'none',
  low: 'low',
  medium: 'medium',
  high: 'high',
};

// ---------------------------------------------------------------------------
// Provider-specific thinking config resolution
// ---------------------------------------------------------------------------

export interface AnthropicThinkingConfig {
  type: 'enabled' | 'disabled';
  budgetTokens?: number;
}

export interface OpenAIThinkingConfig {
  reasoningEffort: string;
}

export function resolveAnthropicThinking(level: ThinkingLevel): AnthropicThinkingConfig {
  if (level === 'off') {
    return { type: 'disabled' };
  }
  return {
    type: 'enabled',
    budgetTokens: ANTHROPIC_THINKING_BUDGETS[level],
  };
}

export function resolveOpenAIThinking(level: ThinkingLevel): OpenAIThinkingConfig {
  return {
    reasoningEffort: OPENAI_REASONING_EFFORT[level],
  };
}

// ---------------------------------------------------------------------------
// Model-aware thinking support check (uses ModelCatalogRegistry as single source)
// ---------------------------------------------------------------------------

const DEFAULT_CATALOG = new ModelCatalogRegistry();

export function supportsThinking(
  model: string,
  catalog: ModelCatalogRegistry = DEFAULT_CATALOG,
): boolean {
  for (const entry of catalog.getAllEntries()) {
    if (isModelMatch(model, entry.id)) {
      return entry.compat?.supportsThinking === true || entry.reasoning === true;
    }
  }
  return false;
}

/**
 * Adjust thinking level for models that don't support it.
 * Gracefully degrades to 'off' if model can't think.
 */
export function effectiveThinkingLevel(
  requested: ThinkingLevel | undefined,
  model: string,
  catalog?: ModelCatalogRegistry,
): ThinkingLevel {
  if (!requested || requested === 'off') return 'off';
  return supportsThinking(model, catalog) ? requested : 'off';
}
