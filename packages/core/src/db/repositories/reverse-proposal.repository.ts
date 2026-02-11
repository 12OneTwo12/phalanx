import { eq } from 'drizzle-orm';
import { reverseProposals, type ReverseProposal, type NewReverseProposal } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import { BaseRepository } from './base.repository.js';

export class ReverseProposalRepository extends BaseRepository<typeof reverseProposals, ReverseProposal, NewReverseProposal> {
  constructor(db: DrizzleDB) {
    super(db, reverseProposals);
  }

  findByAgentId(agentId: string): ReverseProposal[] {
    return this.db.select().from(reverseProposals).where(eq(reverseProposals.agentId, agentId)).all();
  }

  findByStatus(status: ReverseProposal['status']): ReverseProposal[] {
    return this.db.select().from(reverseProposals).where(eq(reverseProposals.status, status)).all();
  }
}
