import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HeartbeatScheduler, ERROR_BACKOFF_MS } from '../../src/heartbeat/heartbeat-scheduler.js';
import type { HeartbeatServiceState } from '../../src/heartbeat/types.js';
import { createInitialState, DEFAULT_HEARTBEAT_CONFIG } from '../../src/heartbeat/types.js';

describe('HeartbeatScheduler', () => {
  let state: HeartbeatServiceState;
  let tickHandler: ReturnType<typeof vi.fn>;
  let scheduler: HeartbeatScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    state = createInitialState(DEFAULT_HEARTBEAT_CONFIG);
    tickHandler = vi.fn().mockResolvedValue(undefined);
    scheduler = new HeartbeatScheduler(state, tickHandler);
  });

  afterEach(() => {
    scheduler.stop();
    vi.useRealTimers();
  });

  it('should start and set a timer', () => {
    scheduler.start();
    expect(scheduler.isActive).toBe(true);
  });

  it('should not start twice', () => {
    scheduler.start();
    const timer1 = state.timer;
    scheduler.start();
    expect(state.timer).toBe(timer1);
  });

  it('should stop and clear the timer', () => {
    scheduler.start();
    scheduler.stop();
    expect(scheduler.isActive).toBe(false);
    expect(state.timer).toBeNull();
  });

  it('should execute tick handler after interval', async () => {
    state.currentIntervalMs = 5000; // 5s for test
    scheduler.start();

    await vi.advanceTimersByTimeAsync(5000);
    expect(tickHandler).toHaveBeenCalledOnce();
    expect(state.lastStatus).toBe('success');
    expect(state.consecutiveErrors).toBe(0);
  });

  it('should re-arm after successful tick', async () => {
    state.currentIntervalMs = 5000;
    scheduler.start();

    await vi.advanceTimersByTimeAsync(5000);
    expect(tickHandler).toHaveBeenCalledOnce();
    // Should have re-armed
    expect(scheduler.isActive).toBe(true);

    await vi.advanceTimersByTimeAsync(5000);
    expect(tickHandler).toHaveBeenCalledTimes(2);
  });

  it('should track consecutive errors on tick failure', async () => {
    tickHandler.mockRejectedValue(new Error('fail'));
    state.currentIntervalMs = 5000;
    scheduler.start();

    await vi.advanceTimersByTimeAsync(5000);
    expect(state.lastStatus).toBe('error');
    expect(state.consecutiveErrors).toBe(1);
  });

  it('should apply error backoff on consecutive errors', async () => {
    tickHandler.mockRejectedValue(new Error('fail'));
    state.currentIntervalMs = 5000;
    state.consecutiveErrors = 1; // Already had 1 error

    scheduler.start();
    // With 1 consecutive error, backoff should be ERROR_BACKOFF_MS[0] = 30s
    // But timer is clamped to MAX_TIMER_DELAY_MS (60s), so it fires at min(30s, 60s) = 30s
    await vi.advanceTimersByTimeAsync(ERROR_BACKOFF_MS[0]);
    expect(tickHandler).toHaveBeenCalledOnce();
    expect(state.consecutiveErrors).toBe(2);
  });

  it('should reset error count on success', async () => {
    state.consecutiveErrors = 3;
    state.currentIntervalMs = 5000;
    scheduler.start();

    // With 3 errors, backoff is ERROR_BACKOFF_MS[2] = 5min
    await vi.advanceTimersByTimeAsync(ERROR_BACKOFF_MS[2]);
    expect(tickHandler).toHaveBeenCalledOnce();
    expect(state.consecutiveErrors).toBe(0);
    expect(state.lastStatus).toBe('success');
  });

  it('should guard against re-entrant ticks', async () => {
    let resolveFirst: () => void;
    const firstCall = new Promise<void>((r) => { resolveFirst = r; });
    tickHandler.mockImplementationOnce(() => firstCall);

    state.currentIntervalMs = 100;
    scheduler.start();

    // Trigger first tick
    await vi.advanceTimersByTimeAsync(100);
    expect(state.running).toBe(true);

    // Manually try to arm/trigger again while running
    // The running guard should prevent double execution
    state.timer = null;
    scheduler.armTimer();
    await vi.advanceTimersByTimeAsync(100);

    // Only 1 call should have gone through
    expect(tickHandler).toHaveBeenCalledOnce();

    // Resolve the first call
    resolveFirst!();
    await vi.advanceTimersByTimeAsync(0);
    expect(state.running).toBe(false);
  });

  it('should cap backoff at the highest tier', async () => {
    tickHandler.mockRejectedValue(new Error('fail'));
    state.consecutiveErrors = 100; // Way past all tiers
    state.currentIntervalMs = 5000;
    scheduler.start();

    // The highest tier is 60min. Due to drift correction (MAX_TIMER_DELAY_MS=60s),
    // the scheduler re-arms multiple times. Advance enough to cover the full delay.
    const highestBackoff = ERROR_BACKOFF_MS[ERROR_BACKOFF_MS.length - 1];
    await vi.advanceTimersByTimeAsync(highestBackoff + 1000);
    expect(tickHandler).toHaveBeenCalled();
  });
});
