import { describe, it, expect, beforeEach } from 'vitest';
import { HeartbeatReporter } from '../../src/heartbeat/heartbeat-reporter.js';
import type { HeartbeatContext } from '../../src/heartbeat/types.js';

function makeContext(overrides: Partial<HeartbeatContext> = {}): HeartbeatContext {
  return {
    activeGoalCount: 1,
    ticketsByStatus: {
      pending_approval: 0,
      backlog: 2,
      assigned: 1,
      in_progress: 1,
      verification: 0,
      done: 3,
      failed: 0,
      escalated: 0,
    },
    totalTicketCount: 7,
    pendingProposalCount: 0,
    pendingReverseProposalCount: 0,
    recentActivityCount: 5,
    collectedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('HeartbeatReporter', () => {
  let reporter: HeartbeatReporter;

  beforeEach(() => {
    reporter = new HeartbeatReporter();
  });

  it('should generate a report with summary', () => {
    const report = reporter.generate(makeContext());

    expect(report.summary).toContain('Active goals: 1');
    expect(report.summary).toContain('1 in progress');
    expect(report.summary).toContain('3 done');
    expect(report.generatedAt).toBeDefined();
    expect(report.context).toBeDefined();
  });

  it('should detect changes on first run', () => {
    const report = reporter.generate(makeContext());
    expect(report.hasChanges).toBe(true);
  });

  it('should detect no changes when context is identical', () => {
    const ctx = makeContext();
    reporter.generate(ctx);
    const report2 = reporter.generate(ctx);
    expect(report2.hasChanges).toBe(false);
  });

  it('should detect changes when ticket counts change', () => {
    reporter.generate(makeContext());
    const changed = makeContext({
      ticketsByStatus: {
        ...makeContext().ticketsByStatus,
        in_progress: 3,
      },
      totalTicketCount: 9,
    });
    const report = reporter.generate(changed);
    expect(report.hasChanges).toBe(true);
  });

  it('should propose addressing failed tickets', () => {
    const ctx = makeContext({
      ticketsByStatus: { ...makeContext().ticketsByStatus, failed: 2 },
    });
    const report = reporter.generate(ctx);
    expect(report.proposals).toContainEqual(
      expect.objectContaining({ title: 'Address failed tickets' }),
    );
  });

  it('should propose reviewing escalated tickets', () => {
    const ctx = makeContext({
      ticketsByStatus: { ...makeContext().ticketsByStatus, escalated: 1 },
    });
    const report = reporter.generate(ctx);
    expect(report.proposals).toContainEqual(
      expect.objectContaining({ title: 'Review escalated tickets' }),
    );
  });

  it('should propose reviewing pending approvals when many are queued', () => {
    const ctx = makeContext({
      ticketsByStatus: { ...makeContext().ticketsByStatus, pending_approval: 7 },
    });
    const report = reporter.generate(ctx);
    expect(report.proposals).toContainEqual(
      expect.objectContaining({ title: 'Review pending approvals' }),
    );
  });

  it('should suggest setting a new goal when idle', () => {
    const ctx = makeContext({
      activeGoalCount: 0,
      ticketsByStatus: { ...makeContext().ticketsByStatus, in_progress: 0 },
    });
    const report = reporter.generate(ctx);
    expect(report.proposals).toContainEqual(
      expect.objectContaining({ title: 'Set a new goal' }),
    );
  });

  it('should not propose setting a new goal when goals exist', () => {
    const ctx = makeContext({ activeGoalCount: 1 });
    const report = reporter.generate(ctx);
    expect(report.proposals.find((p) => p.title === 'Set a new goal')).toBeUndefined();
  });

  it('should include pending proposal info in summary', () => {
    const ctx = makeContext({ pendingProposalCount: 3 });
    const report = reporter.generate(ctx);
    expect(report.summary).toContain('3 pending proposal(s)');
  });

  it('should include pending approval info in summary', () => {
    const ctx = makeContext({
      ticketsByStatus: { ...makeContext().ticketsByStatus, pending_approval: 2 },
    });
    const report = reporter.generate(ctx);
    expect(report.summary).toContain('2 ticket(s) awaiting approval');
  });

  it('should reset internal state', () => {
    reporter.generate(makeContext());
    reporter.reset();
    // After reset, first call should detect changes again
    const report = reporter.generate(makeContext());
    expect(report.hasChanges).toBe(true);
  });
});
