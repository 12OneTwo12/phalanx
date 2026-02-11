/**
 * Approval service — manages user approval flow for tickets.
 */
import { EventEmitter } from 'node:events';
import type { TicketRepository } from '../db/repositories/ticket.repository.js';
import { TicketStateMachine } from './ticket-state-machine.js';
import type { ApprovalRequest } from './types.js';

export class ApprovalService extends EventEmitter {
  constructor(private readonly ticketRepo: TicketRepository) {
    super();
  }

  /**
   * Process an approval decision for a single ticket.
   */
  processApproval(request: ApprovalRequest): void {
    const ticket = this.ticketRepo.findById(request.ticketId);
    if (!ticket) {
      throw new Error(`Ticket not found: ${request.ticketId}`);
    }

    if (ticket.status !== 'pending_approval') {
      throw new Error(`Ticket ${request.ticketId} is not pending approval (current: ${ticket.status})`);
    }

    switch (request.decision) {
      case 'approve': {
        const newStatus = TicketStateMachine.transition(ticket.status, 'approve');
        this.ticketRepo.update(request.ticketId, {
          status: newStatus,
          approvedAt: new Date().toISOString(),
        });
        this.emit('ticket:approved', { ticketId: request.ticketId });
        break;
      }
      case 'reject': {
        this.ticketRepo.delete(request.ticketId);
        this.emit('ticket:rejected', { ticketId: request.ticketId });
        break;
      }
      case 'modify': {
        // Apply modifications and approve in a single update to avoid stale state
        const newStatus = TicketStateMachine.transition(ticket.status, 'approve');
        this.ticketRepo.update(request.ticketId, {
          ...(request.modifications?.title && { title: request.modifications.title }),
          ...(request.modifications?.description && { description: request.modifications.description }),
          ...(request.modifications?.priority && { priority: request.modifications.priority }),
          status: newStatus,
          approvedAt: new Date().toISOString(),
        });
        this.emit('ticket:modified', { ticketId: request.ticketId, modifications: request.modifications });
        break;
      }
    }
  }

  /**
   * Approve all pending tickets.
   */
  approveAll(): string[] {
    const pending = this.ticketRepo.findByStatus('pending_approval');
    const approved: string[] = [];

    for (const ticket of pending) {
      this.processApproval({ ticketId: ticket.id, decision: 'approve' });
      approved.push(ticket.id);
    }

    this.emit('tickets:bulkApproved', { ticketIds: approved });
    return approved;
  }

  /**
   * Get all tickets pending approval.
   */
  getPendingApprovals(): ReturnType<TicketRepository['findByStatus']> {
    return this.ticketRepo.findByStatus('pending_approval');
  }
}
