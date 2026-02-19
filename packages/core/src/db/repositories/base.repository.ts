/**
 * Base repository class that handles common CRUD operations.
 * Specific repositories extend this to add domain-specific query methods.
 *
 * Note: The `as any` casts in this class are a necessary trade-off due to
 * drizzle-orm's complex generic table types which resist full generic
 * abstraction. Each concrete repository is still fully type-safe at its
 * public API boundary via TSelect / TInsert.
 */
import { eq, desc, asc } from 'drizzle-orm';
import type { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';
import type { DrizzleDB } from '../database.js';
import type { Repository } from './types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- required for drizzle-orm generic table abstraction
type AnySQLiteTable = SQLiteTableWithColumns<any>;

/**
 * Generic base repository for drizzle-orm SQLite tables with an `id` text primary key.
 * Subclasses only need to provide the table reference and can add custom finders.
 */
export abstract class BaseRepository<
  TTable extends AnySQLiteTable,
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

  findAll(options?: { limit?: number; offset?: number; orderBy?: 'asc' | 'desc' }): TSelect[] {
    let query = (this.db.select().from(this.table) as any).$dynamic();
    if (options?.orderBy && (this.table as any).createdAt) {
      const col = (this.table as any).createdAt;
      query = query.orderBy(options.orderBy === 'desc' ? desc(col) : asc(col));
    }
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
