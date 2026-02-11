/**
 * Proposal service — manages reverse proposals from Team Lead to user.
 */
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { ReverseProposalRepository } from '../db/repositories/reverse-proposal.repository.js';
import type { ReverseProposal } from '../db/schema.js';
import type { ReverseProposalRequest } from './types.js';

export class ProposalService extends EventEmitter {
  constructor(private readonly proposalRepo: ReverseProposalRepository) {
    super();
  }

  /** Create a new reverse proposal */
  create(request: ReverseProposalRequest): ReverseProposal {
    const proposal = this.proposalRepo.create({
      id: randomUUID(),
      agentId: request.agentId,
      reason: request.reason,
      suggestion: request.suggestion,
      diff: request.diff ?? null,
      status: 'pending',
    });
    this.emit('proposal:created', { proposalId: proposal.id });
    return proposal;
  }

  /** Approve a proposal */
  approve(id: string): ReverseProposal | undefined {
    const result = this.proposalRepo.update(id, { status: 'approved' });
    if (result) this.emit('proposal:approved', { proposalId: id });
    return result;
  }

  /** Reject a proposal */
  reject(id: string): ReverseProposal | undefined {
    const result = this.proposalRepo.update(id, { status: 'rejected' });
    if (result) this.emit('proposal:rejected', { proposalId: id });
    return result;
  }

  /** Get all pending proposals */
  getPending(): ReverseProposal[] {
    return this.proposalRepo.findByStatus('pending');
  }

  /** Get proposals by agent */
  getByAgent(agentId: string): ReverseProposal[] {
    return this.proposalRepo.findByAgentId(agentId);
  }
}
