import { eq } from 'drizzle-orm';
import { debateArguments, type DebateArgument, type NewDebateArgument } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import { BaseRepository } from './base.repository.js';

export class DebateArgumentRepository extends BaseRepository<typeof debateArguments, DebateArgument, NewDebateArgument> {
  constructor(db: DrizzleDB) {
    super(db, debateArguments);
  }

  findByDebateId(debateId: string): DebateArgument[] {
    return this.db.select().from(debateArguments).where(eq(debateArguments.debateId, debateId)).all();
  }

  findByAgentId(agentId: string): DebateArgument[] {
    return this.db.select().from(debateArguments).where(eq(debateArguments.agentId, agentId)).all();
  }
}
