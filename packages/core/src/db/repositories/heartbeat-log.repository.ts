import { eq } from 'drizzle-orm';
import { heartbeatLogs, type HeartbeatLog, type NewHeartbeatLog } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import { BaseRepository } from './base.repository.js';

export class HeartbeatLogRepository extends BaseRepository<typeof heartbeatLogs, HeartbeatLog, NewHeartbeatLog> {
  constructor(db: DrizzleDB) {
    super(db, heartbeatLogs);
  }

  findByStatus(status: HeartbeatLog['status']): HeartbeatLog[] {
    return this.db.select().from(heartbeatLogs).where(eq(heartbeatLogs.status, status)).all();
  }
}
