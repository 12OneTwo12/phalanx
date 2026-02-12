import { eq, and, gte, lte } from 'drizzle-orm';
import { workLogs, type WorkLog, type NewWorkLog } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import { BaseRepository } from './base.repository.js';

export class WorkLogRepository extends BaseRepository<typeof workLogs, WorkLog, NewWorkLog> {
  constructor(db: DrizzleDB) {
    super(db, workLogs);
  }

  findByAgentId(agentId: string): WorkLog[] {
    return this.db.select().from(workLogs).where(eq(workLogs.agentId, agentId)).all();
  }

  findByDate(date: string): WorkLog[] {
    return this.db.select().from(workLogs).where(eq(workLogs.date, date)).all();
  }

  findByDateRange(startDate: string, endDate: string): WorkLog[] {
    return this.db.select().from(workLogs)
      .where(and(gte(workLogs.date, startDate), lte(workLogs.date, endDate)))
      .all();
  }
}
