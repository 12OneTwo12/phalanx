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
import type { PRCreator } from './pr/pr-creator.js';
import { TicketStateMachine } from './ticket-state-machine.js';

export class CompletionHandler extends EventEmitter {
  constructor(
    private readonly ticketRepo: TicketRepository,
    private readonly epicRepo: EpicRepository,
    private readonly escalationRepo: EscalationRepository,
    private readonly verificationService: VerificationService,
    private readonly assignmentService: AssignmentService,
    private readonly goalManager: GoalManager,
    private readonly prCreator?: PRCreator,
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
  async handlePass(ticketId: string): Promise<void> {
    const ticket = this.ticketRepo.findById(ticketId);
    if (!ticket) {
      this.emit('warning', { message: `handlePass: ticket ${ticketId} not found` });
      return;
    }

    try {
      // Update goal progress
      const epic = this.epicRepo.findById(ticket.epicId);
      if (epic?.goalId) {
        const progress = this.goalManager.calculateProgress(epic.goalId);
        this.emit('goal:progressUpdated', { goalId: epic.goalId, progress });
      }
      // Create PR if branch exists and prCreator is available
      if (this.prCreator && ticket.branch) {
        try {
          const prResult = await this.prCreator.create({
            ticket: { id: ticket.id, title: ticket.title, description: ticket.description },
            branch: ticket.branch,
            baseBranch: 'main',
            verificationResult: { ticketId, status: 'passed', checks: [] },
            decision: 'auto_merge',
          });
          this.ticketRepo.update(ticketId, { prUrl: `PR: ${prResult.title}` });
          this.emit('ticket:pr-created', { ticketId, branch: ticket.branch });
        } catch {
          // PR creation failure is non-fatal
        }
      }

      this.emit('ticket:completed', { ticketId, agentId: ticket.assignedAgentId });
    } finally {
      // Agent release must happen regardless of goal progress errors
      if (ticket.assignedAgentId) {
        this.assignmentService.release(ticket.assignedAgentId);
      }
    }
  }

  /**
   * Handle an escalated ticket.
   * Creates an escalation record and releases the assigned agent.
   */
  handleEscalation(ticketId: string): void {
    const ticket = this.ticketRepo.findById(ticketId);
    if (!ticket) {
      this.emit('warning', { message: `handleEscalation: ticket ${ticketId} not found` });
      return;
    }

    try {
      this.escalationRepo.create({
        id: randomUUID(),
        type: 'alert',
        title: `Ticket escalated: ${ticket.title}`,
        description: `Ticket ${ticketId} failed verification after ${ticket.retryCount} retries.`,
        requestedBy: ticket.assignedAgentId ?? 'system',
        status: 'pending',
        blockedTasks: JSON.stringify([ticketId]),
      });
      this.emit('ticket:escalated', { ticketId, agentId: ticket.assignedAgentId });
    } finally {
      // Agent release must happen regardless of escalation record creation errors
      if (ticket.assignedAgentId) {
        this.assignmentService.release(ticket.assignedAgentId);
      }
    }
  }

  /**
   * Handle a failed ticket execution.
   * Retries if under maxRetries (agent stays assigned for re-execution).
   * Escalates and releases agent when max retries exceeded.
   */
  handleFailure(ticketId: string, maxRetries = 3): void {
    const ticket = this.ticketRepo.findById(ticketId);
    if (!ticket) {
      this.emit('warning', { message: `handleFailure: ticket ${ticketId} not found` });
      return;
    }

    // If ticket isn't in 'failed' state (e.g., state transition failed), just release agent
    if (ticket.status !== 'failed') {
      if (ticket.assignedAgentId) {
        this.assignmentService.release(ticket.assignedAgentId);
      }
      return;
    }

    if (ticket.retryCount < maxRetries) {
      // Retry: transition failed → in_progress, keep agent assigned for re-execution
      const retrying = TicketStateMachine.transition('failed', 'retry');
      this.ticketRepo.update(ticketId, {
        status: retrying,
        retryCount: ticket.retryCount + 1,
      });
      this.emit('ticket:retrying', { ticketId, retryCount: ticket.retryCount + 1, agentId: ticket.assignedAgentId });
    } else {
      // Max retries exceeded → escalate and release agent
      try {
        const escalated = TicketStateMachine.transition('failed', 'escalate');
        this.ticketRepo.update(ticketId, { status: escalated });
        this.escalationRepo.create({
          id: randomUUID(),
          type: 'alert',
          title: `Ticket failed after ${maxRetries} retries: ${ticket.title}`,
          description: `Ticket ${ticketId} exceeded maximum retry count (${maxRetries}).`,
          requestedBy: ticket.assignedAgentId ?? 'system',
          status: 'pending',
          blockedTasks: JSON.stringify([ticketId]),
        });
        this.emit('ticket:escalated', { ticketId, agentId: ticket.assignedAgentId });
      } finally {
        if (ticket.assignedAgentId) {
          this.assignmentService.release(ticket.assignedAgentId);
        }
      }
    }
  }
}
