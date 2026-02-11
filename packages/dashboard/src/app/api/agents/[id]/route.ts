import { getAgentRepository } from '@/lib/db';
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/agents/:id */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const repo = getAgentRepository();
  const agent = repo.findById(id);
  if (!agent) return errorResponse('Agent not found', 404);
  return jsonResponse(agent);
}

/** Allowed fields for agent PATCH updates */
const AGENT_UPDATABLE_FIELDS = new Set([
  'name', 'status', 'provider', 'model', 'currentTicketId', 'thinkingLevel',
]);

/** PATCH /api/agents/:id */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await parseBody<Record<string, unknown>>(request);
  if (!body) return errorResponse('Invalid JSON body');

  // Only allow known fields to prevent arbitrary field injection
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (AGENT_UPDATABLE_FIELDS.has(key)) {
      sanitized[key] = value;
    }
  }
  if (Object.keys(sanitized).length === 0) {
    return errorResponse('No valid fields to update');
  }

  const repo = getAgentRepository();
  try {
    const updated = repo.update(id, sanitized);
    if (!updated) return errorResponse('Agent not found', 404);
    return jsonResponse(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[PATCH /api/agents/${id}]`, message);
    return errorResponse(`Failed to update agent: ${message}`, 500);
  }
}

/** DELETE /api/agents/:id */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const repo = getAgentRepository();
  const deleted = repo.delete(id);
  if (!deleted) return errorResponse('Agent not found', 404);
  return jsonResponse({ success: true });
}
