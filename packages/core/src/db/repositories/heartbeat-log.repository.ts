import { eq } from 'drizzle-orm';
import { heartbeatLogs, type HeartbeatLog, type NewHeartbeatLog } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import type { Repository } from './types.js';

export class HeartbeatLogRepository implements Repository<HeartbeatLog, NewHeartbeatLog> {
  constructor(private readonly db: DrizzleDB) {}

  findById(id: string): HeartbeatLog | undefined {
    return this.db.select().from(heartbeatLogs).where(eq(heartbeatLogs.id, id)).get();
  }

  findAll(options?: { limit?: number; offset?: number }): HeartbeatLog[] {
    let query = this.db.select().from(heartbeatLogs).$dynamic();
    if (options?.limit) query = query.limit(options.limit);
    if (options?.offset) query = query.offset(options.offset);
    return query.all();
  }

  create(data: NewHeartbeatLog): HeartbeatLog {
    return this.db.insert(heartbeatLogs).values(data).returning().get();
  }

  update(id: string, data: Partial<NewHeartbeatLog>): HeartbeatLog | undefined {
    const results = this.db.update(heartbeatLogs).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(heartbeatLogs.id, id)).returning().all();
    return results[0];
  }

  delete(id: string): boolean {
    const results = this.db.delete(heartbeatLogs).where(eq(heartbeatLogs.id, id)).returning().all();
    return results.length > 0;
  }

  findByStatus(status: HeartbeatLog['status']): HeartbeatLog[] {
    return this.db.select().from(heartbeatLogs).where(eq(heartbeatLogs.status, status)).all();
  }
}
