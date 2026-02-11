import { eq } from 'drizzle-orm';
import { agents, type Agent, type NewAgent } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import { BaseRepository } from './base.repository.js';

export class AgentRepository extends BaseRepository<typeof agents, Agent, NewAgent> {
  constructor(db: DrizzleDB) {
    super(db, agents);
  }

  findByRole(role: Agent['role']): Agent[] {
    return this.db.select().from(agents).where(eq(agents.role, role)).all();
  }

  findByStatus(status: Agent['status']): Agent[] {
    return this.db.select().from(agents).where(eq(agents.status, status)).all();
  }
}
