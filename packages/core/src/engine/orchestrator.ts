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
   */
  async processQueue(): Promise<void> {
    const assigned = this.ticketRepo.findByStatus('assigned');
    const ready = assigned.filter((t) => this.areDependenciesMet(t));

    // Respect concurrency limit
    const available = this.config.maxConcurrency - this.activeTickets.size;
    if (available <= 0) return;

    const toProcess = ready.slice(0, available);

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
      // Transition to in_progress
      const inProgress = TicketStateMachine.transition(ticket.status, 'start');
      this.ticketRepo.update(ticket.id, { status: inProgress });
      this.emit('ticket:started', { ticketId: ticket.id });

      // Execute via injected executor
      const result = await this.executor.execute(ticket);

      if (result.success) {
        // Transition to verification
        const verification = TicketStateMachine.transition(inProgress, 'submit');
        this.ticketRepo.update(ticket.id, { status: verification });
        this.emit('ticket:submitted', { ticketId: ticket.id });
      } else {
        // Transition to failed
        const failed = TicketStateMachine.transition(inProgress, 'error');
        this.ticketRepo.update(ticket.id, { status: failed });
        this.emit('ticket:failed', { ticketId: ticket.id, error: result.error });
      }
    } catch (err) {
      // Unexpected error → attempt state machine transition, fallback to direct update
      try {
        const currentTicket = this.ticketRepo.findById(ticket.id);
        if (currentTicket && TicketStateMachine.canTransition(currentTicket.status as import('./types.js').TicketStatus, 'error')) {
          const failedStatus = TicketStateMachine.transition(currentTicket.status as import('./types.js').TicketStatus, 'error');
          this.ticketRepo.update(ticket.id, { status: failedStatus });
        } else {
          this.ticketRepo.update(ticket.id, { status: 'failed' });
        }
      } catch { /* Best effort */ }
      this.emit('ticket:error', { ticketId: ticket.id, error: String(err) });
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
      return true; // Malformed deps — treat as no deps
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
