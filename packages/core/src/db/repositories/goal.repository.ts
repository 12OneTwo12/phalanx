import { eq } from 'drizzle-orm';
import { goals, type Goal, type NewGoal } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import type { Repository } from './types.js';

export class GoalRepository implements Repository<Goal, NewGoal> {
  constructor(private readonly db: DrizzleDB) {}

  findById(id: string): Goal | undefined {
    return this.db.select().from(goals).where(eq(goals.id, id)).get();
  }

  findAll(options?: { limit?: number; offset?: number }): Goal[] {
    let query = this.db.select().from(goals).$dynamic();
    if (options?.limit) query = query.limit(options.limit);
    if (options?.offset) query = query.offset(options.offset);
    return query.all();
  }

  create(data: NewGoal): Goal {
    return this.db.insert(goals).values(data).returning().get();
  }

  update(id: string, data: Partial<NewGoal>): Goal | undefined {
    const results = this.db.update(goals).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(goals.id, id)).returning().all();
    return results[0];
  }

  delete(id: string): boolean {
    const results = this.db.delete(goals).where(eq(goals.id, id)).returning().all();
    return results.length > 0;
  }

  findByStatus(status: Goal['status']): Goal[] {
    return this.db.select().from(goals).where(eq(goals.status, status)).all();
  }
}
