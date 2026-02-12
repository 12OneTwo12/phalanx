import { eq } from 'drizzle-orm';
import { knowledgeEntries, type KnowledgeEntry, type NewKnowledgeEntry } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import { BaseRepository } from './base.repository.js';

export class KnowledgeEntryRepository extends BaseRepository<typeof knowledgeEntries, KnowledgeEntry, NewKnowledgeEntry> {
  constructor(db: DrizzleDB) {
    super(db, knowledgeEntries);
  }

  findByCategory(category: KnowledgeEntry['category']): KnowledgeEntry[] {
    return this.db.select().from(knowledgeEntries).where(eq(knowledgeEntries.category, category)).all();
  }
}
