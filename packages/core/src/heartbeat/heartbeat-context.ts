/**
 * ContextChecker — collects the current system state from repositories
 * to produce a HeartbeatContext snapshot for the reporter.
 */
import type { GoalRepository } from '../db/repositories/goal.repository.js';
import type { TicketRepository } from '../db/repositories/ticket.repository.js';
import type { ProposalRepository } from '../db/repositories/proposal.repository.js';
import type { ReverseProposalRepository } from '../db/repositories/reverse-proposal.repository.js';
import type { ActivityLogRepository } from '../db/repositories/activity-log.repository.js';
import type { HeartbeatContext } from './types.js';

export interface ContextCheckerDeps {
  goalRepo: GoalRepository;
  ticketRepo: TicketRepository;
  proposalRepo: ProposalRepository;
  reverseProposalRepo: ReverseProposalRepository;
  activityLogRepo: ActivityLogRepository;
}

const TICKET_STATUSES = [
  'pending_approval',
  'backlog',
  'assigned',
  'in_progress',
  'verification',
  'done',
  'failed',
  'escalated',
] as const;

/**
 * Collects a point-in-time snapshot of system state for heartbeat analysis.
 */
export class ContextChecker {
  constructor(private readonly deps: ContextCheckerDeps) {}

  /**
   * Gather current system context from all relevant repositories.
   */
  collect(): HeartbeatContext {
    const activeGoals = this.deps.goalRepo.findByStatus('active');

    const ticketsByStatus: Record<string, number> = {};
    let totalTicketCount = 0;

    for (const status of TICKET_STATUSES) {
      const count = this.deps.ticketRepo.findByStatus(status).length;
      ticketsByStatus[status] = count;
      totalTicketCount += count;
    }

    const pendingProposals = this.deps.proposalRepo.findByStatus('pending');
    const pendingReverseProposals = this.deps.reverseProposalRepo.findByStatus('pending');
    const recentActivity = this.deps.activityLogRepo.findAll({ limit: 100 });

    return {
      activeGoalCount: activeGoals.length,
      ticketsByStatus,
      totalTicketCount,
      pendingProposalCount: pendingProposals.length,
      pendingReverseProposalCount: pendingReverseProposals.length,
      recentActivityCount: recentActivity.length,
      collectedAt: new Date().toISOString(),
    };
  }
}
