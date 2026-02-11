import { getTicketRepository } from '@/lib/db';
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/tickets/:id */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const repo = getTicketRepository();
  const ticket = repo.findById(id);
  if (!ticket) return errorResponse('Ticket not found', 404);
  return jsonResponse(ticket);
}

/** Allowed fields for ticket PATCH updates */
const TICKET_UPDATABLE_FIELDS = new Set([
  'status', 'priority', 'assignedAgentId', 'approvedAt', 'branch', 'prUrl', 'retryCount',
]);

/** PATCH /api/tickets/:id — update ticket fields (status, priority, assignment, etc.) */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await parseBody<Record<string, unknown>>(request);
  if (!body) return errorResponse('Invalid JSON body');

  // Only allow known fields to prevent arbitrary field injection
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (TICKET_UPDATABLE_FIELDS.has(key)) {
      sanitized[key] = value;
    }
  }
  if (Object.keys(sanitized).length === 0) {
    return errorResponse('No valid fields to update');
  }

  const repo = getTicketRepository();
  try {
    const updated = repo.update(id, sanitized);
    if (!updated) return errorResponse('Ticket not found', 404);
    return jsonResponse(updated);
  } catch (err) {
    return errorResponse('Failed to update ticket', 500);
  }
}

/** DELETE /api/tickets/:id */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const repo = getTicketRepository();
  const deleted = repo.delete(id);
  if (!deleted) return errorResponse('Ticket not found', 404);
  return jsonResponse({ success: true });
}
