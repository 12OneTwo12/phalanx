/**
 * CompletionHandler — handles post-verification side effects.
 *
 * Responsibilities (no state transitions — those are handled by VerificationService):
 * - On pass: update goal progress, release agent
 * - On escalation: create escalation record, release agent
 * - On submitted: trigger verification
 */
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { TicketRepository } from '../db/repositories/ticket.repository.js';
import type { EpicRepository } from '../db/repositories/epic.repository.js';
import type { EscalationRepository } from '../db/repositories/escalation.repository.js';
import type { VerificationService } from './verification-service.js';
import type { AssignmentService } from './assignment-service.js';
import type { GoalManager } from './goal-manager.js';

export class CompletionHandler extends EventEmitter {
  constructor(
    private readonly ticketRepo: TicketRepository,
    private readonly epicRepo: EpicRepository,
    private readonly escalationRepo: EscalationRepository,
    private readonly verificationService: VerificationService,
    private readonly assignmentService: AssignmentService,
    private readonly goalManager: GoalManager,
  ) {
    super();
  }

  /**
   * Handle a ticket submitted for verification.
   * Delegates to VerificationService which handles state transitions and emits events.
   * DaemonWiring listens to those events and routes to handlePass/handleEscalation.
   */
  async handleSubmitted(ticketId: string): Promise<void> {
    await this.verificationService.verify(ticketId);
  }

  /**
   * Handle a ticket that passed verification (status already transitioned to 'done').
   * Updates goal progress and releases the assigned agent.
   */
  handlePass(ticketId: string): void {
    const ticket = this.ticketRepo.findById(ticketId);
    if (!ticket) return;

    // Update goal progress
    const epic = this.epicRepo.findById(ticket.epicId);
    if (epic?.goalId) {
      const progress = this.goalManager.calculateProgress(epic.goalId);
      this.emit('goal:progressUpdated', { goalId: epic.goalId, progress });
    }

    // Release agent
    if (ticket.assignedAgentId) {
      this.assignmentService.release(ticket.assignedAgentId);
    }

    this.emit('ticket:completed', { ticketId });
  }

  /**
   * Handle an escalated ticket.
   * Creates an escalation record and releases the assigned agent.
   */
  handleEscalation(ticketId: string): void {
    const ticket = this.ticketRepo.findById(ticketId);
    if (!ticket) return;

    this.escalationRepo.create({
      id: randomUUID(),
      type: 'alert',
      title: `Ticket escalated: ${ticket.title}`,
      description: `Ticket ${ticketId} failed verification after ${ticket.retryCount} retries.`,
      requestedBy: ticket.assignedAgentId ?? 'system',
      status: 'pending',
      blockedTasks: JSON.stringify([ticketId]),
    });

    // Release agent
    if (ticket.assignedAgentId) {
      this.assignmentService.release(ticket.assignedAgentId);
    }

    this.emit('ticket:escalated', { ticketId });
  }
}
