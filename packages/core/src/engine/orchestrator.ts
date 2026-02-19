/**
 * Orchestrator — central execution controller with dependency ordering and concurrency.
 */
import { EventEmitter } from 'node:events';
import type { TicketRepository } from '../db/repositories/ticket.repository.js';
import type { Ticket } from '../db/schema.js';
import { TicketStateMachine } from './ticket-state-machine.js';
import type { EngineConfig } from './types.js';
import { DEFAULT_ENGINE_CONFIG } from './types.js';

/**
 * Strategy interface for executing a ticket (dependency injection for agent execution).
 */
export interface TicketExecutor {
  execute(ticket: Ticket): Promise<{ success: boolean; error?: string }>;
}

export class Orchestrator extends EventEmitter {
  private readonly activeTickets = new Set<string>();
  private readonly config: EngineConfig;

  constructor(
    private readonly ticketRepo: TicketRepository,
    private readonly executor: TicketExecutor,
    config?: Partial<EngineConfig>,
  ) {
    super();
    this.config = { ...DEFAULT_ENGINE_CONFIG, ...config };
  }

  /**
   * Process all ready tickets respecting dependency order and concurrency limits.
   * Also picks up in_progress tickets that need retry (came back from verification failure).
   */
  async processQueue(): Promise<void> {
    const assigned = this.ticketRepo.findByStatus('assigned');
    const readyAssigned = assigned.filter((t) => this.areDependenciesMet(t));

    // Pick up in_progress tickets that need retry (retryCount > 0 means they were retried)
    const retrying = this.ticketRepo.findByStatus('in_progress')
      .filter((t) => t.retryCount > 0 && !this.activeTickets.has(t.id));

    const allReady = [...readyAssigned, ...retrying];

    // Respect concurrency limit
    const available = this.config.maxConcurrency - this.activeTickets.size;
    if (available <= 0) return;

    const toProcess = allReady.slice(0, available);

    await Promise.allSettled(
      toProcess.map((ticket) => this.executeTicket(ticket)),
    );
  }

  /**
   * Execute a single ticket through the lifecycle.
   */
  private async executeTicket(ticket: Ticket): Promise<void> {
    if (this.activeTickets.has(ticket.id)) return;
    this.activeTickets.add(ticket.id);

    try {
      // Transition to in_progress only if coming from 'assigned' (not retry)
      if (ticket.status === 'assigned') {
        const inProgress = TicketStateMachine.transition(ticket.status, 'start');
        this.ticketRepo.update(ticket.id, { status: inProgress });
        this.emit('ticket:started', { ticketId: ticket.id, agentId: ticket.assignedAgentId });
      }
      // If already in_progress (retry from verification failure), skip the start transition

      // Execute via injected executor
      const result = await this.executor.execute(ticket);

      if (result.success) {
        // Transition to verification (from in_progress)
        const verification = TicketStateMachine.transition('in_progress', 'submit');
        this.ticketRepo.update(ticket.id, { status: verification });
        this.emit('ticket:submitted', { ticketId: ticket.id, agentId: ticket.assignedAgentId });
      } else {
        // Transition to failed (from in_progress)
        const failed = TicketStateMachine.transition('in_progress', 'error');
        this.ticketRepo.update(ticket.id, { status: failed });
        this.emit('ticket:failed', { ticketId: ticket.id, agentId: ticket.assignedAgentId, error: result.error });
      }
    } catch (err) {
      // Log the error for debugging — previously silent, making diagnosis impossible
      console.error(`[phalanx] Ticket ${ticket.id} execution failed:`, err);
      // Unexpected error → attempt state machine transition, fallback to direct update
      try {
        const currentTicket = this.ticketRepo.findById(ticket.id);
        if (currentTicket && TicketStateMachine.canTransition(currentTicket.status as import('./types.js').TicketStatus, 'error')) {
          const failedStatus = TicketStateMachine.transition(currentTicket.status as import('./types.js').TicketStatus, 'error');
          this.ticketRepo.update(ticket.id, { status: failedStatus });
        } else {
          this.ticketRepo.update(ticket.id, { status: 'failed' });
        }
      } catch (transitionErr) {
        // Emit warning — failed to transition ticket to 'failed' state
        this.emit('ticket:transition-error', {
          ticketId: ticket.id,
          error: String(transitionErr),
          context: 'Failed to apply state machine transition during error recovery',
        });
      }
      this.emit('ticket:error', { ticketId: ticket.id, agentId: ticket.assignedAgentId, error: String(err) });
    } finally {
      this.activeTickets.delete(ticket.id);
    }
  }

  /**
   * Check if all dependencies of a ticket are completed.
   */
  private areDependenciesMet(ticket: Ticket): boolean {
    if (!ticket.dependsOn) return true;

    let deps: string[];
    try {
      deps = JSON.parse(ticket.dependsOn) as string[];
    } catch {
      // TODO: Add structured warning logging here. Malformed dependsOn JSON
      // is silently treated as "no dependencies", which could cause tickets to
      // execute out of order. Consider emitting a 'warning' event or using a logger.
      return true;
    }

    return deps.every((depId) => {
      const dep = this.ticketRepo.findById(depId);
      return dep?.status === 'done';
    });
  }

  /** Get the number of currently active tickets */
  get activeCount(): number {
    return this.activeTickets.size;
  }

  /** Get the engine config */
  get engineConfig(): EngineConfig {
    return { ...this.config };
  }
}
