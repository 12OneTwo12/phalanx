import { eq } from 'drizzle-orm';
import { tickets, type Ticket, type NewTicket } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import { BaseRepository } from './base.repository.js';

export class TicketRepository extends BaseRepository<typeof tickets, Ticket, NewTicket> {
  constructor(db: DrizzleDB) {
    super(db, tickets);
  }

  findByStatus(status: Ticket['status']): Ticket[] {
    return this.db.select().from(tickets).where(eq(tickets.status, status)).all();
  }

  findByEpicId(epicId: string): Ticket[] {
    return this.db.select().from(tickets).where(eq(tickets.epicId, epicId)).all();
  }

  findByAgentId(agentId: string): Ticket[] {
    return this.db.select().from(tickets).where(eq(tickets.assignedAgentId, agentId)).all();
  }
}
