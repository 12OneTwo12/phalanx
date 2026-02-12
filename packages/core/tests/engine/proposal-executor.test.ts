import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '../../src/db/database.js';
import { up } from '../../src/db/migrations/0001_initial.js';
import {
  ProposalRepository,
  TicketRepository,
  GoalRepository,
  EpicRepository,
} from '../../src/db/repositories/index.js';
import { ProposalExecutor } from '../../src/engine/proposal-executor.js';

describe('ProposalExecutor', () => {
  let db: DatabaseManager;
  let proposalRepo: ProposalRepository;
  let ticketRepo: TicketRepository;
  let executor: ProposalExecutor;
  const epicId = 'epic-1';

  beforeEach(() => {
    db = DatabaseManager.create({ path: ':memory:' });
    up(db);
    // Seed goal → epic chain (FK requirements)
    new GoalRepository(db.orm).create({ id: 'goal-1', title: 'Goal', description: 'A goal' });
    new EpicRepository(db.orm).create({ id: epicId, goalId: 'goal-1', title: 'Epic' });

    proposalRepo = new ProposalRepository(db.orm);
    ticketRepo = new TicketRepository(db.orm);
    executor = new ProposalExecutor(proposalRepo, ticketRepo);
  });

  afterEach(() => { db.close(); });

  // -----------------------------------------------------------------------
  // new_ticket
  // -----------------------------------------------------------------------

  it('should create a ticket from a new_ticket proposal', () => {
    const proposal = proposalRepo.create({
      id: 'p1',
      type: 'new_ticket',
      title: 'Add logging',
      description: 'We need logging',
      metadata: JSON.stringify({ title: 'Add logging middleware', description: 'Implement structured logging', epicId }),
    });

    const result = executor.execute(proposal.id);
    expect(result.success).toBe(true);
    expect(result.action).toBe('new_ticket');
    expect(result.ticketId).toBeDefined();

    // Verify ticket was actually created
    const ticket = ticketRepo.findById(result.ticketId!);
    expect(ticket).toBeDefined();
    expect(ticket!.title).toBe('Add logging middleware');
    expect(ticket!.status).toBe('pending_approval');
    expect(ticket!.proposedBy).toBe('team-lead');

    // Verify proposal was approved
    const updated = proposalRepo.findById(proposal.id);
    expect(updated!.status).toBe('approved');
  });

  it('should fail if metadata is missing for new_ticket', () => {
    const proposal = proposalRepo.create({
      id: 'p2',
      type: 'new_ticket',
      title: 'No meta',
      description: 'Missing metadata',
    });

    const result = executor.execute(proposal.id);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required metadata');
  });

  // -----------------------------------------------------------------------
  // priority_change
  // -----------------------------------------------------------------------

  it('should change ticket priority from a priority_change proposal', () => {
    const ticket = ticketRepo.create({
      id: 'ticket-1',
      title: 'Fix bug',
      description: 'A bug',
      epicId,
      priority: 'low',
    });

    const proposal = proposalRepo.create({
      id: 'p3',
      type: 'priority_change',
      title: 'Escalate bug',
      description: 'Bug is critical',
      metadata: JSON.stringify({ ticketId: ticket.id, newPriority: 'critical' }),
    });

    const result = executor.execute(proposal.id);
    expect(result.success).toBe(true);
    expect(result.action).toBe('priority_change');
    expect(result.ticketId).toBe(ticket.id);

    const updated = ticketRepo.findById(ticket.id);
    expect(updated!.priority).toBe('critical');
  });

  it('should fail if ticket not found for priority_change', () => {
    const proposal = proposalRepo.create({
      id: 'p4',
      type: 'priority_change',
      title: 'Change ghost ticket',
      description: '',
      metadata: JSON.stringify({ ticketId: 'nonexistent', newPriority: 'high' }),
    });

    const result = executor.execute(proposal.id);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Ticket not found');
  });

  // -----------------------------------------------------------------------
  // improvement
  // -----------------------------------------------------------------------

  it('should create an improvement ticket', () => {
    const proposal = proposalRepo.create({
      id: 'p5',
      type: 'improvement',
      title: 'Refactor auth',
      description: 'Auth module needs cleanup',
      metadata: JSON.stringify({ title: 'Refactor auth module', description: 'Clean up auth flow', epicId }),
    });

    const result = executor.execute(proposal.id);
    expect(result.success).toBe(true);
    expect(result.action).toBe('improvement');
    expect(result.ticketId).toBeDefined();

    const ticket = ticketRepo.findById(result.ticketId!);
    expect(ticket!.title).toBe('[Improvement] Refactor auth module');
    expect(ticket!.priority).toBe('low');
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  it('should reject execution of a rejected proposal', () => {
    const proposal = proposalRepo.create({
      id: 'p6',
      type: 'new_ticket',
      title: 'Rejected',
      description: '',
      status: 'rejected',
      metadata: JSON.stringify({ title: 'T', epicId }),
    });

    const result = executor.execute(proposal.id);
    expect(result.success).toBe(false);
    expect(result.error).toContain('rejected');
  });

  it('should return error for nonexistent proposal', () => {
    const result = executor.execute('ghost-id');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should be idempotent — re-execution returns same ticket without duplicates', () => {
    const proposal = proposalRepo.create({
      id: 'p7',
      type: 'new_ticket',
      title: 'Idempotent',
      description: '',
      metadata: JSON.stringify({ title: 'Idempotent ticket', description: '', epicId }),
    });

    const result1 = executor.execute(proposal.id);
    const result2 = executor.execute(proposal.id);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result1.ticketId).toBe(result2.ticketId);
    // Only one ticket should exist (not two)
    const allTickets = ticketRepo.findAll();
    expect(allTickets).toHaveLength(1);
  });

  it('should report malformed metadata JSON', () => {
    const proposal = proposalRepo.create({
      id: 'p8',
      type: 'new_ticket',
      title: 'Bad JSON',
      description: '',
      metadata: '{invalid json}',
    });

    const result = executor.execute(proposal.id);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Malformed metadata JSON');
  });

  it('should use default priority when omitted in new_ticket', () => {
    const proposal = proposalRepo.create({
      id: 'p9',
      type: 'new_ticket',
      title: 'No priority',
      description: '',
      metadata: JSON.stringify({ title: 'Default priority', description: '', epicId }),
    });

    const result = executor.execute(proposal.id);
    expect(result.success).toBe(true);
    const ticket = ticketRepo.findById(result.ticketId!);
    expect(ticket!.priority).toBe('medium');
  });
});
