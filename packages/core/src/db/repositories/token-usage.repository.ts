import { eq } from 'drizzle-orm';
import { tokenUsage, type TokenUsageRow, type NewTokenUsageRow } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import { BaseRepository } from './base.repository.js';

export class TokenUsageRepository extends BaseRepository<typeof tokenUsage, TokenUsageRow, NewTokenUsageRow> {
  constructor(db: DrizzleDB) {
    super(db, tokenUsage);
  }

  findByAgentId(agentId: string): TokenUsageRow[] {
    return this.db.select().from(tokenUsage).where(eq(tokenUsage.agentId, agentId)).all();
  }

  findByGoalId(goalId: string): TokenUsageRow[] {
    return this.db.select().from(tokenUsage).where(eq(tokenUsage.goalId, goalId)).all();
  }
}
