import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseManager } from '../../src/db/database.js';
import { up } from '../../src/db/migrations/0001_initial.js';
import { AgentRepository, ReverseProposalRepository } from '../../src/db/repositories/index.js';
import { ProposalService } from '../../src/engine/proposal-service.js';

describe('ProposalService', () => {
  let db: DatabaseManager;
  let service: ProposalService;

  beforeEach(() => {
    db = DatabaseManager.create({ path: ':memory:' });
    up(db);
    new AgentRepository(db.orm).create({ id: 'a1', role: 'team-lead', name: 'TL' });
    const proposalRepo = new ReverseProposalRepository(db.orm);
    service = new ProposalService(proposalRepo);
  });

  afterEach(() => { db.close(); });

  it('should create a proposal', () => {
    const spy = vi.fn();
    service.on('proposal:created', spy);

    const proposal = service.create({
      agentId: 'a1',
      reason: 'Repeated error pattern',
      suggestion: 'Add error handling rule',
    });

    expect(proposal.status).toBe('pending');
    expect(proposal.reason).toBe('Repeated error pattern');
    expect(spy).toHaveBeenCalled();
  });

  it('should approve a proposal', () => {
    const proposal = service.create({ agentId: 'a1', reason: 'R', suggestion: 'S' });
    const approved = service.approve(proposal.id);
    expect(approved?.status).toBe('approved');
  });

  it('should reject a proposal', () => {
    const proposal = service.create({ agentId: 'a1', reason: 'R', suggestion: 'S' });
    const rejected = service.reject(proposal.id);
    expect(rejected?.status).toBe('rejected');
  });

  it('should get pending proposals', () => {
    service.create({ agentId: 'a1', reason: 'R1', suggestion: 'S1' });
    service.create({ agentId: 'a1', reason: 'R2', suggestion: 'S2' });
    const p = service.create({ agentId: 'a1', reason: 'R3', suggestion: 'S3' });
    service.approve(p.id);

    expect(service.getPending()).toHaveLength(2);
  });

  it('should get proposals by agent', () => {
    service.create({ agentId: 'a1', reason: 'R', suggestion: 'S' });
    expect(service.getByAgent('a1')).toHaveLength(1);
    expect(service.getByAgent('a2')).toHaveLength(0);
  });
});
