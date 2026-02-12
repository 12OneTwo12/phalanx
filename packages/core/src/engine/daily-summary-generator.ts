/**
 * DailySummaryGenerator — aggregates work logs into structured daily summaries.
 */
import type { WorkLogRepository } from '../db/repositories/work-log.repository.js';
import type { WorkLog } from '../db/schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentDailySummary {
  agentId: string;
  ticketsWorked: string[];
  started: number;
  progressed: number;
  completed: number;
  blocked: number;
  entries: WorkLog[];
}

export interface DailySummary {
  date: string;
  totalEntries: number;
  agentSummaries: AgentDailySummary[];
}

// ---------------------------------------------------------------------------
// DailySummaryGenerator
// ---------------------------------------------------------------------------

export class DailySummaryGenerator {
  constructor(private readonly workLogRepo: WorkLogRepository) {}

  /** Generate a summary for a specific date. */
  generateForDate(date: string): DailySummary {
    const logs = this.workLogRepo.findByDate(date);
    return this.aggregate(date, logs);
  }

  /** Aggregate logs into a structured summary. */
  private aggregate(date: string, logs: WorkLog[]): DailySummary {
    const byAgent = new Map<string, WorkLog[]>();
    for (const log of logs) {
      const key = log.agentId ?? 'system';
      const existing = byAgent.get(key) ?? [];
      existing.push(log);
      byAgent.set(key, existing);
    }

    const agentSummaries: AgentDailySummary[] = [];
    for (const [agentId, entries] of byAgent) {
      const ticketIds = new Set<string>();
      let started = 0;
      let progressed = 0;
      let completed = 0;
      let blocked = 0;

      for (const entry of entries) {
        if (entry.ticketId) ticketIds.add(entry.ticketId);
        switch (entry.action) {
          case 'started': started++; break;
          case 'progressed': progressed++; break;
          case 'completed': completed++; break;
          case 'blocked': blocked++; break;
        }
      }

      agentSummaries.push({
        agentId,
        ticketsWorked: [...ticketIds],
        started,
        progressed,
        completed,
        blocked,
        entries,
      });
    }

    return { date, totalEntries: logs.length, agentSummaries };
  }
}
