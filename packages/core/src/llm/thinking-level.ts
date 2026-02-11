import type { ThinkingLevel } from './types.js';

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
// Model-aware thinking support check
// ---------------------------------------------------------------------------

const THINKING_CAPABLE_MODELS: Record<string, boolean> = {
  'claude-opus-4-6': true,
  'claude-opus-4': true,
  'claude-sonnet-4-5': true,
  'claude-sonnet-4': true,
  'o1': true,
  'o1-mini': true,
  'o3': true,
  'o3-mini': true,
  'o4-mini': true,
};

export function supportsThinking(model: string): boolean {
  // Check exact match first
  if (model in THINKING_CAPABLE_MODELS) {
    return THINKING_CAPABLE_MODELS[model];
  }
  // Check prefix match (e.g., 'claude-opus-4-6-20250414')
  for (const key of Object.keys(THINKING_CAPABLE_MODELS)) {
    if (model.startsWith(key)) {
      return THINKING_CAPABLE_MODELS[key];
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
): ThinkingLevel {
  if (!requested || requested === 'off') return 'off';
  return supportsThinking(model) ? requested : 'off';
}
