/**
 * HeartbeatService — start/stop lifecycle, typed events, and edge cases.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HeartbeatService, type HeartbeatServiceDeps } from '../../src/heartbeat/heartbeat-service.js';

function createMockDeps(): HeartbeatServiceDeps {
  return {
    goalRepo: { findByStatus: vi.fn().mockReturnValue([]) } as any,
    ticketRepo: { findByStatus: vi.fn().mockReturnValue([]) } as any,
    proposalRepo: { findByStatus: vi.fn().mockReturnValue([]) } as any,
    reverseProposalRepo: { findByStatus: vi.fn().mockReturnValue([]) } as any,
    activityLogRepo: { findAll: vi.fn().mockReturnValue([]) } as any,
    heartbeatLogRepo: { create: vi.fn().mockReturnValue({ id: 'hbl-1' }) } as any,
  };
}

describe('HeartbeatService — lifecycle', () => {
  let deps: HeartbeatServiceDeps;
  let service: HeartbeatService;

  beforeEach(() => {
    vi.useFakeTimers();
    deps = createMockDeps();
    service = new HeartbeatService(deps, {
      defaultIntervalMs: 5000,
      minIntervalMs: 1000,
      maxIntervalMs: 120_000,
    });
  });

  afterEach(() => {
    service.stop();
    vi.useRealTimers();
  });

  it('should not be active before start', () => {
    expect(service.isActive).toBe(false);
  });

  it('should be idempotent on double start', () => {
    service.start();
    service.start(); // should not throw
    expect(service.isActive).toBe(true);
  });

  it('should be idempotent on double stop', () => {
    service.start();
    service.stop();
    service.stop(); // should not throw
    expect(service.isActive).toBe(false);
  });

  it('should stop without starting (no-op)', () => {
    service.stop(); // should not throw
    expect(service.isActive).toBe(false);
  });

  it('should allow restart after stop', async () => {
    // Disable adaptive so interval stays constant
    const svc = new HeartbeatService(deps, {
      defaultIntervalMs: 5000,
      minIntervalMs: 1000,
      maxIntervalMs: 120_000,
      adaptiveEnabled: false,
    });

    svc.start();
    await vi.advanceTimersByTimeAsync(5000);
    svc.stop();

    svc.start();
    await vi.advanceTimersByTimeAsync(5000);
    svc.stop();
    expect(deps.heartbeatLogRepo.create).toHaveBeenCalledTimes(2);
  });

  it('should use default config when none provided', () => {
    const svc = new HeartbeatService(deps);
    const state = svc.getState();
    expect(state.currentIntervalMs).toBe(30 * 60_000); // DEFAULT_HEARTBEAT_CONFIG
    svc.stop();
  });

  it('should include all state fields except timer', () => {
    const state = service.getState();
    expect(state).toHaveProperty('running');
    expect(state).toHaveProperty('lastRunAtMs');
    expect(state).toHaveProperty('lastStatus');
    expect(state).toHaveProperty('consecutiveErrors');
    expect(state).toHaveProperty('currentIntervalMs');
    expect(state).not.toHaveProperty('timer');
  });

  it('should update lastRunAtMs after a tick', async () => {
    service.start();
    const before = service.getState().lastRunAtMs;
    expect(before).toBeNull();

    await vi.advanceTimersByTimeAsync(5000);
    const after = service.getState().lastRunAtMs;
    expect(after).toBeTypeOf('number');
  });

  it('should emit heartbeat:error with typed payload when persistence fails', async () => {
    const errorHandler = vi.fn();
    service.on('heartbeat:error', errorHandler);
    (deps.heartbeatLogRepo.create as any).mockImplementation(() => {
      throw new Error('DB write failed');
    });

    service.start();
    await vi.advanceTimersByTimeAsync(5000);

    expect(errorHandler).toHaveBeenCalledOnce();
    const payload = errorHandler.mock.calls[0][0];
    expect(payload.error).toBeInstanceOf(Error);
    expect((payload.error as Error).message).toBe('DB write failed');
  });
});
