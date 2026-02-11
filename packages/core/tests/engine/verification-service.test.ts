import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseManager } from '../../src/db/database.js';
import { up } from '../../src/db/migrations/0001_initial.js';
import { GoalRepository, EpicRepository, TicketRepository } from '../../src/db/repositories/index.js';
import { VerificationService, type VerificationStrategy } from '../../src/engine/verification-service.js';
import type { VerificationResult } from '../../src/engine/types.js';

describe('VerificationService', () => {
  let db: DatabaseManager;
  let ticketRepo: TicketRepository;

  beforeEach(() => {
    db = DatabaseManager.create({ path: ':memory:' });
    up(db);
    new GoalRepository(db.orm).create({ id: 'g1', description: 'Goal' });
    new EpicRepository(db.orm).create({ id: 'e1', goalId: 'g1', title: 'Epic' });
    ticketRepo = new TicketRepository(db.orm);
  });

  afterEach(() => { db.close(); });

  function makeStrategy(status: 'passed' | 'failed'): VerificationStrategy {
    return {
      verify: vi.fn(async (ticketId: string): Promise<VerificationResult> => ({
        ticketId,
        status,
        checks: [{ name: 'test', passed: status === 'passed' }],
        feedback: status === 'failed' ? 'Fix the bugs' : undefined,
      })),
    };
  }

  it('should mark ticket as done on passed verification', async () => {
    ticketRepo.create({ id: 't1', epicId: 'e1', title: 'T', description: 'D', status: 'verification' });
    const service = new VerificationService(ticketRepo, makeStrategy('passed'));

    const passedSpy = vi.fn();
    service.on('verification:passed', passedSpy);

    await service.verify('t1');
    expect(ticketRepo.findById('t1')?.status).toBe('done');
    expect(passedSpy).toHaveBeenCalledWith({ ticketId: 't1' });
  });

  it('should send ticket back to in_progress on failure', async () => {
    ticketRepo.create({ id: 't1', epicId: 'e1', title: 'T', description: 'D', status: 'verification', retryCount: 0, maxRetries: 3 });
    const service = new VerificationService(ticketRepo, makeStrategy('failed'));

    const failedSpy = vi.fn();
    service.on('verification:failed', failedSpy);

    await service.verify('t1');
    expect(ticketRepo.findById('t1')?.status).toBe('in_progress');
    expect(ticketRepo.findById('t1')?.retryCount).toBe(1);
    expect(failedSpy).toHaveBeenCalled();
  });

  it('should escalate when max retries reached', async () => {
    ticketRepo.create({ id: 't1', epicId: 'e1', title: 'T', description: 'D', status: 'verification', retryCount: 2, maxRetries: 3 });
    const service = new VerificationService(ticketRepo, makeStrategy('failed'));

    const escalatedSpy = vi.fn();
    service.on('verification:escalated', escalatedSpy);

    await service.verify('t1');
    expect(ticketRepo.findById('t1')?.status).toBe('escalated');
    expect(escalatedSpy).toHaveBeenCalledWith({ ticketId: 't1', retryCount: 3 });
  });

  it('should throw for non-verification tickets', async () => {
    ticketRepo.create({ id: 't1', epicId: 'e1', title: 'T', description: 'D', status: 'backlog' });
    const service = new VerificationService(ticketRepo, makeStrategy('passed'));
    await expect(service.verify('t1')).rejects.toThrow('not in verification');
  });

  it('should list pending verifications', () => {
    ticketRepo.create({ id: 't1', epicId: 'e1', title: 'A', description: 'D', status: 'verification' });
    ticketRepo.create({ id: 't2', epicId: 'e1', title: 'B', description: 'D', status: 'done' });
    const service = new VerificationService(ticketRepo, makeStrategy('passed'));
    expect(service.getPendingVerifications()).toHaveLength(1);
  });

  it('should allow strategy replacement', () => {
    const service = new VerificationService(ticketRepo, makeStrategy('passed'));
    const newStrategy = makeStrategy('failed');
    service.setStrategy(newStrategy);
    // Just verify it doesn't throw
    expect(newStrategy).toBeDefined();
  });
});
