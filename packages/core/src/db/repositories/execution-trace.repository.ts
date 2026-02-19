import { eq } from 'drizzle-orm';
import { executionTraces, type ExecutionTrace, type NewExecutionTrace } from '../schema.js';
import type { DrizzleDB } from '../database.js';
import { BaseRepository } from './base.repository.js';

export class ExecutionTraceRepository extends BaseRepository<typeof executionTraces, ExecutionTrace, NewExecutionTrace> {
  constructor(db: DrizzleDB) {
    super(db, executionTraces);
  }

  findByTicketId(ticketId: string): ExecutionTrace[] {
    return this.db.select().from(executionTraces).where(eq(executionTraces.ticketId, ticketId)).all();
  }

  findByAgentId(agentId: string): ExecutionTrace[] {
    return this.db.select().from(executionTraces).where(eq(executionTraces.agentId, agentId)).all();
  }
}
