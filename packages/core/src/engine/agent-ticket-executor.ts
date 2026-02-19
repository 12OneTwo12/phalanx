/**
 * Agent ticket executor — implements TicketExecutor by delegating to AgentExecutor.
 * Handles branch isolation, context injection, and result conversion.
 */
import type { Ticket } from '../db/schema.js';
import type { AgentExecutor } from '../agents/agent-executor.js';
import type { AgentConfig, AgentRole, AgentExecutionResult } from '../agents/types.js';
import type { SoulLoader } from '../agents/soul-loader.js';
import type { ResolvedModel, ThinkingLevel } from '../llm/types.js';
import type { AgentToolPermissions } from '../tools/types.js';
import type { TicketExecutor } from './orchestrator.js';
import type { BranchManager } from './branch-manager.js';

// ---------------------------------------------------------------------------
// Post-Execution Hook
// ---------------------------------------------------------------------------

/**
 * Hook called after agent execution completes (success or failure).
 * Used for cross-cutting concerns like MEMORY.md updates, logging, etc.
 */
export interface PostExecutionHook {
  onComplete(context: {
    role: AgentRole;
    result: AgentExecutionResult;
    ticketId: string;
    agentId?: string;
  }): Promise<void>;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Maps ticket categories to agent roles.
 */
const CATEGORY_ROLE_MAP: Record<string, AgentRole> = {
  backend: 'backend',
  frontend: 'frontend',
  qa: 'qa',
  devops: 'devops',
  general: 'backend',
};

export interface AgentTicketExecutorConfig {
  /** Default model to use for agent execution */
  defaultModel: ResolvedModel;
  /** Default thinking level */
  defaultThinkingLevel: ThinkingLevel;
  /** Default tool permissions */
  defaultToolPermissions: AgentToolPermissions;
  /** Working directory for agent execution */
  workingDirectory: string;
  /** Max iterations per agent run */
  maxIterations: number;
  /** Base branch to create ticket branches from */
  baseBranch: string;
  /** Convention text to inject into agent prompt */
  conventions?: string;
}

/**
 * Resolves agent configuration from a ticket.
 */
export interface AgentConfigResolver {
  resolve(ticket: Ticket, defaults: AgentTicketExecutorConfig): {
    role: AgentRole;
    model: ResolvedModel;
    thinkingLevel: ThinkingLevel;
  };
}

/**
 * Default resolver that uses ticket metadata category for role mapping.
 */
export class DefaultAgentConfigResolver implements AgentConfigResolver {
  resolve(ticket: Ticket, defaults: AgentTicketExecutorConfig) {
    const category = this.extractCategory(ticket);
    const role = CATEGORY_ROLE_MAP[category] ?? 'backend';
    return {
      role,
      model: defaults.defaultModel,
      thinkingLevel: defaults.defaultThinkingLevel,
    };
  }

  private extractCategory(ticket: Ticket): string {
    if (!ticket.metadata) return 'general';
    try {
      const meta = JSON.parse(ticket.metadata) as Record<string, unknown>;
      return typeof meta.category === 'string' ? meta.category : 'general';
    } catch {
      return 'general';
    }
  }
}

// ---------------------------------------------------------------------------
// AgentTicketExecutor
// ---------------------------------------------------------------------------

export class AgentTicketExecutor implements TicketExecutor {
  private readonly postExecutionHooks: PostExecutionHook[] = [];

  constructor(
    private readonly agentExecutor: AgentExecutor,
    private readonly branchManager: BranchManager,
    private readonly config: AgentTicketExecutorConfig,
    private readonly soulLoader: SoulLoader,
    private readonly configResolver: AgentConfigResolver = new DefaultAgentConfigResolver(),
  ) {}

  /** Register a hook to be called after each ticket execution */
  addPostExecutionHook(hook: PostExecutionHook): void {
    this.postExecutionHooks.push(hook);
  }

  /**
   * Execute a ticket by:
   * 1. Creating an isolated branch
   * 2. Building agent config from ticket context
   * 3. Running the agent
   * 4. Running post-execution hooks
   * 5. Converting result to TicketExecutor format
   */
  async execute(ticket: Ticket): Promise<{ success: boolean; error?: string }> {
    try {
      // Create isolated branch for this ticket
      // Delegate slug normalization to BranchManager (single source of truth)
      await this.branchManager.createTicketBranch(ticket.id, ticket.title);

      // Build agent config (loads soul from templates)
      const resolved = this.configResolver.resolve(ticket, this.config);
      const agentConfig = await this.buildAgentConfig(ticket, resolved);

      // Build task prompt with ticket context
      const task = this.buildTaskPrompt(ticket);

      // Execute agent
      const result = await this.agentExecutor.run(agentConfig, task);

      // Run post-execution hooks (fire-and-forget, don't fail the ticket)
      for (const hook of this.postExecutionHooks) {
        try {
          await hook.onComplete({
            role: resolved.role,
            result,
            ticketId: ticket.id,
            agentId: ticket.assignedAgentId ?? undefined,
          });
        } catch (hookErr) {
          // Hook failure should not affect ticket result
          console.warn(`[phalanx] Post-execution hook failed for ticket ${ticket.id}:`, hookErr);
        }
      }

      if (result.status === 'completed') {
        return { success: true };
      }

      return {
        success: false,
        error: result.error ?? `Agent finished with status: ${result.status}`,
      };
    } catch (err) {
      console.error(`[phalanx] AgentTicketExecutor failed for ticket ${ticket.id}:`, err);
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async buildAgentConfig(
    ticket: Ticket,
    resolved: { role: AgentRole; model: ResolvedModel; thinkingLevel: ThinkingLevel },
  ): Promise<AgentConfig> {
    // Load soul/identity/memory/skills from templates/{role}/
    const soul = await this.soulLoader.load(resolved.role);

    return {
      id: ticket.assignedAgentId ?? `ticket-${ticket.id}`,
      role: resolved.role,
      soul,
      model: resolved.model,
      tools: this.config.defaultToolPermissions,
      workingDirectory: this.config.workingDirectory,
      maxIterations: this.config.maxIterations,
      thinkingLevel: resolved.thinkingLevel,
      ticketId: ticket.id,
      conventions: this.config.conventions,
    };
  }

  private buildTaskPrompt(ticket: Ticket): string {
    const sections: string[] = [
      `# Ticket: ${ticket.title}`,
      `## Description\n${ticket.description}`,
    ];

    if (ticket.priority) {
      sections.push(`## Priority: ${ticket.priority}`);
    }

    if (this.config.conventions) {
      sections.push(`## Project Conventions\n${this.config.conventions}`);
    }

    sections.push(
      '## Instructions',
      'Implement the changes described above. Write clean, tested code.',
      'Commit your changes with conventional commit messages.',
      '',
      '## Memory',
      'Use `memory_read` to recall learnings from your previous tasks.',
      'Use `memory_write` to record useful patterns, pitfalls, or insights discovered during this task.',
      '',
      '## Progress Tracking',
      'Before starting, use `ticket_read_comments` to check for prior work or feedback on this ticket.',
      'Use the `ticket_comment` tool to document your work:',
      '1. At the start: Post your implementation plan (type: "plan")',
      '2. During work: Post key decisions and progress updates (type: "progress")',
      '3. At completion: Post a summary of what was done (type: "progress")',
    );

    return sections.join('\n\n');
  }

}
