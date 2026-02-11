import type { TokenUsageRecord, TokenUsageSummary } from './types.js';
import { ModelCatalogRegistry, isModelMatch } from './model-catalog.js';

// ---------------------------------------------------------------------------
// TokenTracker — in-memory tracker (persists to DB in W3)
// ---------------------------------------------------------------------------

export class TokenTracker {
  private records: TokenUsageRecord[] = [];
  private catalog: ModelCatalogRegistry;

  constructor(catalog?: ModelCatalogRegistry) {
    this.catalog = catalog ?? new ModelCatalogRegistry();
  }

  record(usage: TokenUsageRecord): void {
    this.records.push({ ...usage, timestamp: usage.timestamp ?? new Date() });
  }

  /** Get summary for all tracked usage */
  getSummary(filter?: { goalId?: string; since?: Date }): TokenUsageSummary {
    let filtered = this.records;

    if (filter?.goalId) {
      filtered = filtered.filter((r) => r.goalId === filter.goalId);
    }
    if (filter?.since) {
      filtered = filtered.filter((r) => r.timestamp >= filter.since!);
    }

    const byProvider: TokenUsageSummary['byProvider'] = {};
    const byModel: TokenUsageSummary['byModel'] = {};
    let totalInput = 0;
    let totalOutput = 0;
    let totalThinking = 0;
    let totalCost = 0;

    for (const r of filtered) {
      const entry = this.findCatalogEntry(r.provider, r.model);
      const cost = entry?.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

      // Catalog costs are per 1M tokens.
      // Note: thinkingTokens is a subset of outputTokens (already included), not additive.
      const recordCost =
        (r.inputTokens * cost.input) / 1_000_000 +
        (r.outputTokens * cost.output) / 1_000_000 +
        ((r.cacheReadTokens ?? 0) * cost.cacheRead) / 1_000_000 +
        ((r.cacheWriteTokens ?? 0) * cost.cacheWrite) / 1_000_000;

      totalInput += r.inputTokens;
      totalOutput += r.outputTokens;
      totalThinking += r.thinkingTokens ?? 0;
      totalCost += recordCost;

      // Aggregate by provider
      if (!byProvider[r.provider]) {
        byProvider[r.provider] = { input: 0, output: 0, thinking: 0, cost: 0 };
      }
      byProvider[r.provider].input += r.inputTokens;
      byProvider[r.provider].output += r.outputTokens;
      byProvider[r.provider].thinking += r.thinkingTokens ?? 0;
      byProvider[r.provider].cost += recordCost;

      // Aggregate by model
      if (!byModel[r.model]) {
        byModel[r.model] = { input: 0, output: 0, thinking: 0, cost: 0 };
      }
      byModel[r.model].input += r.inputTokens;
      byModel[r.model].output += r.outputTokens;
      byModel[r.model].thinking += r.thinkingTokens ?? 0;
      byModel[r.model].cost += recordCost;
    }

    return {
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      totalThinkingTokens: totalThinking,
      estimatedCost: Math.round(totalCost * 10000) / 10000,
      byProvider,
      byModel,
    };
  }

  /** Get today's usage summary */
  getTodaySummary(goalId?: string): TokenUsageSummary {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.getSummary({ goalId, since: today });
  }

  /** Clear all records (useful for testing) */
  clear(): void {
    this.records = [];
  }

  /** Get raw record count */
  get count(): number {
    return this.records.length;
  }

  /** Find catalog entry by provider+model with prefix-match fallback */
  private findCatalogEntry(provider: string, model: string) {
    // Exact match
    const exact = this.catalog.find(provider, model);
    if (exact) return exact;

    // Prefix match
    const providerModels = this.catalog.getProviderModels(provider);
    for (const entry of providerModels) {
      if (isModelMatch(model, entry.id)) {
        return entry;
      }
    }
    return undefined;
  }
}
