/**
 * Decomposition service — breaks down goals into epics and tickets.
 * In production, delegates to Team Lead Agent via LLM. This implementation
 * provides the structural framework for that integration.
 */
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { GoalRepository } from '../db/repositories/goal.repository.js';
import type { EpicRepository } from '../db/repositories/epic.repository.js';
import type { TicketRepository } from '../db/repositories/ticket.repository.js';
import type { Epic, Ticket } from '../db/schema.js';
import type { DecompositionResult, DecomposedEpic } from './types.js';

/**
 * Strategy interface for goal decomposition.
 * Allows swapping between LLM-based and manual decomposition.
 */
export interface DecompositionStrategy {
  decompose(goalDescription: string): Promise<DecomposedEpic[]>;
}

/**
 * Manual decomposition strategy — used for testing or direct input.
 */
export class ManualDecompositionStrategy implements DecompositionStrategy {
  constructor(private readonly epics: DecomposedEpic[]) {}

  async decompose(_goalDescription: string): Promise<DecomposedEpic[]> {
    return this.epics;
  }
}

/**
 * Service that orchestrates the goal → epic → ticket decomposition process.
 */
export class DecompositionService extends EventEmitter {
  constructor(
    private readonly goalRepo: GoalRepository,
    private readonly epicRepo: EpicRepository,
    private readonly ticketRepo: TicketRepository,
    private strategy: DecompositionStrategy,
  ) {
    super();
  }

  /** Set the decomposition strategy */
  setStrategy(strategy: DecompositionStrategy): void {
    this.strategy = strategy;
  }

  /**
   * Decompose a goal into epics and tickets.
   * All tickets start in 'pending_approval' status.
   */
  async decompose(goalId: string): Promise<DecompositionResult> {
    const goal = this.goalRepo.findById(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    const decomposedEpics = await this.strategy.decompose(goal.description);

    const createdEpics: Array<{ epic: Epic; tickets: Ticket[] }> = [];

    for (const de of decomposedEpics) {
      const epic = this.epicRepo.create({
        id: randomUUID(),
        goalId,
        title: de.title,
        description: de.description,
      });

      const tickets: Ticket[] = [];
      for (const dt of de.tickets) {
        const ticket = this.ticketRepo.create({
          id: randomUUID(),
          epicId: epic.id,
          title: dt.title,
          description: dt.description,
          priority: dt.priority,
          status: 'pending_approval',
          dependsOn: dt.dependsOn.length > 0 ? JSON.stringify(dt.dependsOn) : null,
          proposedBy: 'team-lead',
        });
        tickets.push(ticket);
      }

      createdEpics.push({ epic, tickets });
    }

    this.emit('decomposition:complete', { goalId, epicCount: createdEpics.length });

    return {
      goalId,
      epics: decomposedEpics,
    };
  }
}
