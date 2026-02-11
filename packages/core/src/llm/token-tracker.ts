import type { TokenUsageRecord, TokenUsageSummary, ModelConfig } from './types.js';

// ---------------------------------------------------------------------------
// Known model costs (per 1k tokens)
// ---------------------------------------------------------------------------

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'claude-opus-4-6': { input: 0.015, output: 0.075 },
  'claude-sonnet-4-5': { input: 0.003, output: 0.015 },
  'claude-haiku-4-5': { input: 0.0008, output: 0.004 },
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'o3': { input: 0.01, output: 0.04 },
  'o3-mini': { input: 0.0011, output: 0.0044 },
  'o4-mini': { input: 0.0011, output: 0.0044 },
};

function findCost(model: string): { input: number; output: number } {
  if (model in MODEL_COSTS) return MODEL_COSTS[model];
  for (const [key, cost] of Object.entries(MODEL_COSTS)) {
    if (model.startsWith(key)) return cost;
  }
  return { input: 0, output: 0 };
}

// ---------------------------------------------------------------------------
// TokenTracker — in-memory tracker (persists to DB in W3)
// ---------------------------------------------------------------------------

export class TokenTracker {
  private records: TokenUsageRecord[] = [];

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
      const cost = findCost(r.model);
      const recordCost =
        (r.inputTokens / 1000) * cost.input + (r.outputTokens / 1000) * cost.output;

      totalInput += r.inputTokens;
      totalOutput += r.outputTokens;
      totalThinking += r.thinkingTokens;
      totalCost += recordCost;

      // Aggregate by provider
      if (!byProvider[r.provider]) {
        byProvider[r.provider] = { input: 0, output: 0, thinking: 0, cost: 0 };
      }
      byProvider[r.provider].input += r.inputTokens;
      byProvider[r.provider].output += r.outputTokens;
      byProvider[r.provider].thinking += r.thinkingTokens;
      byProvider[r.provider].cost += recordCost;

      // Aggregate by model
      if (!byModel[r.model]) {
        byModel[r.model] = { input: 0, output: 0, thinking: 0, cost: 0 };
      }
      byModel[r.model].input += r.inputTokens;
      byModel[r.model].output += r.outputTokens;
      byModel[r.model].thinking += r.thinkingTokens;
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
}
