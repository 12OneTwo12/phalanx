import {
  getGoalRepository,
  getTicketRepository,
  getAgentRepository,
  getTokenUsageRepository,
} from '@/lib/db';
import { jsonResponse } from '@/lib/api-utils';

/** GET /api/stats — aggregated dashboard statistics */
export async function GET() {
  const goals = getGoalRepository().findAll();
  const tickets = getTicketRepository().findAll();
  const agents = getAgentRepository().findAll();
  const tokenRecords = getTokenUsageRepository().findAll();

  const totalTokens = tokenRecords.reduce(
    (sum, r) => sum + r.inputTokens + r.outputTokens,
    0,
  );
  const totalCost = tokenRecords.reduce((sum, r) => sum + r.estimatedCost, 0);

  return jsonResponse({
    goals: {
      total: goals.length,
      active: goals.filter(g => g.status === 'active').length,
      completed: goals.filter(g => g.status === 'completed').length,
    },
    tickets: {
      total: tickets.length,
      pending: tickets.filter(t => t.status === 'pending_approval' || t.status === 'backlog').length,
      inProgress: tickets.filter(t => t.status === 'assigned' || t.status === 'in_progress').length,
      done: tickets.filter(t => t.status === 'done').length,
      failed: tickets.filter(t => t.status === 'failed' || t.status === 'escalated').length,
    },
    agents: {
      total: agents.length,
      idle: agents.filter(a => a.status === 'idle').length,
      running: agents.filter(a => a.status === 'running').length,
    },
    tokens: {
      total: totalTokens,
      estimatedCost: Math.round(totalCost * 10000) / 10000,
    },
  });
}
