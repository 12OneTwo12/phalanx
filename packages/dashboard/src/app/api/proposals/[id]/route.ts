import { getProposalRepository, getReverseProposalRepository, getTicketRepository } from '@/lib/db';
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-utils';
import { eventBus } from '@/lib/event-bus';
import { ProposalExecutor } from '@phalanx/core';

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
  const proposal = repo.findById(id);
  if (!proposal) return errorResponse('Proposal not found', 404);

  // Execute side-effects when approved (executor handles the status transition)
  if (body.status === 'approved') {
    const executor = new ProposalExecutor(repo, getTicketRepository());
    const executionResult = executor.execute(id);
    const updated = repo.findById(id)!;

    eventBus.emit('proposal:updated', { proposalId: id, status: body.status });

    if (!executionResult.success) {
      return jsonResponse({ ...updated, execution: executionResult }, 422);
    }
    return jsonResponse({ ...updated, execution: executionResult });
  }

  // Rejection — just update status
  const updated = repo.update(id, { status: body.status });
  eventBus.emit('proposal:updated', { proposalId: id, status: body.status });
  return jsonResponse(updated);
}
