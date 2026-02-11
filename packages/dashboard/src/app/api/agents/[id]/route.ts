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

/** PATCH /api/agents/:id */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await parseBody<Record<string, unknown>>(request);
  if (!body) return errorResponse('Invalid JSON body');

  const repo = getAgentRepository();
  const updated = repo.update(id, body);
  if (!updated) return errorResponse('Agent not found', 404);
  return jsonResponse(updated);
}

/** DELETE /api/agents/:id */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const repo = getAgentRepository();
  const deleted = repo.delete(id);
  if (!deleted) return errorResponse('Agent not found', 404);
  return jsonResponse({ success: true });
}
