import { eq } from 'drizzle-orm';
import { activityLogs, type ActivityLog, type NewActivityLog } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import { BaseRepository } from './base.repository.js';

export class ActivityLogRepository extends BaseRepository<typeof activityLogs, ActivityLog, NewActivityLog> {
  constructor(db: DrizzleDB) {
    super(db, activityLogs);
  }

  findByAgentId(agentId: string): ActivityLog[] {
    return this.db.select().from(activityLogs).where(eq(activityLogs.agentId, agentId)).all();
  }

  findByTicketId(ticketId: string): ActivityLog[] {
    return this.db.select().from(activityLogs).where(eq(activityLogs.ticketId, ticketId)).all();
  }
}
