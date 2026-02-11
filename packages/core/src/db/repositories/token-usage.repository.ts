import { eq } from 'drizzle-orm';
import { tokenUsage, type TokenUsageRecord, type NewTokenUsageRecord } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import type { Repository } from './types.js';

export class TokenUsageRepository implements Repository<TokenUsageRecord, NewTokenUsageRecord> {
  constructor(private readonly db: DrizzleDB) {}

  findById(id: string): TokenUsageRecord | undefined {
    return this.db.select().from(tokenUsage).where(eq(tokenUsage.id, id)).get();
  }

  findAll(options?: { limit?: number; offset?: number }): TokenUsageRecord[] {
    let query = this.db.select().from(tokenUsage).$dynamic();
    if (options?.limit) query = query.limit(options.limit);
    if (options?.offset) query = query.offset(options.offset);
    return query.all();
  }

  create(data: NewTokenUsageRecord): TokenUsageRecord {
    return this.db.insert(tokenUsage).values(data).returning().get();
  }

  update(id: string, data: Partial<NewTokenUsageRecord>): TokenUsageRecord | undefined {
    const results = this.db.update(tokenUsage).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(tokenUsage.id, id)).returning().all();
    return results[0];
  }

  delete(id: string): boolean {
    const results = this.db.delete(tokenUsage).where(eq(tokenUsage.id, id)).returning().all();
    return results.length > 0;
  }

  findByAgentId(agentId: string): TokenUsageRecord[] {
    return this.db.select().from(tokenUsage).where(eq(tokenUsage.agentId, agentId)).all();
  }

  findByGoalId(goalId: string): TokenUsageRecord[] {
    return this.db.select().from(tokenUsage).where(eq(tokenUsage.goalId, goalId)).all();
  }
}
