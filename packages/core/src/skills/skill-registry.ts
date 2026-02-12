/**
 * SkillRegistry — manages loaded skills with filtering capabilities.
 */
import type { Skill } from './types.js';
import type { AgentRole } from '../agents/types.js';

export class SkillRegistry {
  private skills = new Map<string, Skill>();

  constructor(initialSkills?: Skill[]) {
    if (initialSkills) {
      for (const skill of initialSkills) {
        this.skills.set(skill.name, skill);
      }
    }
  }

  /** Get all loaded skills. */
  list(): Skill[] {
    return Array.from(this.skills.values());
  }

  /** Get a skill by name. */
  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  /** Add or replace a skill. */
  add(skill: Skill): void {
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
  getForRole(role: AgentRole): Skill[] {
    return this.list().filter((skill) => {
      if (!skill.metadata?.roles || skill.metadata.roles.length === 0) {
        return true;
      }
      return skill.metadata.roles.includes(role);
    });
  }

  /**
   * Format skills for injection into agent system prompt.
   * Returns a formatted string with all matching skills' content.
   */
  formatForPrompt(role?: AgentRole): string {
    const skills = role ? this.getForRole(role) : this.list();
    if (skills.length === 0) return '';

    const sections = skills.map(
      (skill) =>
        `## Skill: ${skill.name}\n${skill.description ? `> ${skill.description}\n` : ''}\n${skill.content}`,
    );

    return `# Available Skills\n\n${sections.join('\n\n---\n\n')}`;
  }
}
