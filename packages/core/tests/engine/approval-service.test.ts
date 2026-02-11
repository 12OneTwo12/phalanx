import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseManager } from '../../src/db/database.js';
import { up } from '../../src/db/migrations/0001_initial.js';
import { GoalRepository, EpicRepository, TicketRepository } from '../../src/db/repositories/index.js';
import { ApprovalService } from '../../src/engine/approval-service.js';

describe('ApprovalService', () => {
  let db: DatabaseManager;
  let ticketRepo: TicketRepository;
  let service: ApprovalService;

  beforeEach(() => {
    db = DatabaseManager.create({ path: ':memory:' });
    up(db);
    const goalRepo = new GoalRepository(db.orm);
    const epicRepo = new EpicRepository(db.orm);
    ticketRepo = new TicketRepository(db.orm);
    goalRepo.create({ id: 'g1', description: 'Goal' });
    epicRepo.create({ id: 'e1', goalId: 'g1', title: 'Epic' });
    service = new ApprovalService(ticketRepo);
  });

  afterEach(() => { db.close(); });

  it('should approve a ticket', () => {
    ticketRepo.create({ id: 't1', epicId: 'e1', title: 'T', description: 'D', status: 'pending_approval' });
    const spy = vi.fn();
    service.on('ticket:approved', spy);

    service.processApproval({ ticketId: 't1', decision: 'approve' });
    expect(ticketRepo.findById('t1')?.status).toBe('backlog');
    expect(ticketRepo.findById('t1')?.approvedAt).toBeDefined();
    expect(spy).toHaveBeenCalled();
  });

  it('should reject a ticket (delete)', () => {
    ticketRepo.create({ id: 't1', epicId: 'e1', title: 'T', description: 'D', status: 'pending_approval' });
    service.processApproval({ ticketId: 't1', decision: 'reject' });
    expect(ticketRepo.findById('t1')).toBeUndefined();
  });

  it('should modify and approve a ticket', () => {
    ticketRepo.create({ id: 't1', epicId: 'e1', title: 'Old', description: 'D', status: 'pending_approval' });
    service.processApproval({
      ticketId: 't1',
      decision: 'modify',
      modifications: { title: 'New', priority: 'high' },
    });
    const ticket = ticketRepo.findById('t1');
    expect(ticket?.title).toBe('New');
    expect(ticket?.priority).toBe('high');
    expect(ticket?.status).toBe('backlog');
  });

  it('should throw for non-existent ticket', () => {
    expect(() => service.processApproval({ ticketId: 'nope', decision: 'approve' })).toThrow('not found');
  });

  it('should throw if ticket not pending', () => {
    ticketRepo.create({ id: 't1', epicId: 'e1', title: 'T', description: 'D', status: 'backlog' });
    expect(() => service.processApproval({ ticketId: 't1', decision: 'approve' })).toThrow('not pending');
  });

  it('should approve all pending tickets', () => {
    ticketRepo.create({ id: 't1', epicId: 'e1', title: 'A', description: 'D', status: 'pending_approval' });
    ticketRepo.create({ id: 't2', epicId: 'e1', title: 'B', description: 'D', status: 'pending_approval' });
    ticketRepo.create({ id: 't3', epicId: 'e1', title: 'C', description: 'D', status: 'backlog' });

    const approved = service.approveAll();
    expect(approved).toHaveLength(2);
    expect(ticketRepo.findById('t1')?.status).toBe('backlog');
    expect(ticketRepo.findById('t2')?.status).toBe('backlog');
  });

  it('should list pending approvals', () => {
    ticketRepo.create({ id: 't1', epicId: 'e1', title: 'A', description: 'D', status: 'pending_approval' });
    ticketRepo.create({ id: 't2', epicId: 'e1', title: 'B', description: 'D', status: 'backlog' });
    expect(service.getPendingApprovals()).toHaveLength(1);
  });
});
