import { eq } from 'drizzle-orm';
import { meetings, type Meeting, type NewMeeting } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import { BaseRepository } from './base.repository.js';

export class MeetingRepository extends BaseRepository<typeof meetings, Meeting, NewMeeting> {
  constructor(db: DrizzleDB) {
    super(db, meetings);
  }

  findByStatus(status: Meeting['status']): Meeting[] {
    return this.db.select().from(meetings).where(eq(meetings.status, status)).all();
  }

  findByType(type: Meeting['type']): Meeting[] {
    return this.db.select().from(meetings).where(eq(meetings.type, type)).all();
  }
}
