/**
 * ProposalExecutor — dispatches side-effects when a proposal is approved.
 *
 * Proposal types:
 *  - new_ticket    → create a ticket from metadata
 *  - priority_change → update an existing ticket's priority
 *  - improvement   → create an improvement ticket
 *
 * Idempotency: stores `_executedTicketId` in proposal metadata after first
 * execution so re-execution returns the same ticket without duplicates.
 */
import { randomUUID } from 'node:crypto';
import type { ProposalRepository } from '../db/repositories/proposal.repository.js';
import type { TicketRepository } from '../db/repositories/ticket.repository.js';
import type { Proposal, Ticket } from '../db/schema.js';

// ---------------------------------------------------------------------------
// Metadata shapes stored in proposal.metadata (JSON)
// ---------------------------------------------------------------------------

interface NewTicketMetadata {
  title: string;
  description: string;
  epicId: string;
  priority?: Ticket['priority'];
  /** Populated after first execution for idempotency */
  _executedTicketId?: string;
}

interface PriorityChangeMetadata {
  ticketId: string;
  newPriority: Ticket['priority'];
}

interface ImprovementMetadata {
  title: string;
  description: string;
  epicId: string;
  _executedTicketId?: string;
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface ProposalExecutionResult {
  success: boolean;
  proposalId: string;
  action: string;
  /** ID of the affected or created ticket */
  ticketId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// ProposalExecutor
// ---------------------------------------------------------------------------

export class ProposalExecutor {
  constructor(
    private readonly proposalRepo: ProposalRepository,
    private readonly ticketRepo: TicketRepository,
  ) {}

  /**
   * Execute the side-effects of an approved proposal.
   * Marks the proposal as approved first if still pending.
   * Safe for re-execution — returns cached result for already-executed proposals.
   */
  execute(proposalId: string): ProposalExecutionResult {
    const proposal = this.proposalRepo.findById(proposalId);
    if (!proposal) {
      return { success: false, proposalId, action: 'unknown', error: 'Proposal not found' };
    }

    // Approve if still pending
    if (proposal.status === 'pending') {
      this.proposalRepo.update(proposalId, { status: 'approved' });
    } else if (proposal.status === 'rejected') {
      return { success: false, proposalId, action: proposal.type, error: 'Proposal was rejected' };
    }

    switch (proposal.type) {
      case 'new_ticket':
        return this.executeNewTicket(proposal);
      case 'priority_change':
        return this.executePriorityChange(proposal);
      case 'improvement':
        return this.executeImprovement(proposal);
      default:
        return { success: false, proposalId, action: proposal.type, error: `Unknown proposal type: ${proposal.type}` };
    }
  }

  private parseMetadata<T>(proposal: Proposal): { data: T | null; error?: string } {
    if (!proposal.metadata) return { data: null };
    try {
      return { data: JSON.parse(proposal.metadata) as T };
    } catch (e) {
      return { data: null, error: `Malformed metadata JSON: ${e instanceof Error ? e.message : 'unknown'}` };
    }
  }

  /** Store executed ticket ID in proposal metadata for idempotency */
  private markExecuted(proposal: Proposal, parsedMeta: Record<string, unknown>, ticketId: string): void {
    parsedMeta._executedTicketId = ticketId;
    this.proposalRepo.update(proposal.id, { metadata: JSON.stringify(parsedMeta) });
  }

  private executeNewTicket(proposal: Proposal): ProposalExecutionResult {
    const { data: meta, error: parseError } = this.parseMetadata<NewTicketMetadata>(proposal);
    if (parseError) {
      return { success: false, proposalId: proposal.id, action: 'new_ticket', error: parseError };
    }
    if (!meta?.title || !meta?.epicId) {
      return {
        success: false,
        proposalId: proposal.id,
        action: 'new_ticket',
        error: 'Missing required metadata: title and epicId',
      };
    }

    // Idempotency: return cached ticket if already executed
    if (meta._executedTicketId) {
      return { success: true, proposalId: proposal.id, action: 'new_ticket', ticketId: meta._executedTicketId };
    }

    const ticket = this.ticketRepo.create({
      id: randomUUID(),
      title: meta.title,
      description: meta.description ?? '',
      epicId: meta.epicId,
      status: 'pending_approval',
      priority: meta.priority ?? 'medium',
      proposedBy: 'team-lead',
    });

    this.markExecuted(proposal, meta as unknown as Record<string, unknown>, ticket.id);
    return { success: true, proposalId: proposal.id, action: 'new_ticket', ticketId: ticket.id };
  }

  private executePriorityChange(proposal: Proposal): ProposalExecutionResult {
    const { data: meta, error: parseError } = this.parseMetadata<PriorityChangeMetadata>(proposal);
    if (parseError) {
      return { success: false, proposalId: proposal.id, action: 'priority_change', error: parseError };
    }
    if (!meta?.ticketId || !meta?.newPriority) {
      return {
        success: false,
        proposalId: proposal.id,
        action: 'priority_change',
        error: 'Missing required metadata: ticketId and newPriority',
      };
    }

    const existing = this.ticketRepo.findById(meta.ticketId);
    if (!existing) {
      return {
        success: false,
        proposalId: proposal.id,
        action: 'priority_change',
        error: `Ticket not found: ${meta.ticketId}`,
      };
    }

    this.ticketRepo.update(meta.ticketId, { priority: meta.newPriority });
    return { success: true, proposalId: proposal.id, action: 'priority_change', ticketId: meta.ticketId };
  }

  private executeImprovement(proposal: Proposal): ProposalExecutionResult {
    const { data: meta, error: parseError } = this.parseMetadata<ImprovementMetadata>(proposal);
    if (parseError) {
      return { success: false, proposalId: proposal.id, action: 'improvement', error: parseError };
    }
    if (!meta?.title || !meta?.epicId) {
      return {
        success: false,
        proposalId: proposal.id,
        action: 'improvement',
        error: 'Missing required metadata: title and epicId',
      };
    }

    // Idempotency: return cached ticket if already executed
    if (meta._executedTicketId) {
      return { success: true, proposalId: proposal.id, action: 'improvement', ticketId: meta._executedTicketId };
    }

    const ticket = this.ticketRepo.create({
      id: randomUUID(),
      title: `[Improvement] ${meta.title}`,
      description: meta.description ?? '',
      epicId: meta.epicId,
      status: 'pending_approval',
      priority: 'low',
      proposedBy: 'team-lead',
    });

    this.markExecuted(proposal, meta as unknown as Record<string, unknown>, ticket.id);
    return { success: true, proposalId: proposal.id, action: 'improvement', ticketId: ticket.id };
  }
}
