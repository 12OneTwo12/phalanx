import { describe, it, expect, beforeEach } from 'vitest';
import {
  AdaptiveIntervalCalculator,
  ActivityBasedStrategy,
} from '../../src/heartbeat/adaptive-interval.js';
import type { HeartbeatConfig, HeartbeatContext } from '../../src/heartbeat/types.js';
import { DEFAULT_HEARTBEAT_CONFIG } from '../../src/heartbeat/types.js';

function makeContext(inProgress = 0): HeartbeatContext {
  return {
    activeGoalCount: 1,
    ticketsByStatus: { in_progress: inProgress, done: 0, failed: 0 },
    totalTicketCount: inProgress,
    pendingProposalCount: 0,
    pendingReverseProposalCount: 0,
    recentActivityCount: 0,
    collectedAt: new Date().toISOString(),
  };
}

describe('ActivityBasedStrategy', () => {
  const strategy = new ActivityBasedStrategy();
  const config = DEFAULT_HEARTBEAT_CONFIG;

  it('should return 15min for 3+ in-progress tickets', () => {
    expect(strategy.calculate(makeContext(3), config)).toBe(15 * 60_000);
    expect(strategy.calculate(makeContext(5), config)).toBe(15 * 60_000);
  });

  it('should return 30min for 1-2 in-progress tickets', () => {
    expect(strategy.calculate(makeContext(1), config)).toBe(30 * 60_000);
    expect(strategy.calculate(makeContext(2), config)).toBe(30 * 60_000);
  });

  it('should return 60min for 0 in-progress tickets', () => {
    expect(strategy.calculate(makeContext(0), config)).toBe(60 * 60_000);
  });

  it('should clamp to config bounds', () => {
    const tightConfig: HeartbeatConfig = {
      ...config,
      minIntervalMs: 20 * 60_000,
      maxIntervalMs: 45 * 60_000,
    };
    // 3+ in progress would be 15min, but min is 20min
    expect(strategy.calculate(makeContext(5), tightConfig)).toBe(20 * 60_000);
    // 0 in progress would be 60min, but max is 45min
    expect(strategy.calculate(makeContext(0), tightConfig)).toBe(45 * 60_000);
  });
});

describe('AdaptiveIntervalCalculator', () => {
  let calc: AdaptiveIntervalCalculator;
  const config = DEFAULT_HEARTBEAT_CONFIG;

  beforeEach(() => {
    calc = new AdaptiveIntervalCalculator();
  });

  it('should return base interval when changes detected', () => {
    const interval = calc.calculate(makeContext(2), config, true);
    expect(interval).toBe(30 * 60_000);
  });

  it('should extend to max after 2 consecutive no-change heartbeats', () => {
    calc.calculate(makeContext(2), config, false); // noChange = 1
    const interval = calc.calculate(makeContext(2), config, false); // noChange = 2
    expect(interval).toBe(config.maxIntervalMs);
  });

  it('should reset no-change counter when changes detected', () => {
    calc.calculate(makeContext(2), config, false); // noChange = 1
    calc.calculate(makeContext(2), config, true);  // reset
    expect(calc.noChangeCount).toBe(0);
    const interval = calc.calculate(makeContext(2), config, false); // noChange = 1
    expect(interval).toBe(30 * 60_000); // Not yet maxed
  });

  it('should reset via reset()', () => {
    calc.calculate(makeContext(0), config, false);
    calc.reset();
    expect(calc.noChangeCount).toBe(0);
  });
});
