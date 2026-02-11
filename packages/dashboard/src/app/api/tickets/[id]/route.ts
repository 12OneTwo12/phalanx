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

/** PATCH /api/tickets/:id — update ticket fields (status, priority, assignment, etc.) */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await parseBody<Record<string, unknown>>(request);
  if (!body) return errorResponse('Invalid JSON body');

  const repo = getTicketRepository();
  const updated = repo.update(id, body);
  if (!updated) return errorResponse('Ticket not found', 404);
  return jsonResponse(updated);
}

/** DELETE /api/tickets/:id */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const repo = getTicketRepository();
  const deleted = repo.delete(id);
  if (!deleted) return errorResponse('Ticket not found', 404);
  return jsonResponse({ success: true });
}
