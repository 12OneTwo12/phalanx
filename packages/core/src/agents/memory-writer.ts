/**
 * MemoryWriter — appends learnings to an agent's MEMORY.md file.
 *
 * Supports two write targets:
 *   1. Role-level: `{templatesDir}/{role}/MEMORY.md` (shared knowledge per role)
 *   2. Per-agent: arbitrary path via `appendLearningsToPath` (individual memory)
 */
import type { AgentRole } from './types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MemoryEntry {
  /** Short category tag (e.g., 'debugging', 'pattern', 'pitfall') */
  category: string;
  /** The learning content */
  content: string;
  /** Optional ticket ID that produced the learning */
  ticketId?: string;
}

/** Filesystem abstraction for testability */
export interface MemoryFileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  /** Ensure a directory exists (optional, used for per-agent memory) */
  ensureDir?(path: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// MemoryWriter
// ---------------------------------------------------------------------------

export class MemoryWriter {
  constructor(
    private readonly templatesDir: string,
    private readonly fs: MemoryFileSystem,
  ) {}

  /**
   * Parse structured learnings from raw agent output.
   * Expects lines prefixed with `- [category] content`.
   * Returns empty array for unparseable input.
   */
  extractLearnings(raw: string, ticketId?: string): MemoryEntry[] {
    if (!raw || !raw.trim()) return [];

    const entries: MemoryEntry[] = [];
    const lines = raw.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      // Match: - [category] content  or  * [category] content
      const match = trimmed.match(/^[-*]\s+\[([^\]]+)]\s+(.+)$/);
      if (match) {
        entries.push({
          category: match[1].trim().toLowerCase(),
          content: match[2].trim(),
          ticketId,
        });
      }
    }

    return entries;
  }

  /**
   * Append learnings to an agent role's MEMORY.md file.
   * Creates the file if it doesn't exist.
   * Deduplicates against existing entries by content.
   */
  async appendLearnings(role: AgentRole, entries: MemoryEntry[]): Promise<number> {
    if (entries.length === 0) return 0;
    const memoryPath = `${this.templatesDir}/${role}/MEMORY.md`;
    return this.appendToFile(memoryPath, entries);
  }

  /**
   * Append learnings to an arbitrary MEMORY.md path.
   * Used for per-agent memory files. Ensures parent directory exists.
   */
  async appendLearningsToPath(memoryPath: string, entries: MemoryEntry[]): Promise<number> {
    if (entries.length === 0) return 0;

    // Ensure parent directory exists
    const parentDir = memoryPath.substring(0, memoryPath.lastIndexOf('/'));
    if (parentDir && this.fs.ensureDir) {
      await this.fs.ensureDir(parentDir);
    }

    return this.appendToFile(memoryPath, entries);
  }

  /**
   * Core append logic: read existing, deduplicate, format, write.
   */
  private async appendToFile(memoryPath: string, entries: MemoryEntry[]): Promise<number> {
    let existing = '';
    try {
      existing = await this.fs.readFile(memoryPath);
    } catch {
      // File doesn't exist yet — start fresh
    }

    // Deduplicate: skip entries whose formatted line already exists in MEMORY.md.
    const existingLines = new Set(existing.split('\n').map(l => l.trim()));
    const newEntries = entries.filter(e => {
      const ticketTag = e.ticketId ? ` _(${e.ticketId})_` : '';
      const formatted = `- **[${e.category}]** ${e.content}${ticketTag}`;
      return !existingLines.has(formatted);
    });
    if (newEntries.length === 0) return 0;

    // Format new section
    const timestamp = new Date().toISOString().split('T')[0];
    const section = this.formatSection(newEntries, timestamp);

    const updated = existing.trimEnd()
      ? `${existing.trimEnd()}\n\n${section}`
      : section;

    await this.fs.writeFile(memoryPath, updated);
    return newEntries.length;
  }

  private formatSection(entries: MemoryEntry[], date: string): string {
    const lines = [`## Learnings (${date})\n`];
    for (const entry of entries) {
      const ticketTag = entry.ticketId ? ` _(${entry.ticketId})_` : '';
      lines.push(`- **[${entry.category}]** ${entry.content}${ticketTag}`);
    }
    return lines.join('\n');
  }
}
