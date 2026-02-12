import { eq } from 'drizzle-orm';
import { decisionRecords, type DecisionRecord, type NewDecisionRecord } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import { BaseRepository } from './base.repository.js';

export class DecisionRecordRepository extends BaseRepository<typeof decisionRecords, DecisionRecord, NewDecisionRecord> {
  constructor(db: DrizzleDB) {
    super(db, decisionRecords);
  }

  findByTicketId(ticketId: string): DecisionRecord[] {
    return this.db.select().from(decisionRecords).where(eq(decisionRecords.relatedTicketId, ticketId)).all();
  }
}
