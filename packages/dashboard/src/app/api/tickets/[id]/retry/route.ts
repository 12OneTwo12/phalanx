import { getTicketRepository, getAgentRepository } from '@/lib/db';
import { jsonResponse, errorResponse } from '@/lib/api-utils';
import { TicketStateMachine } from '@phalanx/core';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** POST /api/tickets/:id/retry — reset a failed ticket to backlog for reassignment */
export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const ticketRepo = getTicketRepository();
  const ticket = ticketRepo.findById(id);

  if (!ticket) return errorResponse('Ticket not found', 404);
  if (ticket.status !== 'failed') {
    return errorResponse(`Cannot retry ticket in "${ticket.status}" status`, 400);
  }

  // Transition failed → backlog via 'reset' action
  const newStatus = TicketStateMachine.transition('failed', 'reset');

  // Release the assigned agent if any
  if (ticket.assignedAgentId) {
    const agentRepo = getAgentRepository();
    agentRepo.update(ticket.assignedAgentId, { currentTicketId: null, status: 'idle' });
  }

  // Reset ticket to backlog, clear assignment
  const updated = ticketRepo.update(id, {
    status: newStatus,
    assignedAgentId: null,
    retryCount: 0,
  });

  return jsonResponse(updated);
}
