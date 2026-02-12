/**
 * Integration edge cases: concurrent heartbeats, empty DB, multiple cycles.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupTestDb, type TestContext } from './helpers.js';
import { HeartbeatService } from '../../src/heartbeat/heartbeat-service.js';
import { ContextChecker } from '../../src/heartbeat/heartbeat-context.js';

describe('Heartbeat Integration — edge cases', () => {
  let ctx: TestContext;

  beforeEach(() => {
    vi.useFakeTimers();
    ctx = setupTestDb();
  });

  afterEach(() => {
    ctx.db.close();
    vi.useRealTimers();
  });

  it('should handle empty database gracefully', () => {
    const checker = new ContextChecker({
      goalRepo: ctx.repos.goal,
      ticketRepo: ctx.repos.ticket,
      proposalRepo: ctx.repos.proposal,
      reverseProposalRepo: ctx.repos.reverseProposal,
      activityLogRepo: ctx.repos.activityLog,
    });

    const context = checker.collect();
    expect(context.activeGoalCount).toBe(0);
    expect(context.totalTicketCount).toBe(0);
    expect(context.pendingProposalCount).toBe(0);
    expect(context.pendingReverseProposalCount).toBe(0);
    expect(context.recentActivityCount).toBe(0);
  });

  it('should run multiple heartbeat cycles and persist all', async () => {
    ctx.repos.goal.create({ id: 'g1', description: 'Test', status: 'active', progress: 0 });

    const service = new HeartbeatService(
      {
        goalRepo: ctx.repos.goal,
        ticketRepo: ctx.repos.ticket,
        proposalRepo: ctx.repos.proposal,
        reverseProposalRepo: ctx.repos.reverseProposal,
        activityLogRepo: ctx.repos.activityLog,
        heartbeatLogRepo: ctx.repos.heartbeatLog,
      },
      { defaultIntervalMs: 1000, minIntervalMs: 500, maxIntervalMs: 120_000, adaptiveEnabled: false },
    );

    service.start();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    service.stop();

    const logs = ctx.repos.heartbeatLog.findAll();
    expect(logs.length).toBe(3);
  });

  it('should not conflict when two services share the same repos (sequential)', async () => {
    const makeDeps = () => ({
      goalRepo: ctx.repos.goal,
      ticketRepo: ctx.repos.ticket,
      proposalRepo: ctx.repos.proposal,
      reverseProposalRepo: ctx.repos.reverseProposal,
      activityLogRepo: ctx.repos.activityLog,
      heartbeatLogRepo: ctx.repos.heartbeatLog,
    });

    const svc1 = new HeartbeatService(makeDeps(), {
      defaultIntervalMs: 1000, minIntervalMs: 500, maxIntervalMs: 120_000, adaptiveEnabled: false,
    });
    const svc2 = new HeartbeatService(makeDeps(), {
      defaultIntervalMs: 1000, minIntervalMs: 500, maxIntervalMs: 120_000, adaptiveEnabled: false,
    });

    svc1.start();
    await vi.advanceTimersByTimeAsync(1000);
    svc1.stop();

    svc2.start();
    await vi.advanceTimersByTimeAsync(1000);
    svc2.stop();

    const logs = ctx.repos.heartbeatLog.findAll();
    expect(logs.length).toBe(2);
  });

  it('should reflect data changes between heartbeat cycles', async () => {
    const service = new HeartbeatService(
      {
        goalRepo: ctx.repos.goal,
        ticketRepo: ctx.repos.ticket,
        proposalRepo: ctx.repos.proposal,
        reverseProposalRepo: ctx.repos.reverseProposal,
        activityLogRepo: ctx.repos.activityLog,
        heartbeatLogRepo: ctx.repos.heartbeatLog,
      },
      { defaultIntervalMs: 1000, minIntervalMs: 500, maxIntervalMs: 120_000, adaptiveEnabled: false },
    );

    const reports: any[] = [];
    service.on('heartbeat:report', (d) => reports.push(d.report));

    service.start();
    await vi.advanceTimersByTimeAsync(1000);

    // Add data between cycles
    ctx.repos.goal.create({ id: 'g1', description: 'New goal', status: 'active', progress: 0 });

    await vi.advanceTimersByTimeAsync(1000);
    service.stop();

    expect(reports).toHaveLength(2);
    // Second report should reflect the new goal
    expect(reports[1].context.activeGoalCount).toBe(1);
    expect(reports[1].hasChanges).toBe(true);
  });
});
