import { describe, it, expect, beforeEach } from 'vitest';
import { TokenTracker } from '../../src/llm/token-tracker.js';
import type { TokenUsageRecord } from '../../src/llm/types.js';

function makeRecord(overrides: Partial<TokenUsageRecord> = {}): TokenUsageRecord {
  return {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    inputTokens: 1000,
    outputTokens: 500,
    thinkingTokens: 0,
    timestamp: new Date(),
    ...overrides,
  };
}

describe('TokenTracker', () => {
  let tracker: TokenTracker;

  beforeEach(() => {
    tracker = new TokenTracker();
  });

  it('starts with zero records', () => {
    expect(tracker.count).toBe(0);
  });

  it('records usage', () => {
    tracker.record(makeRecord());
    expect(tracker.count).toBe(1);
  });

  it('computes summary totals', () => {
    tracker.record(makeRecord({ inputTokens: 1000, outputTokens: 500 }));
    tracker.record(makeRecord({ inputTokens: 2000, outputTokens: 1000 }));

    const summary = tracker.getSummary();
    expect(summary.totalInputTokens).toBe(3000);
    expect(summary.totalOutputTokens).toBe(1500);
  });

  it('computes estimated cost from known models', () => {
    // claude-sonnet-4-5: input $0.003/1k, output $0.015/1k
    tracker.record(makeRecord({
      model: 'claude-sonnet-4-5',
      inputTokens: 1000,
      outputTokens: 1000,
    }));

    const summary = tracker.getSummary();
    // (1000/1000 * 0.003) + (1000/1000 * 0.015) = 0.018
    expect(summary.estimatedCost).toBeCloseTo(0.018, 4);
  });

  it('handles prefix matching for versioned models', () => {
    tracker.record(makeRecord({
      model: 'claude-sonnet-4-5-20250929',
      inputTokens: 1000,
      outputTokens: 1000,
    }));

    const summary = tracker.getSummary();
    expect(summary.estimatedCost).toBeGreaterThan(0);
  });

  it('returns zero cost for unknown models', () => {
    tracker.record(makeRecord({
      model: 'unknown-model',
      inputTokens: 1000,
      outputTokens: 1000,
    }));

    const summary = tracker.getSummary();
    expect(summary.estimatedCost).toBe(0);
  });

  it('aggregates by provider', () => {
    tracker.record(makeRecord({ provider: 'anthropic', inputTokens: 100, outputTokens: 50 }));
    tracker.record(makeRecord({ provider: 'openai', model: 'gpt-4o', inputTokens: 200, outputTokens: 100 }));

    const summary = tracker.getSummary();
    expect(summary.byProvider['anthropic'].input).toBe(100);
    expect(summary.byProvider['openai'].input).toBe(200);
  });

  it('aggregates by model', () => {
    tracker.record(makeRecord({ model: 'claude-sonnet-4-5', inputTokens: 100 }));
    tracker.record(makeRecord({ model: 'gpt-4o', inputTokens: 200 }));

    const summary = tracker.getSummary();
    expect(summary.byModel['claude-sonnet-4-5'].input).toBe(100);
    expect(summary.byModel['gpt-4o'].input).toBe(200);
  });

  it('filters by goalId', () => {
    tracker.record(makeRecord({ goalId: 'goal-1', inputTokens: 100 }));
    tracker.record(makeRecord({ goalId: 'goal-2', inputTokens: 200 }));

    const summary = tracker.getSummary({ goalId: 'goal-1' });
    expect(summary.totalInputTokens).toBe(100);
  });

  it('filters by since date', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    tracker.record(makeRecord({ timestamp: twoDaysAgo, inputTokens: 100 }));
    tracker.record(makeRecord({ timestamp: new Date(), inputTokens: 200 }));

    const summary = tracker.getSummary({ since: yesterday });
    expect(summary.totalInputTokens).toBe(200);
  });

  it('clears all records', () => {
    tracker.record(makeRecord());
    tracker.record(makeRecord());
    tracker.clear();
    expect(tracker.count).toBe(0);
  });

  it('includes cache token costs in estimation', () => {
    // claude-sonnet-4-5: cacheRead $0.3/1M, cacheWrite $3.75/1M
    tracker.record(makeRecord({
      model: 'claude-sonnet-4-5',
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 1_000_000,
      cacheWriteTokens: 1_000_000,
    }));

    const summary = tracker.getSummary();
    // (1M * 0.3) / 1M + (1M * 3.75) / 1M = 0.3 + 3.75 = 4.05
    expect(summary.estimatedCost).toBeCloseTo(4.05, 4);
  });

  it('handles optional thinkingTokens gracefully', () => {
    tracker.record({
      provider: 'openai',
      model: 'gpt-4o',
      inputTokens: 100,
      outputTokens: 50,
      timestamp: new Date(),
    });

    const summary = tracker.getSummary();
    expect(summary.totalThinkingTokens).toBe(0);
    expect(summary.byProvider['openai'].thinking).toBe(0);
  });

  it('getTodaySummary filters to today', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    tracker.record(makeRecord({ timestamp: yesterday, inputTokens: 100 }));
    tracker.record(makeRecord({ timestamp: new Date(), inputTokens: 200 }));

    const summary = tracker.getTodaySummary();
    expect(summary.totalInputTokens).toBe(200);
  });
});
