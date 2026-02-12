/**
 * Declarative ticket state machine.
 * Defines valid state transitions for the ticket lifecycle.
 */
import { type TicketStatus, type TicketAction } from './types.js';

// ---------------------------------------------------------------------------
// Transition Table
// ---------------------------------------------------------------------------

interface Transition {
  from: TicketStatus;
  action: TicketAction;
  to: TicketStatus;
}

const TRANSITIONS: readonly Transition[] = [
  { from: 'pending_approval', action: 'approve', to: 'backlog' },
  { from: 'backlog', action: 'assign', to: 'assigned' },
  { from: 'assigned', action: 'start', to: 'in_progress' },
  { from: 'in_progress', action: 'submit', to: 'verification' },
  { from: 'verification', action: 'pass', to: 'done' },
  { from: 'verification', action: 'fail', to: 'in_progress' },
  { from: 'in_progress', action: 'error', to: 'failed' },
  { from: 'failed', action: 'retry', to: 'in_progress' },
  { from: 'failed', action: 'reset', to: 'backlog' },
  { from: 'failed', action: 'escalate', to: 'escalated' },
] as const;

// Build a lookup map for O(1) transition checks
const transitionMap = new Map<string, TicketStatus>();
for (const t of TRANSITIONS) {
  transitionMap.set(`${t.from}:${t.action}`, t.to);
}

// ---------------------------------------------------------------------------
// State Machine
// ---------------------------------------------------------------------------

export class TicketStateMachine {
  /**
   * Attempt a state transition. Returns the new status or throws if invalid.
   */
  static transition(currentStatus: TicketStatus, action: TicketAction): TicketStatus {
    const key = `${currentStatus}:${action}`;
    const nextStatus = transitionMap.get(key);

    if (!nextStatus) {
      throw new InvalidTransitionError(currentStatus, action);
    }

    return nextStatus;
  }

  /**
   * Check if a transition is valid without performing it.
   */
  static canTransition(currentStatus: TicketStatus, action: TicketAction): boolean {
    return transitionMap.has(`${currentStatus}:${action}`);
  }

  /**
   * Get all valid actions from a given status.
   */
  static getValidActions(currentStatus: TicketStatus): TicketAction[] {
    return TRANSITIONS
      .filter((t) => t.from === currentStatus)
      .map((t) => t.action);
  }

  /**
   * Get the full transition table.
   */
  static getTransitions(): readonly Transition[] {
    return TRANSITIONS;
  }

  /**
   * Check if a status is terminal (no outgoing transitions).
   */
  static isTerminal(status: TicketStatus): boolean {
    return TRANSITIONS.every((t) => t.from !== status);
  }
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: TicketStatus,
    public readonly action: TicketAction,
  ) {
    super(`Invalid transition: cannot perform "${action}" from status "${from}"`);
    this.name = 'InvalidTransitionError';
  }
}
