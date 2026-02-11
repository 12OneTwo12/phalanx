import { eq } from 'drizzle-orm';
import { epics, type Epic, type NewEpic } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import { BaseRepository } from './base.repository.js';

export class EpicRepository extends BaseRepository<typeof epics, Epic, NewEpic> {
  constructor(db: DrizzleDB) {
    super(db, epics);
  }

  findByGoalId(goalId: string): Epic[] {
    return this.db.select().from(epics).where(eq(epics.goalId, goalId)).all();
  }
}
