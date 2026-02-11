import { eq } from 'drizzle-orm';
import { proposals, type Proposal, type NewProposal } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import { BaseRepository } from './base.repository.js';

export class ProposalRepository extends BaseRepository<typeof proposals, Proposal, NewProposal> {
  constructor(db: DrizzleDB) {
    super(db, proposals);
  }

  findByStatus(status: Proposal['status']): Proposal[] {
    return this.db.select().from(proposals).where(eq(proposals.status, status)).all();
  }
}
