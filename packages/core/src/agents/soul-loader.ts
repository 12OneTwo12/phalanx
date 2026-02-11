import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { AgentSoulConfig, AgentRole } from './types.js';

// ---------------------------------------------------------------------------
// Soul Loader
// ---------------------------------------------------------------------------

/**
 * Loads agent soul configuration from markdown template files.
 *
 * Each agent role has a directory under `templatesDir/{role}/` containing
 * SOUL.md, IDENTITY.md, MEMORY.md, and SKILLS.md files. Missing files
 * are treated as empty strings (graceful degradation).
 */
export class SoulLoader {
  private templatesDir: string;

  constructor(templatesDir: string) {
    this.templatesDir = templatesDir;
  }

  /**
   * Load soul config for a given agent role.
   * Reads SOUL.md, IDENTITY.md, MEMORY.md, SKILLS.md from templatesDir/{role}/.
   * Missing files result in empty strings.
   */
  async load(role: AgentRole): Promise<AgentSoulConfig> {
    const roleDir = path.join(this.templatesDir, role);

    const [soul, identity, memory, skills] = await Promise.all([
      this.readFile(path.join(roleDir, 'SOUL.md')),
      this.readFile(path.join(roleDir, 'IDENTITY.md')),
      this.readFile(path.join(roleDir, 'MEMORY.md')),
      this.readFile(path.join(roleDir, 'SKILLS.md')),
    ]);

    return { soul, identity, memory, skills };
  }

  /** Read a file, returning empty string if it doesn't exist. */
  private async readFile(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content.trim();
    } catch {
      return '';
    }
  }
}
