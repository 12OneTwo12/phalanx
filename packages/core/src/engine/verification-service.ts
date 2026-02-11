/**
 * Verification service — QA loop with retry and escalation.
 */
import { EventEmitter } from 'node:events';
import type { TicketRepository } from '../db/repositories/ticket.repository.js';
import { TicketStateMachine } from './ticket-state-machine.js';
import type { VerificationResult } from './types.js';

/**
 * Strategy interface for running verification checks on a ticket.
 */
export interface VerificationStrategy {
  verify(ticketId: string): Promise<VerificationResult>;
}

export class VerificationService extends EventEmitter {
  constructor(
    private readonly ticketRepo: TicketRepository,
    private strategy: VerificationStrategy,
  ) {
    super();
  }

  /** Set the verification strategy */
  setStrategy(strategy: VerificationStrategy): void {
    this.strategy = strategy;
  }

  /**
   * Run verification on a ticket in 'verification' status.
   * Handles pass/fail/retry/escalation logic.
   */
  async verify(ticketId: string): Promise<VerificationResult> {
    const ticket = this.ticketRepo.findById(ticketId);
    if (!ticket) throw new Error(`Ticket not found: ${ticketId}`);
    if (ticket.status !== 'verification') {
      throw new Error(`Ticket ${ticketId} is not in verification status (current: ${ticket.status})`);
    }

    const result = await this.strategy.verify(ticketId);

    if (result.status === 'passed') {
      const newStatus = TicketStateMachine.transition('verification', 'pass');
      this.ticketRepo.update(ticketId, { status: newStatus });
      this.emit('verification:passed', { ticketId });
    } else {
      // Failed — send back to in_progress for retry
      const failedStatus = TicketStateMachine.transition('verification', 'fail');
      const newRetryCount = ticket.retryCount + 1;

      if (newRetryCount >= ticket.maxRetries) {
        // Max retries reached — mark as failed then escalate
        this.ticketRepo.update(ticketId, {
          status: 'failed',
          retryCount: newRetryCount,
        });
        // Escalate
        const escalated = TicketStateMachine.transition('failed', 'escalate');
        this.ticketRepo.update(ticketId, { status: escalated });
        this.emit('verification:escalated', { ticketId, retryCount: newRetryCount });
      } else {
        this.ticketRepo.update(ticketId, {
          status: failedStatus,
          retryCount: newRetryCount,
        });
        this.emit('verification:failed', {
          ticketId,
          retryCount: newRetryCount,
          feedback: result.feedback,
        });
      }
    }

    return result;
  }

  /**
   * Get all tickets awaiting verification.
   */
  getPendingVerifications(): ReturnType<TicketRepository['findByStatus']> {
    return this.ticketRepo.findByStatus('verification');
  }
}
