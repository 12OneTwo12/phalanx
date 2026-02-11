/**
 * Notepad — per-ticket learning/issue/verification record system.
 * File-based storage in .phalanx/notepad/{ticket-id}/
 */

/**
 * Filesystem abstraction for testability.
 */
export interface NotepadFileSystem {
  mkdir(path: string, options: { recursive: boolean }): Promise<void>;
  appendFile(path: string, content: string): Promise<void>;
  readFile(path: string): Promise<string>;
  exists(path: string): Promise<boolean>;
}

export type NotepadCategory = 'learnings' | 'issues' | 'verification';

export class Notepad {
  constructor(
    private readonly fs: NotepadFileSystem,
    private readonly baseDir: string,
  ) {}

  /**
   * Append an entry to a notepad category for a ticket.
   */
  async append(ticketId: string, category: NotepadCategory, content: string): Promise<void> {
    const dir = this.getTicketDir(ticketId);
    await this.fs.mkdir(dir, { recursive: true });

    const filePath = `${dir}/${category}.md`;
    const timestamp = new Date().toISOString();
    const entry = `\n## ${timestamp}\n\n${content}\n`;

    await this.fs.appendFile(filePath, entry);
  }

  /**
   * Read all entries for a ticket's notepad category.
   */
  async read(ticketId: string, category: NotepadCategory): Promise<string> {
    const filePath = `${this.getTicketDir(ticketId)}/${category}.md`;
    const exists = await this.fs.exists(filePath);
    if (!exists) return '';
    return this.fs.readFile(filePath);
  }

  /**
   * Get the directory path for a ticket's notepad.
   */
  getTicketDir(ticketId: string): string {
    return `${this.baseDir}/.phalanx/notepad/${ticketId}`;
  }
}
