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
    this.workLogRepo.create({
      id: randomUUID(),
      date: today(),
      agentId: agentId ?? null,
      ticketId,
      action: 'started',
      description: `Started working on ticket ${ticketId}.`,
    });
  }

  /** Record when a ticket is completed */
  onTicketCompleted(ticketId: string, agentId?: string): void {
    this.workLogRepo.create({
      id: randomUUID(),
      date: today(),
      agentId: agentId ?? null,
      ticketId,
      action: 'completed',
      description: `Completed ticket ${ticketId}.`,
    });
  }

  /** Record when a ticket fails */
  onTicketFailed(ticketId: string, agentId?: string, error?: string): void {
    this.workLogRepo.create({
      id: randomUUID(),
      date: today(),
      agentId: agentId ?? null,
      ticketId,
      action: 'blocked',
      description: `Ticket ${ticketId} failed.${error ? ` Error: ${error}` : ''}`,
    });
  }

  /** Record progress update */
  onTicketProgress(ticketId: string, agentId?: string, description?: string): void {
    this.workLogRepo.create({
      id: randomUUID(),
      date: today(),
      agentId: agentId ?? null,
      ticketId,
      action: 'progressed',
      description: description ?? `Progress on ticket ${ticketId}.`,
    });
  }
}
