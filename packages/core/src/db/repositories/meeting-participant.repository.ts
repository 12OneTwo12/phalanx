import { eq } from 'drizzle-orm';
import { meetingParticipants, type MeetingParticipant, type NewMeetingParticipant } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import { BaseRepository } from './base.repository.js';

export class MeetingParticipantRepository extends BaseRepository<typeof meetingParticipants, MeetingParticipant, NewMeetingParticipant> {
  constructor(db: DrizzleDB) {
    super(db, meetingParticipants);
  }

  findByMeetingId(meetingId: string): MeetingParticipant[] {
    return this.db.select().from(meetingParticipants).where(eq(meetingParticipants.meetingId, meetingId)).all();
  }

  findByAgentId(agentId: string): MeetingParticipant[] {
    return this.db.select().from(meetingParticipants).where(eq(meetingParticipants.agentId, agentId)).all();
  }
}
