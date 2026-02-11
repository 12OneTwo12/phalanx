import { describe, it, expect } from 'vitest';
import { TicketStateMachine, InvalidTransitionError } from '../../src/engine/ticket-state-machine.js';

describe('TicketStateMachine', () => {
  describe('happy path transitions', () => {
    it('pending_approval → backlog (approve)', () => {
      expect(TicketStateMachine.transition('pending_approval', 'approve')).toBe('backlog');
    });

    it('backlog → assigned (assign)', () => {
      expect(TicketStateMachine.transition('backlog', 'assign')).toBe('assigned');
    });

    it('assigned → in_progress (start)', () => {
      expect(TicketStateMachine.transition('assigned', 'start')).toBe('in_progress');
    });

    it('in_progress → verification (submit)', () => {
      expect(TicketStateMachine.transition('in_progress', 'submit')).toBe('verification');
    });

    it('verification → done (pass)', () => {
      expect(TicketStateMachine.transition('verification', 'pass')).toBe('done');
    });
  });

  describe('failure/retry transitions', () => {
    it('verification → in_progress (fail)', () => {
      expect(TicketStateMachine.transition('verification', 'fail')).toBe('in_progress');
    });

    it('in_progress → failed (error)', () => {
      expect(TicketStateMachine.transition('in_progress', 'error')).toBe('failed');
    });

    it('failed → in_progress (retry)', () => {
      expect(TicketStateMachine.transition('failed', 'retry')).toBe('in_progress');
    });

    it('failed → escalated (escalate)', () => {
      expect(TicketStateMachine.transition('failed', 'escalate')).toBe('escalated');
    });
  });

  describe('invalid transitions', () => {
    it('should throw InvalidTransitionError', () => {
      expect(() => TicketStateMachine.transition('done', 'start')).toThrow(InvalidTransitionError);
    });

    it('should throw for backlog → start (must assign first)', () => {
      expect(() => TicketStateMachine.transition('backlog', 'start')).toThrow(InvalidTransitionError);
    });
  });

  describe('canTransition', () => {
    it('should return true for valid transitions', () => {
      expect(TicketStateMachine.canTransition('pending_approval', 'approve')).toBe(true);
    });

    it('should return false for invalid transitions', () => {
      expect(TicketStateMachine.canTransition('done', 'start')).toBe(false);
    });
  });

  describe('getValidActions', () => {
    it('should return valid actions for in_progress', () => {
      const actions = TicketStateMachine.getValidActions('in_progress');
      expect(actions).toContain('submit');
      expect(actions).toContain('error');
    });

    it('should return empty for terminal states', () => {
      expect(TicketStateMachine.getValidActions('done')).toHaveLength(0);
      expect(TicketStateMachine.getValidActions('escalated')).toHaveLength(0);
    });
  });

  describe('isTerminal', () => {
    it('should identify terminal states', () => {
      expect(TicketStateMachine.isTerminal('done')).toBe(true);
      expect(TicketStateMachine.isTerminal('escalated')).toBe(true);
    });

    it('should identify non-terminal states', () => {
      expect(TicketStateMachine.isTerminal('in_progress')).toBe(false);
      expect(TicketStateMachine.isTerminal('backlog')).toBe(false);
    });
  });
});
