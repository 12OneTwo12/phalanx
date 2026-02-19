import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseManager } from '../../src/db/database.js';
import { up } from '../../src/db/migrations/0001_initial.js';
import { GoalRepository, EpicRepository, TicketRepository } from '../../src/db/repositories/index.js';
import { Orchestrator, type TicketExecutor } from '../../src/engine/orchestrator.js';

describe('Orchestrator', () => {
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

  function makeExecutor(success = true): TicketExecutor {
    return {
      execute: vi.fn(async () => ({ success, error: success ? undefined : 'Failed' })),
    };
  }

  it('should execute assigned tickets', async () => {
    ticketRepo.create({ id: 't1', epicId: 'e1', title: 'T', description: 'D', status: 'assigned' });
    const executor = makeExecutor(true);
    const orch = new Orchestrator(ticketRepo, executor);

    await orch.processQueue();

    expect(executor.execute).toHaveBeenCalled();
    expect(ticketRepo.findById('t1')?.status).toBe('verification');
  });

  it('should mark as failed on execution error', async () => {
    ticketRepo.create({ id: 't1', epicId: 'e1', title: 'T', description: 'D', status: 'assigned' });
    const executor = makeExecutor(false);
    const orch = new Orchestrator(ticketRepo, executor);

    await orch.processQueue();

    expect(ticketRepo.findById('t1')?.status).toBe('failed');
  });

  it('should respect concurrency limits', async () => {
    ticketRepo.create({ id: 't1', epicId: 'e1', title: 'A', description: 'D', status: 'assigned' });
    ticketRepo.create({ id: 't2', epicId: 'e1', title: 'B', description: 'D', status: 'assigned' });
    ticketRepo.create({ id: 't3', epicId: 'e1', title: 'C', description: 'D', status: 'assigned' });

    let concurrent = 0;
    let maxConcurrent = 0;
    const executor: TicketExecutor = {
      execute: vi.fn(async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((r) => setTimeout(r, 50));
        concurrent--;
        return { success: true };
      }),
    };

    const orch = new Orchestrator(ticketRepo, executor, { maxConcurrency: 2 });
    await orch.processQueue();
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it('should skip tickets with unmet dependencies', async () => {
    ticketRepo.create({ id: 't1', epicId: 'e1', title: 'A', description: 'D', status: 'assigned', dependsOn: '["t0"]' });
    ticketRepo.create({ id: 't0', epicId: 'e1', title: 'B', description: 'D', status: 'in_progress' });

    const executor = makeExecutor(true);
    const orch = new Orchestrator(ticketRepo, executor);
    await orch.processQueue();

    // t1 should not be executed because t0 is not done
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it('should execute tickets when dependencies are met', async () => {
    ticketRepo.create({ id: 't0', epicId: 'e1', title: 'B', description: 'D', status: 'done' });
    ticketRepo.create({ id: 't1', epicId: 'e1', title: 'A', description: 'D', status: 'assigned', dependsOn: '["t0"]' });

    const executor = makeExecutor(true);
    const orch = new Orchestrator(ticketRepo, executor);
    await orch.processQueue();

    expect(executor.execute).toHaveBeenCalled();
  });

  it('should emit events', async () => {
    ticketRepo.create({ id: 't1', epicId: 'e1', title: 'T', description: 'D', status: 'assigned' });
    const executor = makeExecutor(true);
    const orch = new Orchestrator(ticketRepo, executor);

    const startedSpy = vi.fn();
    const submittedSpy = vi.fn();
    orch.on('ticket:started', startedSpy);
    orch.on('ticket:submitted', submittedSpy);

    await orch.processQueue();

    expect(startedSpy).toHaveBeenCalledWith({ ticketId: 't1', agentId: null });
    expect(submittedSpy).toHaveBeenCalledWith({ ticketId: 't1', agentId: null });
  });

  it('should expose activeCount and config', () => {
    const executor = makeExecutor();
    const orch = new Orchestrator(ticketRepo, executor, { maxConcurrency: 5 });
    expect(orch.activeCount).toBe(0);
    expect(orch.engineConfig.maxConcurrency).toBe(5);
  });
});
