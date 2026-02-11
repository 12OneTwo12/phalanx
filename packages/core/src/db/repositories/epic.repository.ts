import { eq } from 'drizzle-orm';
import { epics, type Epic, type NewEpic } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import type { Repository } from './types.js';

export class EpicRepository implements Repository<Epic, NewEpic> {
  constructor(private readonly db: DrizzleDB) {}

  findById(id: string): Epic | undefined {
    return this.db.select().from(epics).where(eq(epics.id, id)).get();
  }

  findAll(options?: { limit?: number; offset?: number }): Epic[] {
    let query = this.db.select().from(epics).$dynamic();
    if (options?.limit) query = query.limit(options.limit);
    if (options?.offset) query = query.offset(options.offset);
    return query.all();
  }

  create(data: NewEpic): Epic {
    return this.db.insert(epics).values(data).returning().get();
  }

  update(id: string, data: Partial<NewEpic>): Epic | undefined {
    const results = this.db.update(epics).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(epics.id, id)).returning().all();
    return results[0];
  }

  delete(id: string): boolean {
    const results = this.db.delete(epics).where(eq(epics.id, id)).returning().all();
    return results.length > 0;
  }

  findByGoalId(goalId: string): Epic[] {
    return this.db.select().from(epics).where(eq(epics.goalId, goalId)).all();
  }
}
