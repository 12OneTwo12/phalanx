/**
 * Goal manager — CRUD operations + progress calculation.
 */
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { GoalRepository } from '../db/repositories/goal.repository.js';
import type { EpicRepository } from '../db/repositories/epic.repository.js';
import type { TicketRepository } from '../db/repositories/ticket.repository.js';
import type { Goal } from '../db/schema.js';

export class GoalManager extends EventEmitter {
  constructor(
    private readonly goalRepo: GoalRepository,
    private readonly epicRepo?: EpicRepository,
    private readonly ticketRepo?: TicketRepository,
  ) {
    super();
  }

  /** Create a new goal */
  create(description: string): Goal {
    const goal = this.goalRepo.create({
      id: randomUUID(),
      description,
      status: 'active',
      progress: 0,
    });
    this.emit('goal:created', { goalId: goal.id });
    return goal;
  }

  /** Get a goal by ID */
  findById(id: string): Goal | undefined {
    return this.goalRepo.findById(id);
  }

  /** List all goals */
  findAll(): Goal[] {
    return this.goalRepo.findAll();
  }

  /** Update goal status */
  updateStatus(id: string, status: Goal['status']): Goal | undefined {
    const goal = this.goalRepo.update(id, { status });
    if (goal) this.emit('goal:statusChanged', { goalId: id, status });
    return goal;
  }

  /**
   * Calculate and update progress for a goal based on ticket completion.
   * TODO: Optimize N+1 query — currently fetches tickets per-epic in a loop.
   * Could use a single JOIN query (e.g., drizzle-orm inArray on epicIds) to
   * fetch all tickets for a goal's epics in one round-trip.
   */
  calculateProgress(goalId: string): number {
    if (!this.epicRepo || !this.ticketRepo) {
      throw new Error('epicRepo and ticketRepo are required for progress calculation');
    }
    const epics = this.epicRepo.findByGoalId(goalId);
    if (epics.length === 0) return 0;

    let totalTickets = 0;
    let doneTickets = 0;

    for (const epic of epics) {
      const tickets = this.ticketRepo.findByEpicId(epic.id);
      totalTickets += tickets.length;
      doneTickets += tickets.filter((t) => t.status === 'done').length;
    }

    if (totalTickets === 0) return 0;

    const progress = Math.round((doneTickets / totalTickets) * 100);
    this.goalRepo.update(goalId, { progress });

    this.emit('goal:progress', { goalId, progress });

    // Auto-complete goal when all tickets are done
    if (progress === 100) {
      this.goalRepo.update(goalId, { status: 'completed' });
      this.emit('goal:completed', { goalId });
    }

    return progress;
  }

  /** Delete a goal */
  delete(id: string): boolean {
    return this.goalRepo.delete(id);
  }
}
