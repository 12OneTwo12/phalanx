/**
 * Reporter — generates a HeartbeatReport with summary text and proposals
 * based on the collected HeartbeatContext.
 */
import type { HeartbeatContext, HeartbeatReport, HeartbeatReportProposal } from './types.js';

/**
 * Generates heartbeat reports from context snapshots.
 * Stateless — each call produces an independent report.
 */
export class HeartbeatReporter {
  private lastContext: HeartbeatContext | null = null;

  /**
   * Generate a report from the given context.
   * Compares against the previous context to detect changes.
   */
  generate(context: HeartbeatContext): HeartbeatReport {
    const hasChanges = this.detectChanges(context);
    const summary = this.buildSummary(context);
    const proposals = this.generateProposals(context);

    this.lastContext = context;

    return {
      summary,
      context,
      proposals,
      hasChanges,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Reset internal state (for testing or restart scenarios).
   */
  reset(): void {
    this.lastContext = null;
  }

  private detectChanges(current: HeartbeatContext): boolean {
    if (!this.lastContext) return true;

    if (current.activeGoalCount !== this.lastContext.activeGoalCount) return true;
    if (current.totalTicketCount !== this.lastContext.totalTicketCount) return true;
    if (current.pendingProposalCount !== this.lastContext.pendingProposalCount) return true;
    if (current.pendingReverseProposalCount !== this.lastContext.pendingReverseProposalCount) return true;

    // Check if ticket distribution changed
    for (const status of Object.keys(current.ticketsByStatus)) {
      if (current.ticketsByStatus[status] !== (this.lastContext.ticketsByStatus[status] ?? 0)) {
        return true;
      }
    }

    return false;
  }

  private buildSummary(ctx: HeartbeatContext): string {
    const parts: string[] = [];

    parts.push(`Active goals: ${ctx.activeGoalCount}`);

    const inProgress = ctx.ticketsByStatus['in_progress'] ?? 0;
    const pending = ctx.ticketsByStatus['pending_approval'] ?? 0;
    const done = ctx.ticketsByStatus['done'] ?? 0;
    const failed = ctx.ticketsByStatus['failed'] ?? 0;

    parts.push(`Tickets: ${ctx.totalTicketCount} total (${inProgress} in progress, ${done} done, ${failed} failed)`);

    if (pending > 0) {
      parts.push(`${pending} ticket(s) awaiting approval`);
    }

    if (ctx.pendingProposalCount > 0) {
      parts.push(`${ctx.pendingProposalCount} pending proposal(s)`);
    }

    if (ctx.pendingReverseProposalCount > 0) {
      parts.push(`${ctx.pendingReverseProposalCount} pending reverse proposal(s)`);
    }

    return parts.join('. ') + '.';
  }

  private generateProposals(ctx: HeartbeatContext): HeartbeatReportProposal[] {
    const proposals: HeartbeatReportProposal[] = [];

    // Suggest addressing failed tickets
    const failedCount = ctx.ticketsByStatus['failed'] ?? 0;
    if (failedCount > 0) {
      proposals.push({
        type: 'improvement',
        title: 'Address failed tickets',
        description: `${failedCount} ticket(s) are in failed state. Consider retrying or escalating them.`,
      });
    }

    // Suggest addressing escalated tickets
    const escalatedCount = ctx.ticketsByStatus['escalated'] ?? 0;
    if (escalatedCount > 0) {
      proposals.push({
        type: 'improvement',
        title: 'Review escalated tickets',
        description: `${escalatedCount} ticket(s) have been escalated and require human attention.`,
      });
    }

    // Suggest approval if many pending
    const pendingCount = ctx.ticketsByStatus['pending_approval'] ?? 0;
    if (pendingCount >= 5) {
      proposals.push({
        type: 'improvement',
        title: 'Review pending approvals',
        description: `${pendingCount} tickets are awaiting approval, which may be blocking progress.`,
      });
    }

    // If no active goals and no in-progress tickets, suggest new goal
    const inProgress = ctx.ticketsByStatus['in_progress'] ?? 0;
    if (ctx.activeGoalCount === 0 && inProgress === 0) {
      proposals.push({
        type: 'new_ticket',
        title: 'Set a new goal',
        description: 'No active goals or in-progress tickets. Consider setting a new goal to keep the team productive.',
      });
    }

    return proposals;
  }
}
