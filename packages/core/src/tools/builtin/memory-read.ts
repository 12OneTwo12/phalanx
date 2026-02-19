/**
 * memory_read — allows agents to read their own MEMORY.md during execution.
 *
 * Reads from per-agent memory at `{agentsDir}/{agentId}/MEMORY.md`.
 * Role-level shared memory is already injected into the system prompt,
 * but this tool gives runtime access to personal learnings accumulated
 * across multiple ticket executions.
 */
import { z } from 'zod';
import type { Tool, ToolExecutionContext, ToolResult } from '../types.js';
import type { MemoryFileSystem } from '../../agents/memory-writer.js';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = {
  section: z.string().optional()
    .describe('Optional keyword to filter memory entries (e.g., "debugging", "pattern"). Returns all entries if omitted.'),
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a memory_read tool that reads the agent's per-agent MEMORY.md.
 */
export function createMemoryReadTool(
  agentsDir: string,
  fs: MemoryFileSystem,
): Tool<typeof schema> {
  return {
    name: 'memory_read',
    description:
      'Read your personal MEMORY.md file containing learnings from previous tasks. ' +
      'Use this to recall past decisions, patterns, pitfalls, and insights ' +
      'you accumulated across ticket executions. Optionally filter by a keyword.',
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
        const content = await fs.readFile(memoryPath);

        if (!content.trim()) {
          return { success: true, content: 'Your memory file is empty. No learnings recorded yet.' };
        }

        if (params.section) {
          const keyword = params.section.toLowerCase();
          const lines = content.split('\n');
          const matched = lines.filter(l => l.toLowerCase().includes(keyword));
          if (matched.length === 0) {
            return { success: true, content: `No memory entries matching "${params.section}".` };
          }
          return { success: true, content: matched.join('\n') };
        }

        return { success: true, content };
      } catch {
        return {
          success: true,
          content: 'No personal memory file found yet. Learnings will be recorded as you complete tasks.',
        };
      }
    },
  };
}
