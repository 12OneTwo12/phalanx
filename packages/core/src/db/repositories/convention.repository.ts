import { eq } from 'drizzle-orm';
import { conventions, type Convention, type NewConvention } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import { BaseRepository } from './base.repository.js';

export class ConventionRepository extends BaseRepository<typeof conventions, Convention, NewConvention> {
  constructor(db: DrizzleDB) {
    super(db, conventions);
  }

  findByType(type: Convention['type']): Convention | undefined {
    return this.db.select().from(conventions).where(eq(conventions.type, type)).get();
  }
}
