import { eq } from 'drizzle-orm';
import { agents, type Agent, type NewAgent } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import type { Repository } from './types.js';

export class AgentRepository implements Repository<Agent, NewAgent> {
  constructor(private readonly db: DrizzleDB) {}

  findById(id: string): Agent | undefined {
    return this.db.select().from(agents).where(eq(agents.id, id)).get();
  }

  findAll(options?: { limit?: number; offset?: number }): Agent[] {
    let query = this.db.select().from(agents).$dynamic();
    if (options?.limit) query = query.limit(options.limit);
    if (options?.offset) query = query.offset(options.offset);
    return query.all();
  }

  create(data: NewAgent): Agent {
    return this.db.insert(agents).values(data).returning().get();
  }

  update(id: string, data: Partial<NewAgent>): Agent | undefined {
    const results = this.db.update(agents).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(agents.id, id)).returning().all();
    return results[0];
  }

  delete(id: string): boolean {
    const results = this.db.delete(agents).where(eq(agents.id, id)).returning().all();
    return results.length > 0;
  }

  findByRole(role: Agent['role']): Agent[] {
    return this.db.select().from(agents).where(eq(agents.role, role)).all();
  }

  findByStatus(status: Agent['status']): Agent[] {
    return this.db.select().from(agents).where(eq(agents.status, status)).all();
  }
}
