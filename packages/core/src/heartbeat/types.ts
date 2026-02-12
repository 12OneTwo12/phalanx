/**
 * Heartbeat system type definitions.
 * Covers configuration, runtime state, context snapshots, and generated reports.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface HeartbeatConfig {
  /** Default interval between heartbeats in milliseconds */
  defaultIntervalMs: number;
  /** Minimum interval (floor) in milliseconds */
  minIntervalMs: number;
  /** Maximum interval (ceiling) in milliseconds */
  maxIntervalMs: number;
  /** Enable adaptive interval adjustment based on activity */
  adaptiveEnabled: boolean;
}

export const DEFAULT_HEARTBEAT_CONFIG: HeartbeatConfig = {
  defaultIntervalMs: 30 * 60_000,   // 30 minutes
  minIntervalMs: 15 * 60_000,       // 15 minutes
  maxIntervalMs: 120 * 60_000,      // 120 minutes
  adaptiveEnabled: true,
};

// ---------------------------------------------------------------------------
// Runtime State
// ---------------------------------------------------------------------------

export interface HeartbeatServiceState {
  /** Active timer reference (null when stopped) */
  timer: ReturnType<typeof setTimeout> | null;
  /** Whether a tick is currently executing (re-entrancy guard) */
  running: boolean;
  /** Timestamp of the last successful run */
  lastRunAtMs: number | null;
  /** Status of the last run */
  lastStatus: 'success' | 'error' | null;
  /** Consecutive error count for backoff calculation */
  consecutiveErrors: number;
  /** Current effective interval in milliseconds */
  currentIntervalMs: number;
}

export function createInitialState(config: HeartbeatConfig): HeartbeatServiceState {
  return {
    timer: null,
    running: false,
    lastRunAtMs: null,
    lastStatus: null,
    consecutiveErrors: 0,
    currentIntervalMs: config.defaultIntervalMs,
  };
}

// ---------------------------------------------------------------------------
// Context Snapshot (collected from repositories)
// ---------------------------------------------------------------------------

export interface HeartbeatContext {
  /** Number of active goals */
  activeGoalCount: number;
  /** Tickets grouped by status */
  ticketsByStatus: Record<string, number>;
  /** Total number of tickets */
  totalTicketCount: number;
  /** Number of pending proposals */
  pendingProposalCount: number;
  /** Number of pending reverse proposals */
  pendingReverseProposalCount: number;
  /** Recent activity log entries (last N) */
  recentActivityCount: number;
  /** Timestamp when context was collected */
  collectedAt: string;
}

// ---------------------------------------------------------------------------
// Report (generated from context)
// ---------------------------------------------------------------------------

export interface HeartbeatReportProposal {
  type: 'new_ticket' | 'priority_change' | 'improvement';
  title: string;
  description: string;
}

export interface HeartbeatReport {
  /** Human-readable summary */
  summary: string;
  /** Context snapshot used to generate this report */
  context: HeartbeatContext;
  /** Generated proposals based on context analysis */
  proposals: HeartbeatReportProposal[];
  /** Whether anything changed since the last heartbeat */
  hasChanges: boolean;
  /** Timestamp of report generation */
  generatedAt: string;
}
