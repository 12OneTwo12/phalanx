/**
 * E2E Integration: Team Lead → Reverse Proposal → Approval → Ticket Creation
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDb, type TestContext } from './helpers.js';
import { ProposalService } from '../../src/engine/proposal-service.js';
import { GoalManager } from '../../src/engine/goal-manager.js';
import {
  DecompositionService,
  ManualDecompositionStrategy,
} from '../../src/engine/decomposition-service.js';
import { ApprovalService } from '../../src/engine/approval-service.js';

describe('Reverse Proposal Integration', () => {
  let ctx: TestContext;
  let proposalService: ProposalService;

  beforeEach(() => {
    ctx = setupTestDb();
    proposalService = new ProposalService(ctx.repos.reverseProposal);

    // Create an agent to author proposals
    ctx.repos.agent.create({
      id: 'team-lead',
      role: 'team-lead',
      name: 'Team Lead',
      status: 'idle',
    });
  });

  afterEach(() => {
    ctx.db.close();
  });

  it('should create and approve a reverse proposal', () => {
    // Team Lead creates a proposal
    const proposal = proposalService.create({
      agentId: 'team-lead',
      reason: 'API response times are slow (800ms avg)',
      suggestion: 'Add caching layer + optimize DB queries',
      diff: '+ import { Cache } from "./cache"',
    });

    expect(proposal.status).toBe('pending');
    expect(proposal.reason).toContain('800ms');

    // User approves
    const approved = proposalService.approve(proposal.id);
    expect(approved?.status).toBe('approved');
  });

  it('should create and reject a reverse proposal', () => {
    const proposal = proposalService.create({
      agentId: 'team-lead',
      reason: 'Could refactor to microservices',
      suggestion: 'Split monolith into 5 services',
    });

    const rejected = proposalService.reject(proposal.id);
    expect(rejected?.status).toBe('rejected');
  });

  it('should flow from proposal approval to ticket creation', async () => {
    // 1. Create a goal first
    const goalManager = new GoalManager(ctx.repos.goal, ctx.repos.epic, ctx.repos.ticket);
    const goal = goalManager.create('Improve API performance');

    // 2. Team Lead creates a reverse proposal
    const proposal = proposalService.create({
      agentId: 'team-lead',
      reason: 'Identified performance bottleneck',
      suggestion: 'Add Redis caching for frequently accessed endpoints',
    });

    // 3. User approves the proposal
    proposalService.approve(proposal.id);

    // 4. Create tickets based on approved proposal
    const decompositionService = new DecompositionService(
      ctx.repos.goal,
      ctx.repos.epic,
      ctx.repos.ticket,
      new ManualDecompositionStrategy([
        {
          title: 'Performance Optimization',
          description: 'Based on Team Lead proposal',
          tickets: [
            {
              title: 'Add Redis caching layer',
              description: 'Implement caching for /api/products and /api/users',
              priority: 'high',
              dependsOn: [],
              category: 'backend',
            },
          ],
        },
      ]),
    );

    const result = await decompositionService.decompose(goal.id);
    expect(result.epics).toHaveLength(1);

    // 5. Verify tickets are created and awaiting approval
    const pending = ctx.repos.ticket.findByStatus('pending_approval');
    expect(pending).toHaveLength(1);
    expect(pending[0].title).toBe('Add Redis caching layer');

    // 6. Approve and verify
    const approvalService = new ApprovalService(ctx.repos.ticket);
    approvalService.processApproval({ ticketId: pending[0].id, decision: 'approve' });

    const backlog = ctx.repos.ticket.findByStatus('backlog');
    expect(backlog).toHaveLength(1);
  });

  it('should emit events throughout the proposal lifecycle', () => {
    const events: string[] = [];
    proposalService.on('proposal:created', () => events.push('created'));
    proposalService.on('proposal:approved', () => events.push('approved'));
    proposalService.on('proposal:rejected', () => events.push('rejected'));

    const p1 = proposalService.create({
      agentId: 'team-lead',
      reason: 'Test',
      suggestion: 'Test',
    });
    proposalService.approve(p1.id);

    const p2 = proposalService.create({
      agentId: 'team-lead',
      reason: 'Test 2',
      suggestion: 'Test 2',
    });
    proposalService.reject(p2.id);

    expect(events).toEqual(['created', 'approved', 'created', 'rejected']);
  });
});
