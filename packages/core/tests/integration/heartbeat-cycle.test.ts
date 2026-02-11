/**
 * E2E Integration: Heartbeat scheduled → context → report → adaptive interval
 * Tests the heartbeat system end-to-end with real repositories.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupTestDb, type TestContext } from './helpers.js';
import { HeartbeatService } from '../../src/heartbeat/heartbeat-service.js';
import { ContextChecker } from '../../src/heartbeat/heartbeat-context.js';
import { HeartbeatReporter } from '../../src/heartbeat/heartbeat-reporter.js';
import { AdaptiveIntervalCalculator } from '../../src/heartbeat/adaptive-interval.js';

describe('Heartbeat Cycle Integration', () => {
  let ctx: TestContext;

  beforeEach(() => {
    vi.useFakeTimers();
    ctx = setupTestDb();
  });

  afterEach(() => {
    ctx.db.close();
    vi.useRealTimers();
  });

  it('should collect context from real repositories', () => {
    // Seed data
    ctx.repos.goal.create({ id: 'g1', description: 'Build MVP', status: 'active', progress: 0 });
    ctx.repos.goal.create({ id: 'g2', description: 'Launch', status: 'active', progress: 0 });

    const checker = new ContextChecker({
      goalRepo: ctx.repos.goal,
      ticketRepo: ctx.repos.ticket,
      proposalRepo: ctx.repos.proposal,
      reverseProposalRepo: ctx.repos.reverseProposal,
      activityLogRepo: ctx.repos.activityLog,
    });

    const context = checker.collect();
    expect(context.activeGoalCount).toBe(2);
    expect(context.totalTicketCount).toBe(0);
  });

  it('should generate report with proposals for real data', () => {
    ctx.repos.goal.create({ id: 'g1', description: 'Build MVP', status: 'active', progress: 0 });

    // Create epic and tickets
    ctx.repos.epic.create({ id: 'e1', goalId: 'g1', title: 'Auth', status: 'active' });
    ctx.repos.ticket.create({
      id: 't1', epicId: 'e1', title: 'Login', description: 'Build login',
      status: 'failed', priority: 'high',
    });

    const checker = new ContextChecker({
      goalRepo: ctx.repos.goal,
      ticketRepo: ctx.repos.ticket,
      proposalRepo: ctx.repos.proposal,
      reverseProposalRepo: ctx.repos.reverseProposal,
      activityLogRepo: ctx.repos.activityLog,
    });

    const reporter = new HeartbeatReporter();
    const context = checker.collect();
    const report = reporter.generate(context);

    expect(report.hasChanges).toBe(true);
    expect(report.proposals).toContainEqual(
      expect.objectContaining({ title: 'Address failed tickets' }),
    );
  });

  it('should adapt interval based on activity level', () => {
    const calc = new AdaptiveIntervalCalculator();
    const config = {
      defaultIntervalMs: 30 * 60_000,
      minIntervalMs: 15 * 60_000,
      maxIntervalMs: 120 * 60_000,
      adaptiveEnabled: true,
    };

    // Create context with 3+ in-progress tickets
    ctx.repos.goal.create({ id: 'g1', description: 'Build MVP', status: 'active', progress: 0 });
    ctx.repos.epic.create({ id: 'e1', goalId: 'g1', title: 'Auth', status: 'active' });
    for (let i = 0; i < 4; i++) {
      ctx.repos.ticket.create({
        id: `t${i}`, epicId: 'e1', title: `Task ${i}`, description: `Desc ${i}`,
        status: 'in_progress', priority: 'medium',
      });
    }

    const checker = new ContextChecker({
      goalRepo: ctx.repos.goal,
      ticketRepo: ctx.repos.ticket,
      proposalRepo: ctx.repos.proposal,
      reverseProposalRepo: ctx.repos.reverseProposal,
      activityLogRepo: ctx.repos.activityLog,
    });

    const context = checker.collect();
    const interval = calc.calculate(context, config, true);
    expect(interval).toBe(15 * 60_000); // High activity → 15 min
  });

  it('should run full heartbeat service cycle with persistence', async () => {
    ctx.repos.goal.create({ id: 'g1', description: 'Build MVP', status: 'active', progress: 0 });

    const service = new HeartbeatService(
      {
        goalRepo: ctx.repos.goal,
        ticketRepo: ctx.repos.ticket,
        proposalRepo: ctx.repos.proposal,
        reverseProposalRepo: ctx.repos.reverseProposal,
        activityLogRepo: ctx.repos.activityLog,
        heartbeatLogRepo: ctx.repos.heartbeatLog,
      },
      { defaultIntervalMs: 5000, minIntervalMs: 1000, maxIntervalMs: 120_000 },
    );

    const reports: unknown[] = [];
    service.on('heartbeat:report', (data) => reports.push(data));

    service.start();
    await vi.advanceTimersByTimeAsync(5000);
    service.stop();

    expect(reports).toHaveLength(1);

    // Check persistence
    const logs = ctx.repos.heartbeatLog.findAll();
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe('pending');

    const report = JSON.parse(logs[0].report);
    expect(report.summary).toContain('Active goals: 1');
  });
});
