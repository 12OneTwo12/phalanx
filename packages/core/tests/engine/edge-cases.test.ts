/**
 * Edge case tests for engine modules.
 * Covers: unexpected state transitions, empty goals, concurrent orchestrator,
 * malformed dependsOn, round-robin wrapping, executor exceptions.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseManager } from '../../src/db/database.js';
import { up } from '../../src/db/migrations/0001_initial.js';
import {
  GoalRepository,
  EpicRepository,
  TicketRepository,
  AgentRepository,
} from '../../src/db/repositories/index.js';
import { GoalManager } from '../../src/engine/goal-manager.js';
import { Orchestrator, type TicketExecutor } from '../../src/engine/orchestrator.js';
import { AssignmentService } from '../../src/engine/assignment-service.js';
import { VerificationService, type VerificationStrategy } from '../../src/engine/verification-service.js';
import { TicketStateMachine, InvalidTransitionError } from '../../src/engine/ticket-state-machine.js';
import type { VerificationResult } from '../../src/engine/types.js';

describe('Engine Edge Cases', () => {
  let db: DatabaseManager;
  let goalRepo: GoalRepository;
  let epicRepo: EpicRepository;
  let ticketRepo: TicketRepository;
  let agentRepo: AgentRepository;

  beforeEach(() => {
    db = DatabaseManager.create({ path: ':memory:' });
    up(db);
    goalRepo = new GoalRepository(db.orm);
    epicRepo = new EpicRepository(db.orm);
    ticketRepo = new TicketRepository(db.orm);
    agentRepo = new AgentRepository(db.orm);
    goalRepo.create({ id: 'g1', description: 'Goal' });
    epicRepo.create({ id: 'e1', goalId: 'g1', title: 'Epic' });
  });

  afterEach(() => { db.close(); });

  // ---------------------------------------------------------------------------
  // GoalManager — empty goal with no tickets
  // ---------------------------------------------------------------------------
  it('GoalManager: progress is 0 for goal with epics but no tickets', () => {
    const manager = new GoalManager(goalRepo, epicRepo, ticketRepo);
    expect(manager.calculateProgress('g1')).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Orchestrator — malformed dependsOn JSON
  // ---------------------------------------------------------------------------
  it('Orchestrator: treats malformed dependsOn as no dependencies', async () => {
    ticketRepo.create({
      id: 't1', epicId: 'e1', title: 'T', description: 'D',
      status: 'assigned', dependsOn: 'NOT_VALID_JSON',
    });
    const executor: TicketExecutor = { execute: vi.fn(async () => ({ success: true })) };
    const orch = new Orchestrator(ticketRepo, executor);
    await orch.processQueue();
    // Should execute because malformed JSON is treated as no deps
    expect(executor.execute).toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Orchestrator — executor throws exception
  // ---------------------------------------------------------------------------
  it('Orchestrator: handles executor throwing an exception', async () => {
    ticketRepo.create({ id: 't1', epicId: 'e1', title: 'T', description: 'D', status: 'assigned' });
    const executor: TicketExecutor = {
      execute: vi.fn(async () => { throw new Error('Unexpected crash'); }),
    };
    const orch = new Orchestrator(ticketRepo, executor);
    const errorSpy = vi.fn();
    orch.on('ticket:error', errorSpy);

    await orch.processQueue();
    expect(errorSpy).toHaveBeenCalled();
    expect(ticketRepo.findById('t1')?.status).toBe('failed');
  });

  // ---------------------------------------------------------------------------
  // Orchestrator — no assigned tickets (empty queue)
  // ---------------------------------------------------------------------------
  it('Orchestrator: processQueue is a no-op when no assigned tickets', async () => {
    ticketRepo.create({ id: 't1', epicId: 'e1', title: 'T', description: 'D', status: 'backlog' });
    const executor: TicketExecutor = { execute: vi.fn(async () => ({ success: true })) };
    const orch = new Orchestrator(ticketRepo, executor);
    await orch.processQueue();
    expect(executor.execute).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Orchestrator — duplicate execution guard
  // ---------------------------------------------------------------------------
  it('Orchestrator: does not execute same ticket twice concurrently', async () => {
    ticketRepo.create({ id: 't1', epicId: 'e1', title: 'T', description: 'D', status: 'assigned' });
    let callCount = 0;
    const executor: TicketExecutor = {
      execute: vi.fn(async () => {
        callCount++;
        await new Promise((r) => setTimeout(r, 100));
        return { success: true };
      }),
    };
    const orch = new Orchestrator(ticketRepo, executor);
    // Process queue twice simultaneously
    await Promise.all([orch.processQueue(), orch.processQueue()]);
    // The second call should skip t1 since it's already active
    expect(callCount).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // AssignmentService — round-robin wraps around
  // ---------------------------------------------------------------------------
  it('AssignmentService: round-robin wraps around agent list', () => {
    agentRepo.create({ id: 'a1', role: 'backend', name: 'B1', status: 'idle' });
    agentRepo.create({ id: 'a2', role: 'backend', name: 'B2', status: 'idle' });
    const service = new AssignmentService(ticketRepo, agentRepo);

    // Create and assign 3 tickets to force wrap-around
    ticketRepo.create({ id: 't1', epicId: 'e1', title: 'T1', description: 'D', status: 'backlog', metadata: '{"category":"backend"}' });
    const first = service.autoAssign('t1');
    // Release agent so they're idle again
    service.release(first!);

    ticketRepo.create({ id: 't2', epicId: 'e1', title: 'T2', description: 'D', status: 'backlog', metadata: '{"category":"backend"}' });
    const second = service.autoAssign('t2');
    service.release(second!);

    ticketRepo.create({ id: 't3', epicId: 'e1', title: 'T3', description: 'D', status: 'backlog', metadata: '{"category":"backend"}' });
    const third = service.autoAssign('t3');

    // Should have wrapped: first=a1, second=a2, third=a1
    expect(first).toBe('a1');
    expect(second).toBe('a2');
    expect(third).toBe('a1');
  });

  // ---------------------------------------------------------------------------
  // AssignmentService — assign throws for non-existent ticket/agent
  // ---------------------------------------------------------------------------
  it('AssignmentService: throws for non-existent ticket', () => {
    agentRepo.create({ id: 'a1', role: 'backend', name: 'B1' });
    const service = new AssignmentService(ticketRepo, agentRepo);
    expect(() => service.assign('nonexistent', 'a1')).toThrow('Ticket not found');
  });

  it('AssignmentService: throws for non-existent agent', () => {
    ticketRepo.create({ id: 't1', epicId: 'e1', title: 'T', description: 'D', status: 'backlog' });
    const service = new AssignmentService(ticketRepo, agentRepo);
    expect(() => service.assign('t1', 'nonexistent')).toThrow('Agent not found');
  });

  // ---------------------------------------------------------------------------
  // VerificationService — non-existent ticket
  // ---------------------------------------------------------------------------
  it('VerificationService: throws for non-existent ticket', async () => {
    const strategy: VerificationStrategy = {
      verify: vi.fn(async (id: string): Promise<VerificationResult> => ({
        ticketId: id, status: 'passed', checks: [],
      })),
    };
    const service = new VerificationService(ticketRepo, strategy);
    await expect(service.verify('nonexistent')).rejects.toThrow('Ticket not found');
  });

  // ---------------------------------------------------------------------------
  // TicketStateMachine — getTransitions returns all transitions
  // ---------------------------------------------------------------------------
  it('TicketStateMachine: getTransitions returns full table', () => {
    const transitions = TicketStateMachine.getTransitions();
    expect(transitions.length).toBe(9);
  });

  // ---------------------------------------------------------------------------
  // TicketStateMachine — InvalidTransitionError has correct properties
  // ---------------------------------------------------------------------------
  it('InvalidTransitionError: has from and action properties', () => {
    try {
      TicketStateMachine.transition('done', 'approve');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidTransitionError);
      const e = err as InvalidTransitionError;
      expect(e.from).toBe('done');
      expect(e.action).toBe('approve');
      expect(e.name).toBe('InvalidTransitionError');
    }
  });
});
