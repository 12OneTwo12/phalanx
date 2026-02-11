import { eq } from 'drizzle-orm';
import { tokenUsage, type TokenUsageRecord, type NewTokenUsageRecord } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import { BaseRepository } from './base.repository.js';

export class TokenUsageRepository extends BaseRepository<typeof tokenUsage, TokenUsageRecord, NewTokenUsageRecord> {
  constructor(db: DrizzleDB) {
    super(db, tokenUsage);
  }

  findByAgentId(agentId: string): TokenUsageRecord[] {
    return this.db.select().from(tokenUsage).where(eq(tokenUsage.agentId, agentId)).all();
  }

  findByGoalId(goalId: string): TokenUsageRecord[] {
    return this.db.select().from(tokenUsage).where(eq(tokenUsage.goalId, goalId)).all();
  }
}
