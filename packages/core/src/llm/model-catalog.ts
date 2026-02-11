import type { ModelCatalogEntry } from './types.js';

// ---------------------------------------------------------------------------
// Model Catalog
//
// Each entry represents a known model with all the metadata needed for
// cost estimation, capability checks, and resolution.
// ---------------------------------------------------------------------------

const ZERO_COST: ModelCost = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  // -------------------------------------------------------------------------
  // Anthropic models
  // -------------------------------------------------------------------------
  {
    fullId: 'anthropic/claude-opus-4-6-20250414',
    id: 'claude-opus-4-6-20250414',
    name: 'Claude Opus 4.6',
    provider: 'anthropic',
    api: 'anthropic-messages',
    reasoning: false,
    input: ['text', 'image'],
    cost: { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
    contextWindow: 200_000,
    maxTokens: 32_000,
    compat: { supportsThinking: true, supportsTools: true, supportsImages: true, supportsStreaming: true },
  },
  {
    fullId: 'anthropic/claude-sonnet-4-5-20250929',
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    api: 'anthropic-messages',
    reasoning: false,
    input: ['text', 'image'],
    cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
    contextWindow: 200_000,
    maxTokens: 16_000,
    compat: { supportsThinking: true, supportsTools: true, supportsImages: true, supportsStreaming: true },
  },
  {
    fullId: 'anthropic/claude-haiku-4-5-20251001',
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    api: 'anthropic-messages',
    reasoning: false,
    input: ['text', 'image'],
    cost: { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite: 1 },
    contextWindow: 200_000,
    maxTokens: 8_192,
    compat: { supportsThinking: false, supportsTools: true, supportsImages: true, supportsStreaming: true },
  },

  // -------------------------------------------------------------------------
  // OpenAI models
  // -------------------------------------------------------------------------
  {
    fullId: 'openai/gpt-4o',
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    api: 'openai-chat',
    reasoning: false,
    input: ['text', 'image'],
    cost: { input: 2.5, output: 10, cacheRead: 1.25, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 16_384,
    compat: { supportsTools: true, supportsImages: true, supportsStreaming: true },
  },
  {
    fullId: 'openai/gpt-4o-mini',
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    api: 'openai-chat',
    reasoning: false,
    input: ['text', 'image'],
    cost: { input: 0.15, output: 0.6, cacheRead: 0.075, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 16_384,
    compat: { supportsTools: true, supportsImages: true, supportsStreaming: true },
  },
  {
    fullId: 'openai/o3',
    id: 'o3',
    name: 'o3',
    provider: 'openai',
    api: 'openai-chat',
    reasoning: true,
    input: ['text', 'image'],
    cost: { input: 10, output: 40, cacheRead: 2.5, cacheWrite: 0 },
    contextWindow: 200_000,
    maxTokens: 100_000,
    compat: {
      supportsTools: true,
      supportsImages: true,
      supportsStreaming: true,
      supportsReasoningEffort: true,
      maxTokensField: 'max_completion_tokens',
    },
  },
  {
    fullId: 'openai/o3-mini',
    id: 'o3-mini',
    name: 'o3-mini',
    provider: 'openai',
    api: 'openai-chat',
    reasoning: true,
    input: ['text'],
    cost: { input: 1.1, output: 4.4, cacheRead: 0.55, cacheWrite: 0 },
    contextWindow: 200_000,
    maxTokens: 100_000,
    compat: {
      supportsTools: true,
      supportsReasoningEffort: true,
      maxTokensField: 'max_completion_tokens',
    },
  },
  {
    fullId: 'openai/o4-mini',
    id: 'o4-mini',
    name: 'o4-mini',
    provider: 'openai',
    api: 'openai-chat',
    reasoning: true,
    input: ['text', 'image'],
    cost: { input: 1.1, output: 4.4, cacheRead: 0.55, cacheWrite: 0 },
    contextWindow: 200_000,
    maxTokens: 100_000,
    compat: {
      supportsTools: true,
      supportsImages: true,
      supportsReasoningEffort: true,
      maxTokensField: 'max_completion_tokens',
    },
  },

  // -------------------------------------------------------------------------
  // Google Gemini models
  // -------------------------------------------------------------------------
  {
    fullId: 'gemini/gemini-2.5-pro',
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    api: 'google-generative-ai',
    reasoning: false,
    input: ['text', 'image'],
    cost: { input: 1.25, output: 10, cacheRead: 0.315, cacheWrite: 0 },
    contextWindow: 1_000_000,
    maxTokens: 65_536,
    compat: { supportsTools: true, supportsImages: true, supportsStreaming: true },
  },
  {
    fullId: 'gemini/gemini-2.5-flash',
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    api: 'google-generative-ai',
    reasoning: false,
    input: ['text', 'image'],
    cost: { input: 0.15, output: 0.6, cacheRead: 0.0375, cacheWrite: 0 },
    contextWindow: 1_000_000,
    maxTokens: 65_536,
    compat: { supportsTools: true, supportsImages: true, supportsStreaming: true },
  },
  {
    fullId: 'gemini/gemini-2.0-flash',
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'gemini',
    api: 'google-generative-ai',
    reasoning: false,
    input: ['text', 'image'],
    cost: { input: 0.1, output: 0.4, cacheRead: 0.025, cacheWrite: 0 },
    contextWindow: 1_000_000,
    maxTokens: 8_192,
    compat: { supportsTools: true, supportsImages: true, supportsStreaming: true },
  },
];

// ---------------------------------------------------------------------------
// Catalog lookup helpers
// ---------------------------------------------------------------------------

export class ModelCatalogRegistry {
  private byFullId = new Map<string, ModelCatalogEntry>();
  private byProvider = new Map<string, ModelCatalogEntry[]>();

  constructor(entries: ModelCatalogEntry[] = MODEL_CATALOG) {
    for (const entry of entries) {
      this.byFullId.set(entry.fullId, entry);
      const list = this.byProvider.get(entry.provider) ?? [];
      list.push(entry);
      this.byProvider.set(entry.provider, list);
    }
  }

  find(provider: string, modelId: string): ModelCatalogEntry | undefined {
    return this.byFullId.get(`${provider}/${modelId}`);
  }

  findByFullId(fullId: string): ModelCatalogEntry | undefined {
    return this.byFullId.get(fullId);
  }

  getProviderModels(provider: string): ModelCatalogEntry[] {
    return this.byProvider.get(provider) ?? [];
  }

  getAllEntries(): ModelCatalogEntry[] {
    return [...this.byFullId.values()];
  }

  /** Add a dynamically discovered model (e.g., Ollama local models) */
  register(entry: ModelCatalogEntry): void {
    this.byFullId.set(entry.fullId, entry);
    const list = this.byProvider.get(entry.provider) ?? [];
    list.push(entry);
    this.byProvider.set(entry.provider, list);
  }
}
