import { eq } from 'drizzle-orm';
import { proposals, type Proposal, type NewProposal } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import type { Repository } from './types.js';

export class ProposalRepository implements Repository<Proposal, NewProposal> {
  constructor(private readonly db: DrizzleDB) {}

  findById(id: string): Proposal | undefined {
    return this.db.select().from(proposals).where(eq(proposals.id, id)).get();
  }

  findAll(options?: { limit?: number; offset?: number }): Proposal[] {
    let query = this.db.select().from(proposals).$dynamic();
    if (options?.limit) query = query.limit(options.limit);
    if (options?.offset) query = query.offset(options.offset);
    return query.all();
  }

  create(data: NewProposal): Proposal {
    return this.db.insert(proposals).values(data).returning().get();
  }

  update(id: string, data: Partial<NewProposal>): Proposal | undefined {
    const results = this.db.update(proposals).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(proposals.id, id)).returning().all();
    return results[0];
  }

  delete(id: string): boolean {
    const results = this.db.delete(proposals).where(eq(proposals.id, id)).returning().all();
    return results.length > 0;
  }

  findByStatus(status: Proposal['status']): Proposal[] {
    return this.db.select().from(proposals).where(eq(proposals.status, status)).all();
  }
}
