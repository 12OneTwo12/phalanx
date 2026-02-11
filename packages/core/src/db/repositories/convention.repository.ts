import { eq } from 'drizzle-orm';
import { conventions, type Convention, type NewConvention } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import type { Repository } from './types.js';

export class ConventionRepository implements Repository<Convention, NewConvention> {
  constructor(private readonly db: DrizzleDB) {}

  findById(id: string): Convention | undefined {
    return this.db.select().from(conventions).where(eq(conventions.id, id)).get();
  }

  findAll(options?: { limit?: number; offset?: number }): Convention[] {
    let query = this.db.select().from(conventions).$dynamic();
    if (options?.limit) query = query.limit(options.limit);
    if (options?.offset) query = query.offset(options.offset);
    return query.all();
  }

  create(data: NewConvention): Convention {
    return this.db.insert(conventions).values(data).returning().get();
  }

  update(id: string, data: Partial<NewConvention>): Convention | undefined {
    const results = this.db.update(conventions).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(conventions.id, id)).returning().all();
    return results[0];
  }

  delete(id: string): boolean {
    const results = this.db.delete(conventions).where(eq(conventions.id, id)).returning().all();
    return results.length > 0;
  }

  findByType(type: Convention['type']): Convention | undefined {
    return this.db.select().from(conventions).where(eq(conventions.type, type)).get();
  }
}
