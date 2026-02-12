/**
 * Skill system types for Phalanx.
 * Skills are loaded from SKILL.md files and injected into agent system prompts.
 */

export interface SkillMetadata {
  /** Required binaries to be available on PATH */
  bins?: string[];
  /** Required configuration keys */
  config?: string[];
  /** Agent roles that can use this skill (empty = all roles) */
  roles?: string[];
}

export interface Skill {
  /** Unique skill name (from frontmatter or directory name) */
  name: string;
  /** Human-readable description */
  description: string;
  /** SKILL.md body content (instructions for the agent) */
  content: string;
  /** Optional metadata */
  metadata?: SkillMetadata;
  /** Where the skill was loaded from */
  source: 'workspace' | 'user' | 'bundled';
  /** Absolute path to the skill directory */
  path: string;
}

export interface SkillFrontmatter {
  name?: string;
  description?: string;
  requires?: {
    bins?: string[];
    config?: string[];
  };
  roles?: string[];
}
