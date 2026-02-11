import { eq } from 'drizzle-orm';
import { reverseProposals, type ReverseProposal, type NewReverseProposal } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import type { Repository } from './types.js';

export class ReverseProposalRepository implements Repository<ReverseProposal, NewReverseProposal> {
  constructor(private readonly db: DrizzleDB) {}

  findById(id: string): ReverseProposal | undefined {
    return this.db.select().from(reverseProposals).where(eq(reverseProposals.id, id)).get();
  }

  findAll(options?: { limit?: number; offset?: number }): ReverseProposal[] {
    let query = this.db.select().from(reverseProposals).$dynamic();
    if (options?.limit) query = query.limit(options.limit);
    if (options?.offset) query = query.offset(options.offset);
    return query.all();
  }

  create(data: NewReverseProposal): ReverseProposal {
    return this.db.insert(reverseProposals).values(data).returning().get();
  }

  update(id: string, data: Partial<NewReverseProposal>): ReverseProposal | undefined {
    const results = this.db.update(reverseProposals).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(reverseProposals.id, id)).returning().all();
    return results[0];
  }

  delete(id: string): boolean {
    const results = this.db.delete(reverseProposals).where(eq(reverseProposals.id, id)).returning().all();
    return results.length > 0;
  }

  findByAgentId(agentId: string): ReverseProposal[] {
    return this.db.select().from(reverseProposals).where(eq(reverseProposals.agentId, agentId)).all();
  }

  findByStatus(status: ReverseProposal['status']): ReverseProposal[] {
    return this.db.select().from(reverseProposals).where(eq(reverseProposals.status, status)).all();
  }
}
