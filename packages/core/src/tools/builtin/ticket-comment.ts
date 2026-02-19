/**
 * ticket_comment — allows agents to write comments on their assigned ticket.
 *
 * Used by agents to record progress updates, decisions, and summaries
 * during ticket execution.
 */
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { Tool, ToolExecutionContext, ToolResult } from '../types.js';
import type { TicketCommentRepository } from '../../db/repositories/ticket-comment.repository.js';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = {
  content: z.string().describe('The comment content to add to the ticket. Use markdown for formatting.'),
  type: z.enum(['plan', 'progress', 'review', 'comment']).optional()
    .describe('Comment type: plan (implementation plan), progress (work update), review (code review), comment (general). Defaults to progress.'),
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a ticket_comment tool instance bound to a TicketCommentRepository.
 * The tool uses context.ticketId to scope comments to the agent's current ticket.
 */
export function createTicketCommentTool(commentRepo: TicketCommentRepository): Tool<typeof schema> {
  return {
    name: 'ticket_comment',
    description:
      'Add a comment to the ticket you are currently working on. ' +
      'Use this to record your implementation plan, progress updates, ' +
      'key decisions, and completion summaries. Your comments are visible ' +
      'to the team and help track your work.',
    category: 'analysis',
    schema,

    async execute(
      params: z.infer<z.ZodObject<typeof schema>>,
      context: ToolExecutionContext,
    ): Promise<ToolResult> {
      if (!context.ticketId) {
        return { success: false, content: '', error: 'No ticket context available.' };
      }

      try {
        commentRepo.create({
          id: randomUUID(),
          ticketId: context.ticketId,
          author: context.agentId,
          type: params.type ?? 'progress',
          content: params.content,
        });

        return {
          success: true,
          content: `Comment added to ticket ${context.ticketId} (type: ${params.type ?? 'progress'}).`,
        };
      } catch (err) {
        return {
          success: false,
          content: '',
          error: `Failed to add comment: ${err instanceof Error ? err.message : 'unknown error'}`,
        };
      }
    },
  };
}
