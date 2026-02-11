/**
 * Adaptive interval calculator — adjusts heartbeat frequency based on system activity.
 * Uses the Strategy pattern to allow different calculation strategies.
 */
import type { HeartbeatConfig, HeartbeatContext } from './types.js';

/**
 * Strategy interface for calculating the next heartbeat interval.
 */
export interface IntervalStrategy {
  calculate(context: HeartbeatContext, config: HeartbeatConfig): number;
}

/**
 * Default activity-based interval strategy.
 *
 * Rules:
 * - 3+ tickets in_progress → 15 min (high activity)
 * - 1-2 tickets in_progress → 30 min (default)
 * - 0 tickets, no changes → 60 min (low activity)
 */
export class ActivityBasedStrategy implements IntervalStrategy {
  calculate(context: HeartbeatContext, config: HeartbeatConfig): number {
    const inProgress = context.ticketsByStatus['in_progress'] ?? 0;

    let intervalMs: number;

    if (inProgress >= 3) {
      intervalMs = 15 * 60_000; // 15 minutes
    } else if (inProgress >= 1) {
      intervalMs = 30 * 60_000; // 30 minutes
    } else {
      intervalMs = 60 * 60_000; // 60 minutes
    }

    // Clamp to config bounds
    return Math.max(config.minIntervalMs, Math.min(config.maxIntervalMs, intervalMs));
  }
}

/**
 * Calculates the adaptive interval, optionally applying consecutive no-change dampening.
 */
export class AdaptiveIntervalCalculator {
  private consecutiveNoChange = 0;

  constructor(private readonly strategy: IntervalStrategy = new ActivityBasedStrategy()) {}

  /**
   * Calculate the next interval based on context and whether changes were detected.
   */
  calculate(context: HeartbeatContext, config: HeartbeatConfig, hasChanges: boolean): number {
    const baseInterval = this.strategy.calculate(context, config);

    if (!hasChanges) {
      this.consecutiveNoChange++;
    } else {
      this.consecutiveNoChange = 0;
    }

    // 2+ consecutive no-change heartbeats → extend to max (120 min)
    if (this.consecutiveNoChange >= 2) {
      return config.maxIntervalMs;
    }

    return baseInterval;
  }

  /**
   * Reset the consecutive no-change counter.
   */
  reset(): void {
    this.consecutiveNoChange = 0;
  }

  /** Current consecutive no-change count (for testing) */
  get noChangeCount(): number {
    return this.consecutiveNoChange;
  }
}
