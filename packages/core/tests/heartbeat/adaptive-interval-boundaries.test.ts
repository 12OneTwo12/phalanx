/**
 * AdaptiveIntervalCalculator — boundary condition tests.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  AdaptiveIntervalCalculator,
  ActivityBasedStrategy,
  type IntervalStrategy,
} from '../../src/heartbeat/adaptive-interval.js';
import type { HeartbeatConfig, HeartbeatContext } from '../../src/heartbeat/types.js';
import { DEFAULT_HEARTBEAT_CONFIG } from '../../src/heartbeat/types.js';

function makeContext(overrides: Partial<HeartbeatContext> = {}): HeartbeatContext {
  return {
    activeGoalCount: 1,
    ticketsByStatus: { in_progress: 0, done: 0, failed: 0 },
    totalTicketCount: 0,
    pendingProposalCount: 0,
    pendingReverseProposalCount: 0,
    recentActivityCount: 0,
    collectedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('AdaptiveIntervalCalculator — boundary conditions', () => {
  const config = DEFAULT_HEARTBEAT_CONFIG;

  it('should not extend to max on first no-change (needs 2 consecutive)', () => {
    const calc = new AdaptiveIntervalCalculator();
    const interval = calc.calculate(makeContext(), config, false);
    expect(interval).not.toBe(config.maxIntervalMs);
    expect(calc.noChangeCount).toBe(1);
  });

  it('should extend to max on exactly 2 consecutive no-change', () => {
    const calc = new AdaptiveIntervalCalculator();
    calc.calculate(makeContext(), config, false);
    const interval = calc.calculate(makeContext(), config, false);
    expect(interval).toBe(config.maxIntervalMs);
  });

  it('should stay at max for 3+ consecutive no-change', () => {
    const calc = new AdaptiveIntervalCalculator();
    calc.calculate(makeContext(), config, false);
    calc.calculate(makeContext(), config, false);
    const interval = calc.calculate(makeContext(), config, false);
    expect(interval).toBe(config.maxIntervalMs);
    expect(calc.noChangeCount).toBe(3);
  });

  it('should reset no-change counter immediately when changes detected after dampening', () => {
    const calc = new AdaptiveIntervalCalculator();
    calc.calculate(makeContext(), config, false);
    calc.calculate(makeContext(), config, false);
    expect(calc.noChangeCount).toBe(2);

    // Change detected — should reset and return base interval
    const ctx = makeContext({ ticketsByStatus: { in_progress: 3 } });
    const interval = calc.calculate(ctx, config, true);
    expect(calc.noChangeCount).toBe(0);
    expect(interval).toBe(15 * 60_000); // high activity
  });

  it('should accept a custom strategy', () => {
    const customStrategy: IntervalStrategy = {
      calculate: () => 42_000,
    };
    const calc = new AdaptiveIntervalCalculator(customStrategy);
    const interval = calc.calculate(makeContext(), config, true);
    expect(interval).toBe(42_000);
  });
});

describe('ActivityBasedStrategy — boundary at ticket thresholds', () => {
  const strategy = new ActivityBasedStrategy();
  const config = DEFAULT_HEARTBEAT_CONFIG;

  it('should return 60min for exactly 0 in-progress', () => {
    expect(strategy.calculate(makeContext({ ticketsByStatus: { in_progress: 0 } }), config))
      .toBe(60 * 60_000);
  });

  it('should return 30min for exactly 1 in-progress', () => {
    expect(strategy.calculate(makeContext({ ticketsByStatus: { in_progress: 1 } }), config))
      .toBe(30 * 60_000);
  });

  it('should return 30min for exactly 2 in-progress', () => {
    expect(strategy.calculate(makeContext({ ticketsByStatus: { in_progress: 2 } }), config))
      .toBe(30 * 60_000);
  });

  it('should return 15min for exactly 3 in-progress', () => {
    expect(strategy.calculate(makeContext({ ticketsByStatus: { in_progress: 3 } }), config))
      .toBe(15 * 60_000);
  });

  it('should handle missing in_progress key gracefully', () => {
    const ctx = makeContext({ ticketsByStatus: {} });
    const interval = strategy.calculate(ctx, config);
    expect(interval).toBe(60 * 60_000); // 0 in_progress → low activity
  });
});
