import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseManager } from '../../src/db/database.js';
import { up } from '../../src/db/migrations/0001_initial.js';
import { GoalRepository, EpicRepository, TicketRepository } from '../../src/db/repositories/index.js';
import { DecompositionService, ManualDecompositionStrategy } from '../../src/engine/decomposition-service.js';
import type { DecomposedEpic } from '../../src/engine/types.js';

describe('DecompositionService', () => {
  let db: DatabaseManager;
  let goalRepo: GoalRepository;
  let epicRepo: EpicRepository;
  let ticketRepo: TicketRepository;
  let service: DecompositionService;

  const testEpics: DecomposedEpic[] = [
    {
      title: 'Authentication',
      description: 'User auth system',
      tickets: [
        { title: 'Login API', description: 'Implement login', priority: 'high', dependsOn: [], category: 'backend' },
        { title: 'Signup API', description: 'Implement signup', priority: 'high', dependsOn: ['Login API'], category: 'backend' },
      ],
    },
  ];

  beforeEach(() => {
    db = DatabaseManager.create({ path: ':memory:' });
    up(db);
    goalRepo = new GoalRepository(db.orm);
    epicRepo = new EpicRepository(db.orm);
    ticketRepo = new TicketRepository(db.orm);
    service = new DecompositionService(goalRepo, epicRepo, ticketRepo, new ManualDecompositionStrategy(testEpics));
  });

  afterEach(() => { db.close(); });

  it('should decompose a goal into epics and tickets', async () => {
    const goal = goalRepo.create({ id: 'g1', description: 'Build MVP' });
    const result = await service.decompose(goal.id);

    expect(result.goalId).toBe('g1');
    expect(result.epics).toHaveLength(1);

    // Check DB
    const epics = epicRepo.findByGoalId('g1');
    expect(epics).toHaveLength(1);
    expect(epics[0].title).toBe('Authentication');

    const tickets = ticketRepo.findByEpicId(epics[0].id);
    expect(tickets).toHaveLength(2);
    expect(tickets.every((t) => t.status === 'pending_approval')).toBe(true);
    expect(tickets.every((t) => t.proposedBy === 'team-lead')).toBe(true);
  });

  it('should throw for non-existent goal', async () => {
    await expect(service.decompose('nonexistent')).rejects.toThrow('Goal not found');
  });

  it('should emit decomposition:complete event', async () => {
    goalRepo.create({ id: 'g1', description: 'Test' });
    const spy = vi.fn();
    service.on('decomposition:complete', spy);
    await service.decompose('g1');
    expect(spy).toHaveBeenCalledWith({ goalId: 'g1', epicCount: 1 });
  });

  it('should allow strategy replacement', async () => {
    goalRepo.create({ id: 'g1', description: 'Test' });
    service.setStrategy(new ManualDecompositionStrategy([]));
    const result = await service.decompose('g1');
    expect(result.epics).toHaveLength(0);
  });
});
