import { eq } from 'drizzle-orm';
import { tickets, type Ticket, type NewTicket } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import type { Repository } from './types.js';

export class TicketRepository implements Repository<Ticket, NewTicket> {
  constructor(private readonly db: DrizzleDB) {}

  findById(id: string): Ticket | undefined {
    return this.db.select().from(tickets).where(eq(tickets.id, id)).get();
  }

  findAll(options?: { limit?: number; offset?: number }): Ticket[] {
    let query = this.db.select().from(tickets).$dynamic();
    if (options?.limit) query = query.limit(options.limit);
    if (options?.offset) query = query.offset(options.offset);
    return query.all();
  }

  create(data: NewTicket): Ticket {
    return this.db.insert(tickets).values(data).returning().get();
  }

  update(id: string, data: Partial<NewTicket>): Ticket | undefined {
    const results = this.db.update(tickets).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(tickets.id, id)).returning().all();
    return results[0];
  }

  delete(id: string): boolean {
    const results = this.db.delete(tickets).where(eq(tickets.id, id)).returning().all();
    return results.length > 0;
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
