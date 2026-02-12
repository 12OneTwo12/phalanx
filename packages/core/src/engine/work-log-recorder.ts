/**
 * WorkLogRecorder — automatically records work logs from engine events.
 *
 * Listens to lifecycle events and creates work_logs entries for daily tracking.
 */
import { randomUUID } from 'node:crypto';
import type { WorkLogRepository } from '../db/repositories/work-log.repository.js';

function today(): string {
  return new Date().toISOString().split('T')[0];
}

export class WorkLogRecorder {
  constructor(private readonly workLogRepo: WorkLogRepository) {}

  /** Record when an agent starts a ticket */
  onTicketStarted(ticketId: string, agentId?: string): void {
    this.safeCreate(ticketId, agentId, 'started', `Started working on ticket ${ticketId}.`);
  }

  /** Record when a ticket is completed */
  onTicketCompleted(ticketId: string, agentId?: string): void {
    this.safeCreate(ticketId, agentId, 'completed', `Completed ticket ${ticketId}.`);
  }

  /** Record when a ticket fails */
  onTicketFailed(ticketId: string, agentId?: string, error?: string): void {
    this.safeCreate(ticketId, agentId, 'blocked', `Ticket ${ticketId} failed.${error ? ` Error: ${error}` : ''}`);
  }

  /** Record progress update */
  onTicketProgress(ticketId: string, agentId?: string, description?: string): void {
    this.safeCreate(ticketId, agentId, 'progressed', description ?? `Progress on ticket ${ticketId}.`);
  }

  /** Observer should never crash the caller — swallow DB errors */
  private safeCreate(ticketId: string, agentId: string | undefined, action: 'started' | 'progressed' | 'completed' | 'blocked', description: string): void {
    try {
      this.workLogRepo.create({
        id: randomUUID(), date: today(), agentId: agentId ?? null, ticketId, action, description,
      });
    } catch {
      // Work log creation failure is non-fatal for the engine
    }
  }
}
