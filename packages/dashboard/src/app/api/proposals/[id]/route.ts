import { getProposalRepository } from '@/lib/db';
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-utils';
import { eventBus } from '@/lib/event-bus';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** PATCH /api/proposals/:id — approve or reject a proposal */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await parseBody<{ status: 'approved' | 'rejected' }>(request);
  if (!body?.status || !['approved', 'rejected'].includes(body.status)) {
    return errorResponse('status must be "approved" or "rejected"');
  }

  const repo = getProposalRepository();
  const updated = repo.update(id, { status: body.status });
  if (!updated) return errorResponse('Proposal not found', 404);

  eventBus.emit('proposal:updated', { proposalId: id, status: body.status });
  return jsonResponse(updated);
}
