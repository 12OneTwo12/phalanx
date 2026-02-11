/**
 * Scheduler backoff edge cases — max backoff cap, reset after success,
 * and boundary transitions between error tiers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HeartbeatScheduler, ERROR_BACKOFF_MS, MAX_TIMER_DELAY_MS } from '../../src/heartbeat/heartbeat-scheduler.js';
import type { HeartbeatServiceState } from '../../src/heartbeat/types.js';
import { createInitialState, DEFAULT_HEARTBEAT_CONFIG } from '../../src/heartbeat/types.js';

describe('HeartbeatScheduler — backoff edge cases', () => {
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

  it('should use first backoff tier (30s) after 1 consecutive error', async () => {
    tickHandler.mockRejectedValueOnce(new Error('fail'));
    state.currentIntervalMs = 1000;
    scheduler.start();

    // First tick at 1s — fails, consecutiveErrors becomes 1
    await vi.advanceTimersByTimeAsync(1000);
    expect(state.consecutiveErrors).toBe(1);

    // Next tick should use ERROR_BACKOFF_MS[0] = 30s
    tickHandler.mockResolvedValue(undefined);
    await vi.advanceTimersByTimeAsync(ERROR_BACKOFF_MS[0]);
    expect(state.consecutiveErrors).toBe(0);
    expect(state.lastStatus).toBe('success');
  });

  it('should escalate through all backoff tiers', async () => {
    tickHandler.mockRejectedValue(new Error('fail'));
    state.currentIntervalMs = 1000;
    scheduler.start();

    // Tick 1: 1s delay → error 1
    await vi.advanceTimersByTimeAsync(1000);
    expect(state.consecutiveErrors).toBe(1);

    // Tick 2: 30s backoff → error 2
    await vi.advanceTimersByTimeAsync(ERROR_BACKOFF_MS[0]);
    expect(state.consecutiveErrors).toBe(2);

    // Tick 3: 60s backoff → error 3
    await vi.advanceTimersByTimeAsync(ERROR_BACKOFF_MS[1]);
    expect(state.consecutiveErrors).toBe(3);

    // Tick 4: 5min backoff → error 4
    await vi.advanceTimersByTimeAsync(ERROR_BACKOFF_MS[2]);
    expect(state.consecutiveErrors).toBe(4);

    // Tick 5: 15min backoff → error 5
    await vi.advanceTimersByTimeAsync(ERROR_BACKOFF_MS[3]);
    expect(state.consecutiveErrors).toBe(5);
  });

  it('should cap at highest backoff tier and never exceed it', async () => {
    tickHandler.mockRejectedValue(new Error('fail'));
    state.consecutiveErrors = 10; // well past all tiers
    state.currentIntervalMs = 1000;
    scheduler.start();

    const maxBackoff = ERROR_BACKOFF_MS[ERROR_BACKOFF_MS.length - 1]; // 60min
    await vi.advanceTimersByTimeAsync(maxBackoff);
    // Should have ticked (after drift correction re-arms)
    expect(tickHandler).toHaveBeenCalled();
    expect(state.consecutiveErrors).toBe(11);
  });

  it('should fully reset error count on first success after errors', async () => {
    state.consecutiveErrors = 4;
    state.lastStatus = 'error';
    state.currentIntervalMs = 5000;
    scheduler.start();

    // Backoff for 4 errors = ERROR_BACKOFF_MS[3] = 15min
    await vi.advanceTimersByTimeAsync(ERROR_BACKOFF_MS[3]);
    expect(state.consecutiveErrors).toBe(0);
    expect(state.lastStatus).toBe('success');

    // Next tick should use normal interval, not backoff
    await vi.advanceTimersByTimeAsync(5000);
    expect(tickHandler).toHaveBeenCalledTimes(2);
  });

  it('should handle drift correction for long backoff delays', async () => {
    state.consecutiveErrors = 5; // tier 4 = 60min
    state.currentIntervalMs = 5000;
    scheduler.start();

    // 60min > MAX_TIMER_DELAY_MS (60s), so scheduler re-arms multiple times
    // Advance 30s — shouldn't have ticked yet
    await vi.advanceTimersByTimeAsync(30_000);
    expect(tickHandler).not.toHaveBeenCalled();

    // Advance the rest of 60min
    await vi.advanceTimersByTimeAsync(ERROR_BACKOFF_MS[4] - 30_000);
    expect(tickHandler).toHaveBeenCalledOnce();
  });

  it('should use normal interval when consecutiveErrors is 0', async () => {
    state.currentIntervalMs = 10_000;
    state.consecutiveErrors = 0;
    scheduler.start();

    // Should fire at 10s, not any backoff tier
    await vi.advanceTimersByTimeAsync(9_999);
    expect(tickHandler).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(tickHandler).toHaveBeenCalledOnce();
  });
});
