import {
  getAgentRepository,
  getTicketRepository,
  getTokenUsageRepository,
} from '@/lib/db';
import { jsonResponse, errorResponse } from '@/lib/api-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/agents/:id/stats — get performance statistics for an agent */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const agentRepo = getAgentRepository();
  const agent = agentRepo.findById(id);
  if (!agent) {
    return errorResponse('Agent not found', 404);
  }

  const ticketRepo = getTicketRepository();
  const tokenRepo = getTokenUsageRepository();

  // Get tickets assigned to this agent (use indexed query instead of full scan)
  const agentTickets = ticketRepo.findByAgentId(id);

  const completed = agentTickets.filter((t) => t.status === 'done');
  const failed = agentTickets.filter((t) => t.status === 'failed' || t.status === 'escalated');
  const inProgress = agentTickets.filter((t) => t.status === 'in_progress' || t.status === 'verification');

  // Token usage for this agent
  const agentTokenUsage = tokenRepo.findByAgentId(id);
  const totalInputTokens = agentTokenUsage.reduce((sum, r) => sum + (r.inputTokens ?? 0), 0);
  const totalOutputTokens = agentTokenUsage.reduce((sum, r) => sum + (r.outputTokens ?? 0), 0);

  return jsonResponse({
    agentId: id,
    agentName: agent.name,
    role: agent.role,
    ticketStats: {
      total: agentTickets.length,
      completed: completed.length,
      failed: failed.length,
      inProgress: inProgress.length,
      successRate: agentTickets.length > 0
        ? Math.round((completed.length / agentTickets.length) * 100)
        : 0,
    },
    tokenUsage: {
      totalInputTokens,
      totalOutputTokens,
      totalRequests: agentTokenUsage.length,
    },
    lastActivity: agent.updatedAt,
  });
}
