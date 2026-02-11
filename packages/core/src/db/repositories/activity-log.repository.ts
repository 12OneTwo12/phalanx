import { eq } from 'drizzle-orm';
import { activityLogs, type ActivityLog, type NewActivityLog } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import type { Repository } from './types.js';

export class ActivityLogRepository implements Repository<ActivityLog, NewActivityLog> {
  constructor(private readonly db: DrizzleDB) {}

  findById(id: string): ActivityLog | undefined {
    return this.db.select().from(activityLogs).where(eq(activityLogs.id, id)).get();
  }

  findAll(options?: { limit?: number; offset?: number }): ActivityLog[] {
    let query = this.db.select().from(activityLogs).$dynamic();
    if (options?.limit) query = query.limit(options.limit);
    if (options?.offset) query = query.offset(options.offset);
    return query.all();
  }

  create(data: NewActivityLog): ActivityLog {
    return this.db.insert(activityLogs).values(data).returning().get();
  }

  update(id: string, data: Partial<NewActivityLog>): ActivityLog | undefined {
    const results = this.db.update(activityLogs).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(activityLogs.id, id)).returning().all();
    return results[0];
  }

  delete(id: string): boolean {
    const results = this.db.delete(activityLogs).where(eq(activityLogs.id, id)).returning().all();
    return results.length > 0;
  }

  findByAgentId(agentId: string): ActivityLog[] {
    return this.db.select().from(activityLogs).where(eq(activityLogs.agentId, agentId)).all();
  }

  findByTicketId(ticketId: string): ActivityLog[] {
    return this.db.select().from(activityLogs).where(eq(activityLogs.ticketId, ticketId)).all();
  }
}
