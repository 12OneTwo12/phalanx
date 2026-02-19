/**
 * Generic repository interface for CRUD operations.
 * All repositories implement this contract for consistency.
 */
export interface Repository<T, TNew> {
  /** Find a record by its primary key */
  findById(id: string): T | undefined;

  /** Find all records, optionally with a limit, offset, and sort order */
  findAll(options?: { limit?: number; offset?: number; orderBy?: 'asc' | 'desc' }): T[];

  /** Create a new record and return it */
  create(data: TNew): T;

  /** Update an existing record by ID. Returns the updated record or undefined if not found. */
  update(id: string, data: Partial<TNew>): T | undefined;

  /** Delete a record by ID. Returns true if deleted, false if not found. */
  delete(id: string): boolean;
}
