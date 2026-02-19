/**
 * ticket_read_comments — allows agents to read comments on their assigned ticket.
 *
 * Used by agents to review previous progress, understand prior decisions,
 * and resume work from where they or other agents left off.
 */
import { z } from 'zod';
import type { Tool, ToolExecutionContext, ToolResult } from '../types.js';
import type { TicketCommentRepository } from '../../db/repositories/ticket-comment.repository.js';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = {
  type: z.enum(['plan', 'progress', 'review', 'comment', 'completion', 'all']).optional()
    .describe('Filter by comment type. Defaults to "all" to show all comments.'),
  limit: z.number().optional()
    .describe('Maximum number of comments to return. Defaults to 20.'),
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a ticket_read_comments tool instance bound to a TicketCommentRepository.
 */
export function createTicketReadCommentsTool(commentRepo: TicketCommentRepository): Tool<typeof schema> {
  return {
    name: 'ticket_read_comments',
    description:
      'Read comments on the ticket you are currently working on. ' +
      'Use this to review previous progress, understand prior decisions, ' +
      'and see what work has already been done. Useful when resuming ' +
      'work on a ticket or reviewing feedback from verification.',
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
        const comments = commentRepo.findByTicketId(context.ticketId);
        const filtered = params.type && params.type !== 'all'
          ? comments.filter((c) => c.type === params.type)
          : comments;
        const limited = filtered.slice(0, params.limit ?? 20);

        if (limited.length === 0) {
          return { success: true, content: 'No comments found on this ticket.' };
        }

        const formatted = limited.map((c) =>
          `[${c.type}] by ${c.author} at ${c.createdAt}\n${c.content}`,
        ).join('\n\n---\n\n');

        return {
          success: true,
          content: `Found ${limited.length} comment(s):\n\n${formatted}`,
        };
      } catch (err) {
        return {
          success: false,
          content: '',
          error: `Failed to read comments: ${err instanceof Error ? err.message : 'unknown error'}`,
        };
      }
    },
  };
}
