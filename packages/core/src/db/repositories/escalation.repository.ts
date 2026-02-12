import { eq } from 'drizzle-orm';
import { escalations, type Escalation, type NewEscalation } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import { BaseRepository } from './base.repository.js';

export class EscalationRepository extends BaseRepository<typeof escalations, Escalation, NewEscalation> {
  constructor(db: DrizzleDB) {
    super(db, escalations);
  }

  findByStatus(status: Escalation['status']): Escalation[] {
    return this.db.select().from(escalations).where(eq(escalations.status, status)).all();
  }

  findPending(): Escalation[] {
    return this.findByStatus('pending');
  }
}
