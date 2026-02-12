import { getWorkLogRepository } from '@/lib/db';
import { jsonResponse, errorResponse } from '@/lib/api-utils';

interface AgentSummary {
  agentId: string;
  ticketsWorked: string[];
  started: number;
  progressed: number;
  completed: number;
  blocked: number;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get('date');
  if (!date) return errorResponse('date query parameter is required (YYYY-MM-DD)');

  const repo = getWorkLogRepository();
  const logs = repo.findByDate(date);

  // Aggregate by agent
  const byAgent = new Map<string, typeof logs>();
  for (const log of logs) {
    const key = log.agentId ?? 'system';
    const existing = byAgent.get(key) ?? [];
    existing.push(log);
    byAgent.set(key, existing);
  }

  const agentSummaries: AgentSummary[] = [];
  for (const [agentId, entries] of byAgent) {
    const ticketIds = new Set<string>();
    let started = 0, progressed = 0, completed = 0, blocked = 0;

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
      started, progressed, completed, blocked,
    });
  }

  return jsonResponse({ date, totalEntries: logs.length, agentSummaries });
}
