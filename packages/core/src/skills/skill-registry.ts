/**
 * SkillRegistry — runtime management of loaded skills.
 *
 * Provides role-based filtering and prompt formatting,
 * following OpenClaw's SkillSnapshot pattern.
 */
import type { SkillEntry, SkillSnapshot } from './types.js';
import type { AgentRole } from '../agents/types.js';

export class SkillRegistry {
  private skills = new Map<string, SkillEntry>();

  constructor(initialSkills?: SkillEntry[]) {
    if (initialSkills) {
      for (const skill of initialSkills) {
        this.skills.set(skill.name, skill);
      }
    }
  }

  /** Get all loaded skills. */
  list(): SkillEntry[] {
    return Array.from(this.skills.values());
  }

  /** Get a skill by name. */
  get(name: string): SkillEntry | undefined {
    return this.skills.get(name);
  }

  /** Add or replace a skill. */
  add(skill: SkillEntry): void {
    this.skills.set(skill.name, skill);
  }

  /** Remove a skill by name. Returns true if it existed. */
  remove(name: string): boolean {
    return this.skills.delete(name);
  }

  /** Check if a skill exists. */
  has(name: string): boolean {
    return this.skills.has(name);
  }

  /** Get the number of loaded skills. */
  get size(): number {
    return this.skills.size;
  }

  /**
   * Get skills filtered by agent role.
   * A skill matches if:
   * - It has no roles defined (available to all), or
   * - Its roles array includes the given role.
   */
  getForRole(role: AgentRole): SkillEntry[] {
    return this.list().filter((skill) => {
      if (!skill.metadata?.roles || skill.metadata.roles.length === 0) {
        return true;
      }
      return skill.metadata.roles.includes(role);
    });
  }

  /**
   * Create a SkillSnapshot for prompt injection.
   * Follows OpenClaw's lazy-loading pattern: only name/description/location
   * are included in the prompt. Agents use file_read to load full content.
   */
  snapshot(role?: AgentRole): SkillSnapshot {
    const skills = role ? this.getForRole(role) : this.list();
    if (skills.length === 0) {
      return { prompt: '', skills: [] };
    }

    return {
      prompt: this.formatForPrompt(skills),
      skills: skills.map((s) => ({ name: s.name, description: s.description })),
    };
  }

  /**
   * Format skills as a lazy-loading prompt for agent system prompt.
   *
   * Only includes name, description, and file location — NOT the full content.
   * Agents should use file_read to load a skill's SKILL.md when needed.
   *
   * This follows the OpenClaw pattern: conserve context window by only
   * exposing skill metadata; the agent reads the full content on demand.
   */
  formatForPrompt(skills?: SkillEntry[]): string {
    const entries = skills ?? this.list();
    if (entries.length === 0) return '';

    const skillXml = entries.map(
      (s) =>
        `  <skill>\n    <name>${s.name}</name>\n    <description>${s.description}</description>\n    <location>${s.filePath}</location>\n  </skill>`,
    );

    return [
      'The following skills provide specialized instructions for specific tasks.',
      'Use the file_read tool to load a skill\'s file when the task matches its description.',
      '',
      '<available_skills>',
      ...skillXml,
      '</available_skills>',
    ].join('\n');
  }
}
