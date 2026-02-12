/**
 * safeExecute — error isolation utility for engine operations.
 *
 * Wraps async operations in try/catch and returns a typed Result<T>.
 * Used by DaemonWiring event handlers and Orchestrator to prevent
 * cascading failures from individual operation errors.
 */

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// ---------------------------------------------------------------------------
// safeExecute
// ---------------------------------------------------------------------------

export interface SafeExecuteContext {
  operation: string;
  ticketId?: string;
  agentId?: string;
}

/**
 * Execute an async function with error isolation.
 * Returns a Result<T> instead of throwing.
 */
export async function safeExecute<T>(
  fn: () => Promise<T>,
  context: SafeExecuteContext,
): Promise<Result<T>> {
  try {
    const value = await fn();
    return { ok: true, value };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    error.message = `[${context.operation}]${context.ticketId ? ` ticket=${context.ticketId}` : ''}${context.agentId ? ` agent=${context.agentId}` : ''}: ${error.message}`;
    return { ok: false, error };
  }
}

// ---------------------------------------------------------------------------
// RecoveryManager
// ---------------------------------------------------------------------------

export type RecoveryState = 'idle' | 'recovering' | 'complete' | 'failed';

/**
 * Tracks recovery attempts for a given resource (ticket, agent, etc.).
 * Limits retry attempts and tracks state transitions.
 */
export class RecoveryManager {
  private readonly states = new Map<string, { state: RecoveryState; attempts: number }>();

  constructor(private readonly maxAttempts: number = 3) {}

  /** Start recovery for a resource. Returns false if max attempts exceeded. */
  startRecovery(resourceId: string): boolean {
    const entry = this.states.get(resourceId) ?? { state: 'idle' as RecoveryState, attempts: 0 };

    if (entry.attempts >= this.maxAttempts) {
      entry.state = 'failed';
      this.states.set(resourceId, entry);
      return false;
    }

    entry.state = 'recovering';
    entry.attempts++;
    this.states.set(resourceId, entry);
    return true;
  }

  /** Mark recovery as complete for a resource. */
  complete(resourceId: string): void {
    const entry = this.states.get(resourceId);
    if (entry) {
      entry.state = 'complete';
    }
  }

  /** Get current state for a resource. */
  getState(resourceId: string): { state: RecoveryState; attempts: number } {
    return this.states.get(resourceId) ?? { state: 'idle', attempts: 0 };
  }

  /** Clear recovery tracking for a resource. */
  clear(resourceId: string): void {
    this.states.delete(resourceId);
  }

  /** Clear all recovery tracking. */
  clearAll(): void {
    this.states.clear();
  }
}
