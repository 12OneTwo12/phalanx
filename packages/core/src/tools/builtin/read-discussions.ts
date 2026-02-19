/**
 * read_discussions — allows agents to read past team discussions.
 *
 * Agents can query discussions linked to their current ticket or
 * read a specific discussion by ID to understand prior decisions.
 */
import { z } from 'zod';
import type { Tool, ToolExecutionContext, ToolResult } from '../types.js';
import type { DebateOrchestrator } from '../../engine/debate-orchestrator.js';
import type { TicketRepository } from '../../db/repositories/ticket.repository.js';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = {
  debateId: z.string().optional().describe(
    'Read a specific discussion by its debate ID.',
  ),
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a read_discussions tool bound to DebateOrchestrator and TicketRepository.
 * Uses context.ticketId to find discussions linked to the current ticket.
 */
export function createReadDiscussionsTool(
  debateOrchestrator: DebateOrchestrator,
  ticketRepo: TicketRepository,
): Tool<typeof schema> {
  return {
    name: 'read_discussions',
    description:
      'Read past team discussions and decisions. ' +
      'Without arguments, shows discussions linked to your current ticket. ' +
      'Use debateId to read a specific discussion. ' +
      'Useful for understanding prior architectural decisions before making changes.',
    category: 'analysis',
    schema,

    async execute(
      params: z.infer<z.ZodObject<typeof schema>>,
      context: ToolExecutionContext,
    ): Promise<ToolResult> {
      try {
        // If specific debate ID requested
        if (params.debateId) {
          return formatSingleDebate(debateOrchestrator, params.debateId);
        }

        // Find discussions linked to current ticket
        if (context.ticketId) {
          return formatTicketDiscussions(debateOrchestrator, ticketRepo, context.ticketId);
        }

        // No context: show recent concluded discussions
        const concluded = debateOrchestrator.findByStatus('concluded');
        if (concluded.length === 0) {
          return { success: true, content: 'No discussions found.' };
        }

        const recent = concluded.slice(-5);
        const lines: string[] = ['## Recent Discussions', ''];
        for (const d of recent) {
          lines.push(`- **${d.topic}** (${d.id.slice(0, 8)}) — ${d.conclusion?.slice(0, 100) ?? 'No conclusion'}...`);
        }

        return { success: true, content: lines.join('\n') };
      } catch (err) {
        return {
          success: false,
          content: '',
          error: `Failed to read discussions: ${err instanceof Error ? err.message : 'unknown error'}`,
        };
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSingleDebate(
  orchestrator: DebateOrchestrator,
  debateId: string,
): ToolResult {
  const args = orchestrator.getArguments(debateId);
  if (args.length === 0) {
    return { success: true, content: `No arguments found for discussion ${debateId}.` };
  }

  // Get debate status from first arg's debateId relationship
  const debates = orchestrator.findByStatus('concluded');
  const debate = debates.find(d => d.id === debateId)
    ?? orchestrator.findByStatus('active').find(d => d.id === debateId);

  const lines: string[] = [];
  if (debate) {
    lines.push(`## Discussion: ${debate.topic}`, `Status: ${debate.status}`, '');
    if (debate.conclusion) {
      lines.push(`**Conclusion:** ${debate.conclusion}`, '');
    }
  }

  lines.push('### Arguments:', '');
  for (const arg of args) {
    lines.push(`**${arg.agentId.slice(0, 8)}** (Round ${arg.round}) — ${arg.position}`);
    lines.push(arg.argument);
    if (arg.evidence) lines.push(`_Evidence: ${arg.evidence}_`);
    lines.push('');
  }

  return { success: true, content: lines.join('\n') };
}

function formatTicketDiscussions(
  orchestrator: DebateOrchestrator,
  ticketRepo: TicketRepository,
  ticketId: string,
): ToolResult {
  const ticket = ticketRepo.findById(ticketId);
  if (!ticket?.metadata) {
    return { success: true, content: 'No discussions linked to this ticket.' };
  }

  let meta: Record<string, unknown>;
  try {
    meta = JSON.parse(ticket.metadata) as Record<string, unknown>;
  } catch {
    return { success: true, content: 'No discussions linked to this ticket.' };
  }

  const discussionIds = Array.isArray(meta.discussions) ? meta.discussions as string[] : [];
  // Also check legacy single debateId field
  if (typeof meta.debateId === 'string' && !discussionIds.includes(meta.debateId)) {
    discussionIds.unshift(meta.debateId);
  }

  if (discussionIds.length === 0) {
    return { success: true, content: 'No discussions linked to this ticket.' };
  }

  const lines: string[] = [`## Discussions for ticket ${ticketId}`, ''];
  for (const debateId of discussionIds) {
    const args = orchestrator.getArguments(debateId);
    const debates = orchestrator.findByStatus('concluded');
    const debate = debates.find(d => d.id === debateId);

    if (debate) {
      lines.push(`### ${debate.topic}`);
      lines.push(`Conclusion: ${debate.conclusion ?? 'Pending'}`);
      lines.push(`Participants: ${args.length} arguments`);
      lines.push('');
    } else {
      lines.push(`### Discussion ${debateId.slice(0, 8)} (${args.length} arguments)`);
      lines.push('');
    }
  }

  return { success: true, content: lines.join('\n') };
}
