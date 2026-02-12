/**
 * Skill system types for Phalanx.
 *
 * Adapted from OpenClaw's skill architecture with role-based filtering
 * for multi-agent orchestration.
 */

// ---------------------------------------------------------------------------
// Skill Metadata (embedded in SKILL.md frontmatter as JSON)
// ---------------------------------------------------------------------------

export interface PhalanxSkillMetadata {
  /** Display emoji for UI */
  emoji?: string;
  /** Agent roles that can use this skill (empty = all roles) */
  roles?: string[];
  /** Requirements that must be met for the skill to load */
  requires?: {
    /** Required binaries on PATH */
    bins?: string[];
    /** Required environment variables */
    env?: string[];
  };
}

// ---------------------------------------------------------------------------
// Skill Entry (loaded from SKILL.md)
// ---------------------------------------------------------------------------

export interface SkillEntry {
  /** Unique skill name (from frontmatter or directory name) */
  name: string;
  /** Human-readable description */
  description: string;
  /** SKILL.md body content (instructions for the agent) */
  content: string;
  /** Absolute path to the SKILL.md file */
  filePath: string;
  /** Absolute path to the skill directory */
  baseDir: string;
  /** Parsed metadata from frontmatter */
  metadata?: PhalanxSkillMetadata;
  /** Where the skill was loaded from */
  source: 'workspace' | 'managed' | 'bundled';
}

// ---------------------------------------------------------------------------
// Skill Snapshot (for prompt injection)
// ---------------------------------------------------------------------------

export interface SkillSnapshot {
  /** Formatted prompt string ready for system prompt injection */
  prompt: string;
  /** Summary of included skills */
  skills: Array<{ name: string; description: string }>;
}

// ---------------------------------------------------------------------------
// Skill Config (from phalanx config file)
// ---------------------------------------------------------------------------

export interface SkillsConfig {
  load?: {
    /** Additional directories to scan for skills */
    extraDirs?: string[];
    /** Allowlist for bundled skills (if set, only these load) */
    bundledAllowlist?: string[];
  };
  entries?: Record<
    string,
    {
      /** Set to false to disable a skill */
      enabled?: boolean;
    }
  >;
}

// ---------------------------------------------------------------------------
// Parsed Frontmatter (intermediate)
// ---------------------------------------------------------------------------

export interface ParsedFrontmatter {
  name?: string;
  description?: string;
  metadata?: PhalanxSkillMetadata;
}
