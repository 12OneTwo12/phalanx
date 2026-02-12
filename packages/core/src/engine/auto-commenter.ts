/**
 * AutoCommenter — automatically adds comments to tickets on lifecycle events.
 *
 * Listens to engine events (via DaemonWiring) and creates ticket comments
 * for plan, progress, completion, and review events.
 */
import { randomUUID } from 'node:crypto';
import type { TicketCommentRepository } from '../db/repositories/ticket-comment.repository.js';

export class AutoCommenter {
  constructor(private readonly commentRepo: TicketCommentRepository) {}

  /** Record when an agent starts working on a ticket */
  onTicketStarted(ticketId: string, agentId: string): void {
    this.safeCreate(ticketId, 'progress', `Agent \`${agentId}\` started working on this ticket.`);
  }

  /** Record when a ticket is submitted for verification */
  onTicketSubmitted(ticketId: string): void {
    this.safeCreate(ticketId, 'review', 'Ticket submitted for verification.');
  }

  /** Record when verification passes */
  onVerificationPassed(ticketId: string): void {
    this.safeCreate(ticketId, 'completion', 'Verification passed. Ticket completed.');
  }

  /** Record when verification fails */
  onVerificationFailed(ticketId: string, feedback?: string): void {
    const details = feedback ? `\n\nFeedback: ${feedback}` : '';
    this.safeCreate(ticketId, 'review', `Verification failed. Retrying.${details}`);
  }

  /** Record when a ticket is escalated */
  onTicketEscalated(ticketId: string): void {
    this.safeCreate(ticketId, 'review', 'Ticket escalated due to repeated verification failures.');
  }

  /** Record a ticket execution failure */
  onTicketFailed(ticketId: string, error?: string): void {
    this.safeCreate(ticketId, 'progress', `Ticket execution failed.${error ? ` Error: ${error}` : ''}`);
  }

  /** Observer should never crash the caller — swallow DB errors */
  private safeCreate(ticketId: string, type: 'plan' | 'progress' | 'completion' | 'review' | 'comment', content: string): void {
    try {
      this.commentRepo.create({ id: randomUUID(), ticketId, author: 'system', type, content });
    } catch {
      // Comment creation failure is non-fatal for the engine
    }
  }
}
