import { getAgentRepository, getWorkLogRepository, getTicketRepository } from '@/lib/db';
import { jsonResponse, errorResponse } from '@/lib/api-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/agents/:id/activity — get recent activity for an agent */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const agentRepo = getAgentRepository();
  const agent = agentRepo.findById(id);
  if (!agent) {
    return errorResponse('Agent not found', 404);
  }

  const workLogRepo = getWorkLogRepository();
  const ticketRepo = getTicketRepository();

  // Get work logs for this agent
  const workLogs = workLogRepo.findByAgentId(id);

  // Get tickets assigned to this agent (use indexed query instead of full scan)
  const agentTickets = ticketRepo.findByAgentId(id);

  return jsonResponse({
    agent: {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      status: agent.status,
      currentTicketId: agent.currentTicketId,
    },
    recentWorkLogs: workLogs.slice(0, 20),
    assignedTickets: agentTickets.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
    })),
  });
}
