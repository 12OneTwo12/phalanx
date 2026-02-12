/**
 * MemoryUpdateHook — PostExecutionHook that extracts learnings from agent
 * execution results and appends them to the agent's MEMORY.md.
 *
 * Only MEMORY.md is modified. SOUL.md, IDENTITY.md, and SKILLS.md are
 * never touched by this hook (those are user-managed or system-generated).
 */
import { MemoryWriter, type MemoryFileSystem } from './memory-writer.js';
import type { PostExecutionHook } from '../engine/agent-ticket-executor.js';
import type { AgentRole, AgentExecutionResult } from './types.js';

export class MemoryUpdateHook implements PostExecutionHook {
  private readonly writer: MemoryWriter;

  constructor(templatesDir: string, fs: MemoryFileSystem) {
    this.writer = new MemoryWriter(templatesDir, fs);
  }

  async onComplete(context: {
    role: AgentRole;
    result: AgentExecutionResult;
    ticketId: string;
  }): Promise<void> {
    // Only extract learnings from successful completions
    if (context.result.status !== 'completed') return;

    const learnings = this.writer.extractLearnings(
      context.result.finalContent,
      context.ticketId,
    );

    if (learnings.length > 0) {
      try {
        await this.writer.appendLearnings(context.role, learnings);
      } catch {
        // Hook failure should not crash the engine
      }
    }
  }
}
