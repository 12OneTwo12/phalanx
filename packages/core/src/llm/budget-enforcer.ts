/**
 * BudgetEnforcer — enforces token and cost budgets per goal.
 *
 * Checks current usage against configured limits and throws
 * BudgetExceededError when a budget is breached. Supports
 * configurable warning threshold (default 80%).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BudgetLimits {
  /** Maximum total tokens (input + output) for the goal lifetime */
  maxTokens?: number;
  /** Maximum total tokens per day */
  maxDailyTokens?: number;
  /** Maximum total estimated cost (USD) */
  maxCost?: number;
}

export interface BudgetUsage {
  totalTokens: number;
  dailyTokens: number;
  totalCost: number;
}

/** Abstraction for querying current usage — allows DI of TokenTracker or DB repo */
export interface BudgetDataProvider {
  getUsage(goalId: string): BudgetUsage;
}

export interface BudgetCheckResult {
  exceeded: boolean;
  warning: boolean;
  details: BudgetViolation[];
}

export interface BudgetViolation {
  type: 'tokens' | 'daily_tokens' | 'cost';
  current: number;
  limit: number;
  percentage: number;
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class BudgetExceededError extends Error {
  constructor(
    public readonly goalId: string,
    public readonly violations: BudgetViolation[],
  ) {
    const msgs = violations.map(
      v => `${v.type}: ${v.current}/${v.limit} (${v.percentage}%)`,
    );
    super(`Budget exceeded for goal ${goalId}: ${msgs.join(', ')}`);
    this.name = 'BudgetExceededError';
  }
}

// ---------------------------------------------------------------------------
// BudgetEnforcer
// ---------------------------------------------------------------------------

export class BudgetEnforcer {
  private warningThreshold: number;
  private onWarning?: (goalId: string, violations: BudgetViolation[]) => void;

  constructor(
    private readonly dataProvider: BudgetDataProvider,
    options?: {
      /** Warning threshold as a fraction (0–1). Default: 0.8 (80%) */
      warningThreshold?: number;
      /** Callback invoked when usage exceeds warning threshold */
      onWarning?: (goalId: string, violations: BudgetViolation[]) => void;
    },
  ) {
    this.warningThreshold = options?.warningThreshold ?? 0.8;
    this.onWarning = options?.onWarning;
  }

  /**
   * Check usage against limits without throwing.
   * Returns result with exceeded/warning flags and violation details.
   */
  check(goalId: string, limits: BudgetLimits): BudgetCheckResult {
    const usage = this.dataProvider.getUsage(goalId);
    const violations: BudgetViolation[] = [];

    if (limits.maxTokens && usage.totalTokens > 0) {
      const pct = Math.round((usage.totalTokens / limits.maxTokens) * 100);
      if (pct >= 100) {
        violations.push({ type: 'tokens', current: usage.totalTokens, limit: limits.maxTokens, percentage: pct });
      } else if (pct >= this.warningThreshold * 100) {
        violations.push({ type: 'tokens', current: usage.totalTokens, limit: limits.maxTokens, percentage: pct });
      }
    }

    if (limits.maxDailyTokens && usage.dailyTokens > 0) {
      const pct = Math.round((usage.dailyTokens / limits.maxDailyTokens) * 100);
      if (pct >= 100) {
        violations.push({ type: 'daily_tokens', current: usage.dailyTokens, limit: limits.maxDailyTokens, percentage: pct });
      } else if (pct >= this.warningThreshold * 100) {
        violations.push({ type: 'daily_tokens', current: usage.dailyTokens, limit: limits.maxDailyTokens, percentage: pct });
      }
    }

    if (limits.maxCost && usage.totalCost > 0) {
      const pct = Math.round((usage.totalCost / limits.maxCost) * 100);
      if (pct >= 100) {
        violations.push({ type: 'cost', current: usage.totalCost, limit: limits.maxCost, percentage: pct });
      } else if (pct >= this.warningThreshold * 100) {
        violations.push({ type: 'cost', current: usage.totalCost, limit: limits.maxCost, percentage: pct });
      }
    }

    const exceeded = violations.some(v => v.percentage >= 100);
    const warning = !exceeded && violations.length > 0;

    return { exceeded, warning, details: violations };
  }

  /**
   * Enforce budget — throws BudgetExceededError if any limit is breached.
   * Calls onWarning callback when usage exceeds warning threshold but not limit.
   */
  enforce(goalId: string, limits: BudgetLimits): void {
    const result = this.check(goalId, limits);

    if (result.warning && this.onWarning) {
      this.onWarning(goalId, result.details);
    }

    if (result.exceeded) {
      const exceededViolations = result.details.filter(v => v.percentage >= 100);
      throw new BudgetExceededError(goalId, exceededViolations);
    }
  }
}
