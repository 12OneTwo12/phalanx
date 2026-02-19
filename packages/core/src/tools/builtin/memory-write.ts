/**
 * memory_write — allows agents to explicitly write learnings to their MEMORY.md.
 *
 * While the MemoryUpdateHook automatically extracts learnings after task
 * completion, this tool lets agents proactively record insights during
 * execution — useful for capturing real-time discoveries, debugging notes,
 * or patterns noticed mid-task.
 */
import { z } from 'zod';
import type { Tool, ToolExecutionContext, ToolResult } from '../types.js';
import { MemoryWriter, type MemoryFileSystem } from '../../agents/memory-writer.js';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = {
  category: z.string()
    .describe('Category tag for the learning (e.g., "debugging", "pattern", "pitfall", "tool", "architecture").'),
  content: z.string()
    .describe('The learning or insight to record. Be concise but include enough context to be useful later.'),
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a memory_write tool that appends learnings to the agent's MEMORY.md.
 */
export function createMemoryWriteTool(
  agentsDir: string,
  fs: MemoryFileSystem,
): Tool<typeof schema> {
  const writer = new MemoryWriter(agentsDir, fs);

  return {
    name: 'memory_write',
    description:
      'Record a learning or insight to your personal MEMORY.md file. ' +
      'Use this to save useful patterns, debugging discoveries, pitfalls, ' +
      'or architectural decisions you want to remember for future tasks. ' +
      'Each entry is tagged with a category and deduplicated automatically.',
    category: 'analysis',
    schema,

    async execute(
      params: z.infer<z.ZodObject<typeof schema>>,
      context: ToolExecutionContext,
    ): Promise<ToolResult> {
      if (!context.agentId) {
        return { success: false, content: '', error: 'No agent context available.' };
      }

      const memoryPath = `${agentsDir}/${context.agentId}/MEMORY.md`;

      try {
        const count = await writer.appendLearningsToPath(memoryPath, [
          {
            category: params.category.toLowerCase(),
            content: params.content,
            ticketId: context.ticketId,
          },
        ]);

        if (count === 0) {
          return { success: true, content: 'This learning is already recorded in your memory.' };
        }

        return {
          success: true,
          content: `Learning recorded to your memory: [${params.category}] ${params.content}`,
        };
      } catch (err) {
        return {
          success: false,
          content: '',
          error: `Failed to write memory: ${err instanceof Error ? err.message : 'unknown error'}`,
        };
      }
    },
  };
}
