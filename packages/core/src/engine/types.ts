import { z } from 'zod';

// ---------------------------------------------------------------------------
// Ticket Status & Transitions
// ---------------------------------------------------------------------------

export const TicketStatus = z.enum([
  'pending_approval',
  'backlog',
  'assigned',
  'in_progress',
  'verification',
  'done',
  'failed',
  'escalated',
]);
export type TicketStatus = z.infer<typeof TicketStatus>;

export const TicketAction = z.enum([
  'approve',
  'assign',
  'start',
  'submit',
  'pass',
  'fail',
  'error',
  'retry',
  'reset',
  'escalate',
]);
export type TicketAction = z.infer<typeof TicketAction>;

// ---------------------------------------------------------------------------
// Goal Status
// ---------------------------------------------------------------------------

export const GoalStatus = z.enum(['active', 'completed', 'paused']);
export type GoalStatus = z.infer<typeof GoalStatus>;

// ---------------------------------------------------------------------------
// Priority
// ---------------------------------------------------------------------------

export const Priority = z.enum(['critical', 'high', 'medium', 'low']);
export type Priority = z.infer<typeof Priority>;

// ---------------------------------------------------------------------------
// Engine Events
// ---------------------------------------------------------------------------

export interface EngineEvent {
  type: string;
  timestamp: Date;
  payload: Record<string, unknown>;
}

export interface TicketTransitionEvent extends EngineEvent {
  type: 'ticket:transition';
  payload: {
    ticketId: string;
    from: TicketStatus;
    to: TicketStatus;
    action: TicketAction;
  };
}

export interface GoalProgressEvent extends EngineEvent {
  type: 'goal:progress';
  payload: {
    goalId: string;
    progress: number;
  };
}

export interface TicketAssignedEvent extends EngineEvent {
  type: 'ticket:assigned';
  payload: {
    ticketId: string;
    agentId: string;
  };
}

// ---------------------------------------------------------------------------
// Engine Config
// ---------------------------------------------------------------------------

export interface EngineConfig {
  /** Maximum concurrent ticket executions */
  maxConcurrency: number;
  /** Maximum retries before escalation */
  maxRetries: number;
  /** Default priority for new tickets */
  defaultPriority: Priority;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  maxConcurrency: 3,
  maxRetries: 3,
  defaultPriority: 'medium',
};

// ---------------------------------------------------------------------------
// Decomposition types
// ---------------------------------------------------------------------------

export interface DecomposedEpic {
  title: string;
  description: string;
  tickets: DecomposedTicket[];
}

export interface DecomposedTicket {
  title: string;
  description: string;
  priority: Priority;
  dependsOn: string[]; // Titles of other tickets this depends on
  category: string; // 'backend' | 'frontend' | 'qa' | 'devops'
}

export interface DecompositionResult {
  goalId: string;
  epics: DecomposedEpic[];
}

// ---------------------------------------------------------------------------
// Approval types
// ---------------------------------------------------------------------------

export type ApprovalDecision = 'approve' | 'reject' | 'modify';

export interface ApprovalRequest {
  ticketId: string;
  decision: ApprovalDecision;
  modifications?: {
    title?: string;
    description?: string;
    priority?: Priority;
  };
}

// ---------------------------------------------------------------------------
// Verification types
// ---------------------------------------------------------------------------

export const VerificationStatus = z.enum(['passed', 'failed', 'error']);
export type VerificationStatus = z.infer<typeof VerificationStatus>;

export interface VerificationResult {
  ticketId: string;
  status: VerificationStatus;
  checks: VerificationCheckResult[];
  feedback?: string;
}

export interface VerificationCheckResult {
  name: string;
  passed: boolean;
  details?: string;
}

// ---------------------------------------------------------------------------
// Reverse Proposal types
// ---------------------------------------------------------------------------

export interface ReverseProposalRequest {
  agentId: string;
  reason: string;
  suggestion: string;
  diff?: string;
}
