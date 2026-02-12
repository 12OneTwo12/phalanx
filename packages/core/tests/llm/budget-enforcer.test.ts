import { describe, it, expect, vi } from 'vitest';
import {
  BudgetEnforcer,
  BudgetExceededError,
  type BudgetDataProvider,
  type BudgetUsage,
} from '../../src/llm/budget-enforcer.js';

function mockProvider(usage: BudgetUsage): BudgetDataProvider {
  return { getUsage: () => usage };
}

describe('BudgetEnforcer', () => {
  // -----------------------------------------------------------------------
  // check()
  // -----------------------------------------------------------------------

  describe('check', () => {
    it('should return no violations when under all limits', () => {
      const provider = mockProvider({ totalTokens: 5000, dailyTokens: 1000, totalCost: 0.5 });
      const enforcer = new BudgetEnforcer(provider);

      const result = enforcer.check('g1', { maxTokens: 100000, maxDailyTokens: 50000, maxCost: 10 });
      expect(result.exceeded).toBe(false);
      expect(result.warning).toBe(false);
      expect(result.details).toHaveLength(0);
    });

    it('should flag warning at 80% threshold', () => {
      const provider = mockProvider({ totalTokens: 85000, dailyTokens: 1000, totalCost: 0.1 });
      const enforcer = new BudgetEnforcer(provider);

      const result = enforcer.check('g1', { maxTokens: 100000 });
      expect(result.exceeded).toBe(false);
      expect(result.warning).toBe(true);
      expect(result.details).toHaveLength(1);
      expect(result.details[0].type).toBe('tokens');
      expect(result.details[0].percentage).toBe(85);
    });

    it('should flag exceeded when over 100%', () => {
      const provider = mockProvider({ totalTokens: 150000, dailyTokens: 0, totalCost: 0 });
      const enforcer = new BudgetEnforcer(provider);

      const result = enforcer.check('g1', { maxTokens: 100000 });
      expect(result.exceeded).toBe(true);
      expect(result.details[0].percentage).toBe(150);
    });

    it('should check daily token limits independently', () => {
      const provider = mockProvider({ totalTokens: 5000, dailyTokens: 55000, totalCost: 0 });
      const enforcer = new BudgetEnforcer(provider);

      const result = enforcer.check('g1', { maxTokens: 1000000, maxDailyTokens: 50000 });
      expect(result.exceeded).toBe(true);
      expect(result.details[0].type).toBe('daily_tokens');
    });

    it('should check cost limit', () => {
      const provider = mockProvider({ totalTokens: 0, dailyTokens: 0, totalCost: 12 });
      const enforcer = new BudgetEnforcer(provider);

      const result = enforcer.check('g1', { maxCost: 10 });
      expect(result.exceeded).toBe(true);
      expect(result.details[0].type).toBe('cost');
    });

    it('should support custom warning threshold', () => {
      const provider = mockProvider({ totalTokens: 55000, dailyTokens: 0, totalCost: 0 });
      const enforcer = new BudgetEnforcer(provider, { warningThreshold: 0.5 });

      const result = enforcer.check('g1', { maxTokens: 100000 });
      expect(result.warning).toBe(true);
      expect(result.details[0].percentage).toBe(55);
    });

    it('should skip limits that are not configured', () => {
      const provider = mockProvider({ totalTokens: 999999, dailyTokens: 999999, totalCost: 999 });
      const enforcer = new BudgetEnforcer(provider);

      const result = enforcer.check('g1', {});
      expect(result.exceeded).toBe(false);
      expect(result.details).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // enforce()
  // -----------------------------------------------------------------------

  describe('enforce', () => {
    it('should throw BudgetExceededError when limit exceeded', () => {
      const provider = mockProvider({ totalTokens: 200000, dailyTokens: 0, totalCost: 0 });
      const enforcer = new BudgetEnforcer(provider);

      expect(() => enforcer.enforce('g1', { maxTokens: 100000 }))
        .toThrow(BudgetExceededError);
    });

    it('should include goal ID and violations in error', () => {
      const provider = mockProvider({ totalTokens: 200000, dailyTokens: 0, totalCost: 0 });
      const enforcer = new BudgetEnforcer(provider);

      try {
        enforcer.enforce('goal-abc', { maxTokens: 100000 });
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(BudgetExceededError);
        const err = e as BudgetExceededError;
        expect(err.goalId).toBe('goal-abc');
        expect(err.violations).toHaveLength(1);
        expect(err.message).toContain('goal-abc');
      }
    });

    it('should call onWarning callback when at warning threshold', () => {
      const provider = mockProvider({ totalTokens: 85000, dailyTokens: 0, totalCost: 0 });
      const onWarning = vi.fn();
      const enforcer = new BudgetEnforcer(provider, { onWarning });

      // Should not throw — just at warning level
      enforcer.enforce('g1', { maxTokens: 100000 });
      expect(onWarning).toHaveBeenCalledWith('g1', expect.any(Array));
    });

    it('should not call onWarning when under threshold', () => {
      const provider = mockProvider({ totalTokens: 5000, dailyTokens: 0, totalCost: 0 });
      const onWarning = vi.fn();
      const enforcer = new BudgetEnforcer(provider, { onWarning });

      enforcer.enforce('g1', { maxTokens: 100000 });
      expect(onWarning).not.toHaveBeenCalled();
    });

    it('should not throw when only at warning level', () => {
      const provider = mockProvider({ totalTokens: 90000, dailyTokens: 0, totalCost: 0 });
      const enforcer = new BudgetEnforcer(provider);

      // 90% — warning but not exceeded
      expect(() => enforcer.enforce('g1', { maxTokens: 100000 })).not.toThrow();
    });
  });
});
