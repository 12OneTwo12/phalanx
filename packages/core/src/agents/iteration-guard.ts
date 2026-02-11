// ---------------------------------------------------------------------------
// Iteration Guard
// ---------------------------------------------------------------------------

export interface IterationGuardConfig {
  maxIterations: number;
  warningThreshold: number;
}

export const DEFAULT_ITERATION_CONFIG: IterationGuardConfig = {
  maxIterations: 25,
  warningThreshold: 20, // 80% of maxIterations
};

/**
 * Guards against infinite agent loops by tracking iteration count
 * and providing warning/exceeded signals.
 */
export class IterationGuard {
  private config: IterationGuardConfig;

  constructor(config?: Partial<IterationGuardConfig>) {
    this.config = { ...DEFAULT_ITERATION_CONFIG, ...config };
  }

  /** The configured warning threshold (iteration count at which warnings begin). */
  get warningThreshold(): number {
    return this.config.warningThreshold;
  }

  /**
   * Check the current iteration against limits.
   * Returns 'exceeded' if at or past max, 'warning' if at or past threshold,
   * 'continue' otherwise.
   */
  check(current: number): 'continue' | 'warning' | 'exceeded' {
    if (current >= this.config.maxIterations) {
      return 'exceeded';
    }
    if (current >= this.config.warningThreshold) {
      return 'warning';
    }
    return 'continue';
  }

  /** Get a warning message indicating the agent is approaching the limit. */
  getWarningMessage(current: number): string {
    return (
      `Approaching iteration limit (${current}/${this.config.maxIterations}). ` +
      `Please wrap up your current task.`
    );
  }

  /** Get a message indicating the iteration limit has been exceeded. */
  getExceededMessage(): string {
    return `Maximum iteration limit (${this.config.maxIterations}) reached. Escalating to user.`;
  }
}
