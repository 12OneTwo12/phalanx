import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContextChecker, type ContextCheckerDeps } from '../../src/heartbeat/heartbeat-context.js';

function createMockDeps(): ContextCheckerDeps {
  return {
    goalRepo: {
      findByStatus: vi.fn().mockReturnValue([]),
    } as any,
    ticketRepo: {
      findByStatus: vi.fn().mockReturnValue([]),
    } as any,
    proposalRepo: {
      findByStatus: vi.fn().mockReturnValue([]),
    } as any,
    reverseProposalRepo: {
      findByStatus: vi.fn().mockReturnValue([]),
    } as any,
    activityLogRepo: {
      findAll: vi.fn().mockReturnValue([]),
    } as any,
  };
}

describe('ContextChecker', () => {
  let deps: ContextCheckerDeps;
  let checker: ContextChecker;

  beforeEach(() => {
    deps = createMockDeps();
    checker = new ContextChecker(deps);
  });

  it('should collect empty context when repositories are empty', () => {
    const ctx = checker.collect();

    expect(ctx.activeGoalCount).toBe(0);
    expect(ctx.totalTicketCount).toBe(0);
    expect(ctx.pendingProposalCount).toBe(0);
    expect(ctx.pendingReverseProposalCount).toBe(0);
    expect(ctx.recentActivityCount).toBe(0);
    expect(ctx.collectedAt).toBeDefined();
  });

  it('should count active goals', () => {
    (deps.goalRepo.findByStatus as any).mockReturnValue([{ id: 'g1' }, { id: 'g2' }]);

    const ctx = checker.collect();
    expect(ctx.activeGoalCount).toBe(2);
    expect(deps.goalRepo.findByStatus).toHaveBeenCalledWith('active');
  });

  it('should count tickets by status', () => {
    (deps.ticketRepo.findByStatus as any).mockImplementation((status: string) => {
      if (status === 'in_progress') return [{ id: 't1' }, { id: 't2' }];
      if (status === 'done') return [{ id: 't3' }];
      return [];
    });

    const ctx = checker.collect();
    expect(ctx.ticketsByStatus['in_progress']).toBe(2);
    expect(ctx.ticketsByStatus['done']).toBe(1);
    expect(ctx.ticketsByStatus['backlog']).toBe(0);
    expect(ctx.totalTicketCount).toBe(3);
  });

  it('should count pending proposals and reverse proposals', () => {
    (deps.proposalRepo.findByStatus as any).mockReturnValue([{ id: 'p1' }]);
    (deps.reverseProposalRepo.findByStatus as any).mockReturnValue([{ id: 'rp1' }, { id: 'rp2' }]);

    const ctx = checker.collect();
    expect(ctx.pendingProposalCount).toBe(1);
    expect(ctx.pendingReverseProposalCount).toBe(2);
  });

  it('should count recent activity', () => {
    (deps.activityLogRepo.findAll as any).mockReturnValue(new Array(42).fill({ id: 'a' }));

    const ctx = checker.collect();
    expect(ctx.recentActivityCount).toBe(42);
    expect(deps.activityLogRepo.findAll).toHaveBeenCalledWith({ limit: 100 });
  });
});
