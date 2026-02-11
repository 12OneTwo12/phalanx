import { eq } from 'drizzle-orm';
import { goals, type Goal, type NewGoal } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import { BaseRepository } from './base.repository.js';

export class GoalRepository extends BaseRepository<typeof goals, Goal, NewGoal> {
  constructor(db: DrizzleDB) {
    super(db, goals);
  }

  findByStatus(status: Goal['status']): Goal[] {
    return this.db.select().from(goals).where(eq(goals.status, status)).all();
  }
}
