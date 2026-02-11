import { z } from 'zod';
import type { ThinkingLevel, Message, TokenUsage, ResolvedModel } from '../llm/types.js';
import type { AgentToolPermissions } from '../tools/types.js';

// ---------------------------------------------------------------------------
// Agent Role
// ---------------------------------------------------------------------------

export const AgentRole = z.enum(['team-lead', 'backend', 'frontend', 'qa', 'customer']);
export type AgentRole = z.infer<typeof AgentRole>;

// ---------------------------------------------------------------------------
// Agent Status
// ---------------------------------------------------------------------------

export type AgentStatus = 'idle' | 'running' | 'completed' | 'error' | 'escalated';

// ---------------------------------------------------------------------------
// Agent Soul Config
// ---------------------------------------------------------------------------

/** Contents of SOUL.md, IDENTITY.md, MEMORY.md, SKILLS.md */
export interface AgentSoulConfig {
  soul: string;
  identity: string;
  memory: string;
  skills: string;
}

// ---------------------------------------------------------------------------
// Agent Config
// ---------------------------------------------------------------------------

/** Full configuration for creating an agent */
export interface AgentConfig {
  id: string;
  role: AgentRole;
  soul: AgentSoulConfig;
  model: ResolvedModel;
  tools: AgentToolPermissions;
  maxIterations: number;
  temperature?: number;
  thinkingLevel?: ThinkingLevel;
}

// ---------------------------------------------------------------------------
// Agent Execution Result
// ---------------------------------------------------------------------------

/** Result after agent execution completes */
export interface AgentExecutionResult {
  status: AgentStatus;
  finalContent: string;
  conversationHistory: Message[];
  iterations: number;
  totalUsage: TokenUsage;
  toolCallCount: number;
  error?: string;
}
