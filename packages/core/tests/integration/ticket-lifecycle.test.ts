/**
 * E2E Integration: Full ticket state machine transitions.
 * Verifies all valid and invalid transitions through the ticket lifecycle.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDb, type TestContext } from './helpers.js';
import { TicketStateMachine, InvalidTransitionError } from '../../src/engine/ticket-state-machine.js';

describe('Ticket Lifecycle Integration', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = setupTestDb();
    // Create prerequisite data
    ctx.repos.goal.create({ id: 'g1', description: 'Test goal', status: 'active', progress: 0 });
    ctx.repos.epic.create({ id: 'e1', goalId: 'g1', title: 'Test epic', status: 'active' });
  });

  afterEach(() => {
    ctx.db.close();
  });

  it('should walk the happy path: pending → backlog → assigned → in_progress → verification → done', () => {
    const ticket = ctx.repos.ticket.create({
      id: 't1', epicId: 'e1', title: 'Test ticket', description: 'Test',
      status: 'pending_approval', priority: 'medium',
    });

    // pending_approval → backlog (approve)
    let status = TicketStateMachine.transition(ticket.status, 'approve');
    expect(status).toBe('backlog');
    ctx.repos.ticket.update('t1', { status });

    // backlog → assigned (assign)
    status = TicketStateMachine.transition(status, 'assign');
    expect(status).toBe('assigned');
    ctx.repos.ticket.update('t1', { status });

    // assigned → in_progress (start)
    status = TicketStateMachine.transition(status, 'start');
    expect(status).toBe('in_progress');
    ctx.repos.ticket.update('t1', { status });

    // in_progress → verification (submit)
    status = TicketStateMachine.transition(status, 'submit');
    expect(status).toBe('verification');
    ctx.repos.ticket.update('t1', { status });

    // verification → done (pass)
    status = TicketStateMachine.transition(status, 'pass');
    expect(status).toBe('done');
    ctx.repos.ticket.update('t1', { status });

    // Verify final state in DB
    const final = ctx.repos.ticket.findById('t1')!;
    expect(final.status).toBe('done');
    expect(TicketStateMachine.isTerminal('done')).toBe(true);
  });

  it('should handle verification failure loop', () => {
    ctx.repos.ticket.create({
      id: 't1', epicId: 'e1', title: 'Test ticket', description: 'Test',
      status: 'verification', priority: 'medium',
    });

    // verification → in_progress (fail)
    let status = TicketStateMachine.transition('verification', 'fail');
    expect(status).toBe('in_progress');

    // in_progress → verification (submit again)
    status = TicketStateMachine.transition(status, 'submit');
    expect(status).toBe('verification');

    // verification → done (pass this time)
    status = TicketStateMachine.transition(status, 'pass');
    expect(status).toBe('done');
  });

  it('should handle error → failed → retry loop', () => {
    // in_progress → failed (error)
    let status = TicketStateMachine.transition('in_progress', 'error');
    expect(status).toBe('failed');

    // failed → in_progress (retry)
    status = TicketStateMachine.transition(status, 'retry');
    expect(status).toBe('in_progress');
  });

  it('should handle failed → escalated', () => {
    const status = TicketStateMachine.transition('failed', 'escalate');
    expect(status).toBe('escalated');
    expect(TicketStateMachine.isTerminal('escalated')).toBe(true);
  });

  it('should reject invalid transitions', () => {
    expect(() => TicketStateMachine.transition('done', 'start')).toThrow(InvalidTransitionError);
    expect(() => TicketStateMachine.transition('pending_approval', 'start')).toThrow(InvalidTransitionError);
    expect(() => TicketStateMachine.transition('backlog', 'submit')).toThrow(InvalidTransitionError);
  });

  it('should list valid actions for each status', () => {
    expect(TicketStateMachine.getValidActions('pending_approval')).toEqual(['approve']);
    expect(TicketStateMachine.getValidActions('backlog')).toEqual(['assign']);
    expect(TicketStateMachine.getValidActions('in_progress')).toContain('submit');
    expect(TicketStateMachine.getValidActions('in_progress')).toContain('error');
    expect(TicketStateMachine.getValidActions('verification')).toContain('pass');
    expect(TicketStateMachine.getValidActions('verification')).toContain('fail');
    expect(TicketStateMachine.getValidActions('failed')).toContain('retry');
    expect(TicketStateMachine.getValidActions('failed')).toContain('escalate');
    expect(TicketStateMachine.getValidActions('done')).toEqual([]);
  });

  it('should track multiple tickets independently', () => {
    ctx.repos.ticket.create({
      id: 't1', epicId: 'e1', title: 'Ticket 1', description: 'Test',
      status: 'pending_approval', priority: 'high',
    });
    ctx.repos.ticket.create({
      id: 't2', epicId: 'e1', title: 'Ticket 2', description: 'Test',
      status: 'pending_approval', priority: 'medium',
    });

    // Approve t1 but not t2
    ctx.repos.ticket.update('t1', { status: 'backlog' });

    const t1 = ctx.repos.ticket.findById('t1')!;
    const t2 = ctx.repos.ticket.findById('t2')!;
    expect(t1.status).toBe('backlog');
    expect(t2.status).toBe('pending_approval');
  });
});
