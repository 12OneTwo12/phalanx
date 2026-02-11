/**
 * Agent ticket executor — implements TicketExecutor by delegating to AgentExecutor.
 * Handles branch isolation, context injection, and result conversion.
 */
import type { Ticket } from '../db/schema.js';
import type { AgentExecutor } from '../agents/agent-executor.js';
import type { AgentConfig, AgentRole, AgentSoulConfig } from '../agents/types.js';
import type { ResolvedModel, ThinkingLevel } from '../llm/types.js';
import type { AgentToolPermissions } from '../tools/types.js';
import type { TicketExecutor } from './orchestrator.js';
import type { BranchManager } from './branch-manager.js';

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
  constructor(
    private readonly agentExecutor: AgentExecutor,
    private readonly branchManager: BranchManager,
    private readonly config: AgentTicketExecutorConfig,
    private readonly configResolver: AgentConfigResolver = new DefaultAgentConfigResolver(),
  ) {}

  /**
   * Execute a ticket by:
   * 1. Creating an isolated branch
   * 2. Building agent config from ticket context
   * 3. Running the agent
   * 4. Converting result to TicketExecutor format
   */
  async execute(ticket: Ticket): Promise<{ success: boolean; error?: string }> {
    const slug = this.slugify(ticket.title);
    let branchName: string | undefined;

    try {
      // Create isolated branch for this ticket
      branchName = await this.branchManager.createTicketBranch(ticket.id, slug);

      // Build agent config
      const resolved = this.configResolver.resolve(ticket, this.config);
      const agentConfig = this.buildAgentConfig(ticket, resolved);

      // Build task prompt with ticket context
      const task = this.buildTaskPrompt(ticket);

      // Execute agent
      const result = await this.agentExecutor.run(agentConfig, task);

      if (result.status === 'completed') {
        return { success: true };
      }

      return {
        success: false,
        error: result.error ?? `Agent finished with status: ${result.status}`,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private buildAgentConfig(
    ticket: Ticket,
    resolved: { role: AgentRole; model: ResolvedModel; thinkingLevel: ThinkingLevel },
  ): AgentConfig {
    const soul: AgentSoulConfig = {
      soul: '',
      identity: `You are a ${resolved.role} agent working on ticket ${ticket.id}.`,
      memory: '',
      skills: '',
    };

    return {
      id: `ticket-${ticket.id}`,
      role: resolved.role,
      soul,
      model: resolved.model,
      tools: this.config.defaultToolPermissions,
      workingDirectory: this.config.workingDirectory,
      maxIterations: this.config.maxIterations,
      thinkingLevel: resolved.thinkingLevel,
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
    );

    return sections.join('\n\n');
  }

  private slugify(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'task';
  }
}
