/**
 * TeamLeadChatService — generates Team Lead LLM responses for channel messages.
 *
 * Builds a system prompt from the Team Lead's soul config and project context
 * (goals, tickets, agents), converts channel history to LLM messages, and
 * calls the LLM provider to generate a contextual response.
 */
import type { LLMProvider, Message } from '../llm/types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: 'user' | 'team-lead';
  content: string;
}

export interface ProjectContext {
  goals?: Array<{ title?: string; description: string; status: string }>;
  agents?: Array<{ name: string; role: string; status: string }>;
  activeTicketCount?: number;
}

export interface TeamLeadChatConfig {
  /** Team Lead soul/personality prompt */
  soulPrompt?: string;
  /** Model to use */
  model: string;
  /** Max tokens for response */
  maxTokens: number;
  /** Temperature */
  temperature: number;
}

const DEFAULT_CONFIG: TeamLeadChatConfig = {
  model: 'claude-sonnet-4-5-20250929',
  maxTokens: 2048,
  temperature: 0.5,
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class TeamLeadChatService {
  private readonly config: TeamLeadChatConfig;

  constructor(
    private readonly provider: LLMProvider,
    config?: Partial<TeamLeadChatConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate a Team Lead response given channel history and project context.
   */
  async respond(
    history: ChatMessage[],
    context?: ProjectContext,
  ): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(context);
    const messages = this.convertHistory(history);

    const result = await this.provider.chat({
      model: this.config.model,
      messages,
      systemPrompt,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
    });

    return result.content;
  }

  private buildSystemPrompt(context?: ProjectContext): string {
    const sections: string[] = [];

    // Soul prompt
    if (this.config.soulPrompt) {
      sections.push(this.config.soulPrompt);
    } else {
      sections.push(
        `You are the Team Lead of an autonomous AI development team called Phalanx. ` +
        `You coordinate agents (backend, frontend, QA, DevOps) to accomplish goals. ` +
        `Respond concisely and professionally. Focus on actionable information.`,
      );
    }

    // Project context
    if (context) {
      const contextParts: string[] = ['## Current Project State\n'];

      if (context.goals && context.goals.length > 0) {
        contextParts.push('### Goals');
        for (const g of context.goals) {
          contextParts.push(`- **${g.title ?? g.description}** (${g.status})`);
        }
      }

      if (context.agents && context.agents.length > 0) {
        contextParts.push('\n### Team');
        for (const a of context.agents) {
          contextParts.push(`- ${a.name} (${a.role}) — ${a.status}`);
        }
      }

      if (context.activeTicketCount !== undefined) {
        contextParts.push(`\n### Tickets\n- Active: ${context.activeTicketCount}`);
      }

      sections.push(contextParts.join('\n'));
    }

    return sections.join('\n\n');
  }

  private convertHistory(history: ChatMessage[]): Message[] {
    return history.map(msg => ({
      role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
      content: msg.content,
    }));
  }
}
