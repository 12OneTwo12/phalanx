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

describe('HeartbeatService', () => {
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

  it('should start and become active', () => {
    service.start();
    expect(service.isActive).toBe(true);
  });

  it('should stop and become inactive', () => {
    service.start();
    service.stop();
    expect(service.isActive).toBe(false);
  });

  it('should emit heartbeat:report on tick', async () => {
    const reportHandler = vi.fn();
    service.on('heartbeat:report', reportHandler);

    service.start();
    await vi.advanceTimersByTimeAsync(5000);

    expect(reportHandler).toHaveBeenCalledOnce();
    expect(reportHandler.mock.calls[0][0].report).toBeDefined();
    expect(reportHandler.mock.calls[0][0].report.summary).toBeDefined();
  });

  it('should persist report to heartbeat log repository', async () => {
    service.start();
    await vi.advanceTimersByTimeAsync(5000);

    expect(deps.heartbeatLogRepo.create).toHaveBeenCalledOnce();
    const createArg = (deps.heartbeatLogRepo.create as any).mock.calls[0][0];
    expect(createArg.id).toBeDefined();
    expect(createArg.status).toBe('pending');
    expect(JSON.parse(createArg.report)).toHaveProperty('summary');
  });

  it('should return state without timer reference', () => {
    const state = service.getState();
    expect(state).not.toHaveProperty('timer');
    expect(state.running).toBe(false);
    expect(state.consecutiveErrors).toBe(0);
  });

  it('should emit heartbeat:error when persistence fails', async () => {
    const errorHandler = vi.fn();
    service.on('heartbeat:error', errorHandler);
    (deps.heartbeatLogRepo.create as any).mockImplementation(() => {
      throw new Error('DB error');
    });

    service.start();
    await vi.advanceTimersByTimeAsync(5000);

    expect(errorHandler).toHaveBeenCalledOnce();
  });
});
