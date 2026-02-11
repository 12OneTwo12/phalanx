import * as fs from 'node:fs';
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
  load(role: AgentRole): AgentSoulConfig {
    const roleDir = path.join(this.templatesDir, role);

    return {
      soul: this.readFile(path.join(roleDir, 'SOUL.md')),
      identity: this.readFile(path.join(roleDir, 'IDENTITY.md')),
      memory: this.readFile(path.join(roleDir, 'MEMORY.md')),
      skills: this.readFile(path.join(roleDir, 'SKILLS.md')),
    };
  }

  /** Read a file, returning empty string if it doesn't exist. */
  private readFile(filePath: string): string {
    try {
      return fs.readFileSync(filePath, 'utf-8').trim();
    } catch {
      return '';
    }
  }
}
