import { eq } from 'drizzle-orm';
import { debates, type Debate, type NewDebate } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import { BaseRepository } from './base.repository.js';

export class DebateRepository extends BaseRepository<typeof debates, Debate, NewDebate> {
  constructor(db: DrizzleDB) {
    super(db, debates);
  }

  findByStatus(status: Debate['status']): Debate[] {
    return this.db.select().from(debates).where(eq(debates.status, status)).all();
  }

  findByRoleGroup(roleGroup: string): Debate[] {
    return this.db.select().from(debates).where(eq(debates.roleGroup, roleGroup)).all();
  }
}
