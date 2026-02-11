/**
 * HeartbeatScheduler — manages the setTimeout + armTimer pattern
 * for periodic heartbeat execution with error backoff.
 */
import type { HeartbeatServiceState } from './types.js';

/** Maximum single timer delay in ms (60s) to correct for drift */
export const MAX_TIMER_DELAY_MS = 60_000;

/** Error backoff tiers in milliseconds */
export const ERROR_BACKOFF_MS = [
  30_000,      // 30s
  60_000,      // 60s
  5 * 60_000,  // 5 min
  15 * 60_000, // 15 min
  60 * 60_000, // 60 min
] as const;

export type TickHandler = () => Promise<void>;

/**
 * Scheduler using setTimeout + armTimer pattern.
 * Handles drift correction by clamping timer delays and re-arming.
 */
export class HeartbeatScheduler {
  private remainingMs: number | null = null;

  constructor(
    private readonly state: HeartbeatServiceState,
    private readonly onTick: TickHandler,
  ) {}

  /**
   * Start the scheduler by arming the first timer.
   */
  start(): void {
    if (this.state.timer !== null) return;
    this.armTimer();
  }

  /**
   * Stop the scheduler and clear any pending timer.
   */
  stop(): void {
    if (this.state.timer !== null) {
      clearTimeout(this.state.timer);
      this.state.timer = null;
    }
    this.remainingMs = null;
  }

  /**
   * Whether the scheduler has an active timer.
   */
  get isActive(): boolean {
    return this.state.timer !== null;
  }

  /**
   * Arm the next timer. Clamps delay to MAX_TIMER_DELAY_MS for drift correction.
   * If the target time hasn't been reached, re-arms with the remaining delay.
   */
  armTimer(): void {
    const totalDelay = this.remainingMs ?? this.getEffectiveDelay();
    this.remainingMs = null;
    const clampedDelay = Math.min(totalDelay, MAX_TIMER_DELAY_MS);

    this.state.timer = setTimeout(async () => {
      this.state.timer = null;

      // If we clamped, re-arm with remaining time
      if (clampedDelay < totalDelay) {
        this.remainingMs = totalDelay - clampedDelay;
        this.armTimer();
        return;
      }

      await this.executeTick();
    }, clampedDelay);
  }

  /**
   * Execute a tick with re-entrancy guard and error handling.
   */
  private async executeTick(): Promise<void> {
    // Re-entrancy guard
    if (this.state.running) return;
    this.state.running = true;

    try {
      await this.onTick();
      this.state.lastStatus = 'success';
      this.state.consecutiveErrors = 0;
      this.state.lastRunAtMs = Date.now();
    } catch {
      this.state.lastStatus = 'error';
      this.state.consecutiveErrors++;
    } finally {
      this.state.running = false;
      // Re-arm for next tick
      this.armTimer();
    }
  }

  /**
   * Get the effective delay, applying error backoff if needed.
   */
  private getEffectiveDelay(): number {
    if (this.state.consecutiveErrors > 0) {
      const backoffIndex = Math.min(
        this.state.consecutiveErrors - 1,
        ERROR_BACKOFF_MS.length - 1,
      );
      return ERROR_BACKOFF_MS[backoffIndex];
    }
    return this.state.currentIntervalMs;
  }
}
