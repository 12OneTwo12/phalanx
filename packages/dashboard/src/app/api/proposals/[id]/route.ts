import { getProposalRepository, getReverseProposalRepository } from '@/lib/db';
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-utils';
import { eventBus } from '@/lib/event-bus';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/proposals/:id — get a single proposal */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  // Try standard proposals first, then reverse proposals
  const proposalRepo = getProposalRepository();
  const proposal = proposalRepo.findById(id);
  if (proposal) return jsonResponse(proposal);

  const reverseRepo = getReverseProposalRepository();
  const reverseProposal = reverseRepo.findById(id);
  if (reverseProposal) return jsonResponse({ ...reverseProposal, source: 'reverse' });

  return errorResponse('Proposal not found', 404);
}

/** PATCH /api/proposals/:id — approve or reject a proposal */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await parseBody<{ status: 'approved' | 'rejected'; source?: 'reverse' }>(request);
  if (!body?.status || !['approved', 'rejected'].includes(body.status)) {
    return errorResponse('status must be "approved" or "rejected"');
  }

  // Handle reverse proposals
  if (body.source === 'reverse') {
    const reverseRepo = getReverseProposalRepository();
    const updated = reverseRepo.update(id, { status: body.status });
    if (!updated) return errorResponse('Reverse proposal not found', 404);

    eventBus.emit('reverse-proposal:updated', { proposalId: id, status: body.status });
    return jsonResponse({ ...updated, source: 'reverse' });
  }

  // Standard proposals
  const repo = getProposalRepository();
  const updated = repo.update(id, { status: body.status });
  if (!updated) return errorResponse('Proposal not found', 404);

  eventBus.emit('proposal:updated', { proposalId: id, status: body.status });
  return jsonResponse(updated);
}
