/**
 * request_discussion — allows agents to initiate team discussions during execution.
 *
 * When an agent faces a design decision, it calls this tool to get diverse
 * opinions from team members using different LLM providers.
 * The Tech Lead makes the final decision and the result is recorded.
 */
import { z } from 'zod';
import type { Tool, ToolExecutionContext, ToolResult } from '../types.js';
import type { DiscussionService } from '../../engine/discussion-service.js';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = {
  topic: z.string().describe(
    'The design decision or question to discuss with the team. Be specific about what needs to be decided.',
  ),
  context: z.string().describe(
    'Relevant context: code snippets you analyzed, constraints, existing patterns, trade-offs you identified.',
  ),
  options: z.array(z.string()).optional().describe(
    'Specific options or approaches to consider. Each option should be a concise description.',
  ),
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a request_discussion tool bound to a DiscussionService.
 * Uses context.agentId and context.ticketId from the executing agent.
 */
export function createRequestDiscussionTool(
  discussionService: DiscussionService,
): Tool<typeof schema> {
  return {
    name: 'request_discussion',
    description:
      'Initiate a team discussion to get diverse opinions on a design decision. ' +
      'Team members using different AI models will provide their perspectives, ' +
      'and the Tech Lead will make a final decision. Use this when you face ' +
      'architectural choices, API design decisions, or are unsure about the best approach. ' +
      'The discussion and decision are recorded for the team.',
    category: 'analysis',
    schema,

    async execute(
      params: z.infer<z.ZodObject<typeof schema>>,
      context: ToolExecutionContext,
    ): Promise<ToolResult> {
      try {
        const result = await discussionService.discuss({
          topic: params.topic,
          context: params.context,
          options: params.options,
          ticketId: context.ticketId,
          requestingAgentId: context.agentId,
        });

        // Format result for LLM consumption
        const lines: string[] = [
          `## Discussion Result: ${params.topic}`,
          '',
          `**Decision:** ${result.decision}`,
          `**Reasoning:** ${result.reasoning}`,
          `**Consensus:** ${result.isConsensus ? 'Yes' : 'No (decided by Tech Lead)'}`,
          `**Participants:** ${result.participantCount}`,
          '',
        ];

        if (result.opinions.length > 0) {
          lines.push('### Team Opinions:');
          for (const op of result.opinions) {
            lines.push(
              '',
              `**${op.agentName}** (${op.provider}/${op.model})`,
              `Position: ${op.position}`,
              op.argument,
            );
          }
        }

        lines.push('', `_Discussion recorded as debate #${result.debateId}_`);

        return {
          success: true,
          content: lines.join('\n'),
        };
      } catch (err) {
        return {
          success: false,
          content: '',
          error: `Discussion failed: ${err instanceof Error ? err.message : 'unknown error'}`,
        };
      }
    },
  };
}
