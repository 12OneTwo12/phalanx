import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseManager } from '../../src/db/database.js';
import { up } from '../../src/db/migrations/0001_initial.js';
import { GoalRepository, EpicRepository, TicketRepository, AgentRepository } from '../../src/db/repositories/index.js';
import { AssignmentService } from '../../src/engine/assignment-service.js';

describe('AssignmentService', () => {
  let db: DatabaseManager;
  let ticketRepo: TicketRepository;
  let agentRepo: AgentRepository;
  let service: AssignmentService;

  beforeEach(() => {
    db = DatabaseManager.create({ path: ':memory:' });
    up(db);
    new GoalRepository(db.orm).create({ id: 'g1', description: 'Goal' });
    new EpicRepository(db.orm).create({ id: 'e1', goalId: 'g1', title: 'Epic' });
    ticketRepo = new TicketRepository(db.orm);
    agentRepo = new AgentRepository(db.orm);
    service = new AssignmentService(ticketRepo, agentRepo);
  });

  afterEach(() => { db.close(); });

  it('should assign a ticket to an agent', () => {
    ticketRepo.create({ id: 't1', epicId: 'e1', title: 'T', description: 'D', status: 'backlog' });
    agentRepo.create({ id: 'a1', role: 'backend', name: 'B1' });

    const spy = vi.fn();
    service.on('ticket:assigned', spy);

    service.assign('t1', 'a1');
    expect(ticketRepo.findById('t1')?.status).toBe('assigned');
    expect(ticketRepo.findById('t1')?.assignedAgentId).toBe('a1');
    expect(agentRepo.findById('a1')?.status).toBe('running');
    expect(spy).toHaveBeenCalledWith({ ticketId: 't1', agentId: 'a1' });
  });

  it('should throw if ticket not in backlog', () => {
    ticketRepo.create({ id: 't1', epicId: 'e1', title: 'T', description: 'D', status: 'in_progress' });
    agentRepo.create({ id: 'a1', role: 'backend', name: 'B1' });
    expect(() => service.assign('t1', 'a1')).toThrow('must be in backlog');
  });

  it('should auto-assign based on category', () => {
    ticketRepo.create({ id: 't1', epicId: 'e1', title: 'T', description: 'D', status: 'backlog', metadata: '{"category":"backend"}' });
    agentRepo.create({ id: 'a1', role: 'backend', name: 'B1', status: 'idle' });
    agentRepo.create({ id: 'a2', role: 'frontend', name: 'F1', status: 'idle' });

    const assigned = service.autoAssign('t1');
    expect(assigned).toBe('a1');
  });

  it('should return null when no agent available', () => {
    ticketRepo.create({ id: 't1', epicId: 'e1', title: 'T', description: 'D', status: 'backlog' });
    const spy = vi.fn();
    service.on('assignment:noAgent', spy);

    const result = service.autoAssign('t1');
    expect(result).toBeNull();
    expect(spy).toHaveBeenCalled();
  });

  it('should release an agent', () => {
    agentRepo.create({ id: 'a1', role: 'backend', name: 'B1', status: 'running' });
    service.release('a1');
    expect(agentRepo.findById('a1')?.status).toBe('idle');
  });
});
