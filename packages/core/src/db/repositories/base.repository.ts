/**
 * Base repository class that handles common CRUD operations.
 * Specific repositories extend this to add domain-specific query methods.
 */
import { eq } from 'drizzle-orm';
import type { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';
import type { DrizzleDB } from '../database.js';
import type { Repository } from './types.js';

/**
 * Generic base repository for drizzle-orm SQLite tables with an `id` text primary key.
 * Subclasses only need to provide the table reference and can add custom finders.
 */
export abstract class BaseRepository<
  TTable extends SQLiteTableWithColumns<any>,
  TSelect extends Record<string, unknown>,
  TInsert extends Record<string, unknown>,
> implements Repository<TSelect, TInsert> {
  constructor(
    protected readonly db: DrizzleDB,
    protected readonly table: TTable,
  ) {}

  findById(id: string): TSelect | undefined {
    return (this.db.select().from(this.table) as any).where(eq((this.table as any).id, id)).get() as TSelect | undefined;
  }

  findAll(options?: { limit?: number; offset?: number }): TSelect[] {
    let query = (this.db.select().from(this.table) as any).$dynamic();
    if (options?.limit) query = query.limit(options.limit);
    if (options?.offset) query = query.offset(options.offset);
    return query.all() as TSelect[];
  }

  create(data: TInsert): TSelect {
    return (this.db.insert(this.table).values(data as any) as any).returning().get() as TSelect;
  }

  update(id: string, data: Partial<TInsert>): TSelect | undefined {
    const results = (this.db.update(this.table).set({ ...data, updatedAt: new Date().toISOString() } as any) as any)
      .where(eq((this.table as any).id, id))
      .returning()
      .all() as TSelect[];
    return results[0];
  }

  delete(id: string): boolean {
    const results = (this.db.delete(this.table) as any).where(eq((this.table as any).id, id)).returning().all();
    return results.length > 0;
  }
}
