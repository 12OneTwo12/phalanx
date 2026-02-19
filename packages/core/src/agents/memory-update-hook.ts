/**
 * MemoryUpdateHook — PostExecutionHook that extracts learnings from agent
 * execution results and appends them to the agent's MEMORY.md.
 *
 * Writes to two targets:
 *   1. Role-level: `{templatesDir}/{role}/MEMORY.md` (shared knowledge)
 *   2. Per-agent:  `{agentsDir}/{agentId}/MEMORY.md` (individual memory)
 *
 * Only MEMORY.md is modified. SOUL.md, IDENTITY.md, and SKILLS.md are
 * never touched by this hook (those are user-managed or system-generated).
 */
import { MemoryWriter, type MemoryFileSystem } from './memory-writer.js';
import type { PostExecutionHook } from '../engine/agent-ticket-executor.js';
import type { AgentRole, AgentExecutionResult } from './types.js';

export class MemoryUpdateHook implements PostExecutionHook {
  private readonly writer: MemoryWriter;
  private readonly agentsDir: string | undefined;

  constructor(templatesDir: string, fs: MemoryFileSystem, agentsDir?: string) {
    this.writer = new MemoryWriter(templatesDir, fs);
    this.agentsDir = agentsDir;
  }

  async onComplete(context: {
    role: AgentRole;
    result: AgentExecutionResult;
    ticketId: string;
    agentId?: string;
  }): Promise<void> {
    // Only extract learnings from successful completions
    if (context.result.status !== 'completed') return;

    const learnings = this.writer.extractLearnings(
      context.result.finalContent,
      context.ticketId,
    );

    if (learnings.length > 0) {
      try {
        // Write to role template (shared knowledge)
        await this.writer.appendLearnings(context.role, learnings);

        // Write to per-agent memory if agentId is available
        if (context.agentId && this.agentsDir) {
          const agentMemoryPath = `${this.agentsDir}/${context.agentId}/MEMORY.md`;
          await this.writer.appendLearningsToPath(agentMemoryPath, learnings);
        }
      } catch {
        // Hook failure should not crash the engine
      }
    }
  }
}
