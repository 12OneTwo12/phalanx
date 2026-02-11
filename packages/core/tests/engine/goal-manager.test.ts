import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseManager } from '../../src/db/database.js';
import { up } from '../../src/db/migrations/0001_initial.js';
import { GoalRepository, EpicRepository, TicketRepository } from '../../src/db/repositories/index.js';
import { GoalManager } from '../../src/engine/goal-manager.js';

describe('GoalManager', () => {
  let db: DatabaseManager;
  let manager: GoalManager;
  let goalRepo: GoalRepository;
  let epicRepo: EpicRepository;
  let ticketRepo: TicketRepository;

  beforeEach(() => {
    db = DatabaseManager.create({ path: ':memory:' });
    up(db);
    goalRepo = new GoalRepository(db.orm);
    epicRepo = new EpicRepository(db.orm);
    ticketRepo = new TicketRepository(db.orm);
    manager = new GoalManager(goalRepo, epicRepo, ticketRepo);
  });

  afterEach(() => { db.close(); });

  it('should create a goal', () => {
    const goal = manager.create('Build MVP');
    expect(goal.description).toBe('Build MVP');
    expect(goal.status).toBe('active');
    expect(goal.progress).toBe(0);
  });

  it('should find a goal by id', () => {
    const goal = manager.create('Test');
    expect(manager.findById(goal.id)?.description).toBe('Test');
  });

  it('should list all goals', () => {
    manager.create('A');
    manager.create('B');
    expect(manager.findAll()).toHaveLength(2);
  });

  it('should update goal status', () => {
    const goal = manager.create('Test');
    manager.updateStatus(goal.id, 'paused');
    expect(manager.findById(goal.id)?.status).toBe('paused');
  });

  it('should calculate progress from tickets', () => {
    const goal = manager.create('Test');
    const epic = epicRepo.create({ id: 'e1', goalId: goal.id, title: 'Epic' });
    ticketRepo.create({ id: 't1', epicId: epic.id, title: 'A', description: 'X', status: 'done' });
    ticketRepo.create({ id: 't2', epicId: epic.id, title: 'B', description: 'Y', status: 'in_progress' });

    const progress = manager.calculateProgress(goal.id);
    expect(progress).toBe(50);
    expect(goalRepo.findById(goal.id)?.progress).toBe(50);
  });

  it('should auto-complete goal when all tickets are done', () => {
    const goal = manager.create('Test');
    const epic = epicRepo.create({ id: 'e1', goalId: goal.id, title: 'Epic' });
    ticketRepo.create({ id: 't1', epicId: epic.id, title: 'A', description: 'X', status: 'done' });

    const completedSpy = vi.fn();
    manager.on('goal:completed', completedSpy);

    manager.calculateProgress(goal.id);
    expect(completedSpy).toHaveBeenCalledWith({ goalId: goal.id });
    expect(goalRepo.findById(goal.id)?.status).toBe('completed');
  });

  it('should return 0 progress for goals with no epics', () => {
    const goal = manager.create('Empty');
    expect(manager.calculateProgress(goal.id)).toBe(0);
  });

  it('should delete a goal', () => {
    const goal = manager.create('Test');
    expect(manager.delete(goal.id)).toBe(true);
    expect(manager.findById(goal.id)).toBeUndefined();
  });

  it('should emit events', () => {
    const spy = vi.fn();
    manager.on('goal:created', spy);
    manager.create('Test');
    expect(spy).toHaveBeenCalled();
  });
});
