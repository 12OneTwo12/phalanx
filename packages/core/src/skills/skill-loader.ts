/**
 * SkillLoader — loads skills from SKILL.md files across multiple directories.
 *
 * Loading priority (highest wins):
 *   1. workspace/skills/    (project-local)
 *   2. ~/.phalanx/skills/   (managed/global)
 *   3. bundled skills       (package-bundled)
 *   4. extraDirs            (from config skills.load.extraDirs)
 *   5. plugin skills        (future)
 *
 * Same-name skills from higher-priority sources override lower ones (Map.set).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import type { SkillEntry, SkillsConfig } from './types.js';
import { parseFrontmatter } from './frontmatter.js';

const SKILL_FILENAME = 'SKILL.md';

export interface SkillLoaderOptions {
  /** Project root directory */
  projectRoot?: string;
  /** Skill configuration from phalanx config */
  config?: SkillsConfig;
  /** Path to bundled skills directory */
  bundledDir?: string;
}

export class SkillLoader {
  private readonly projectRoot?: string;
  private readonly config: SkillsConfig;
  private readonly bundledDir?: string;

  constructor(options: SkillLoaderOptions = {}) {
    this.projectRoot = options.projectRoot;
    this.config = options.config ?? {};
    this.bundledDir = options.bundledDir;
  }

  /**
   * Load all skills from all directories with priority resolution.
   * Higher-priority sources override lower ones by name.
   */
  loadAll(): SkillEntry[] {
    const skillMap = new Map<string, SkillEntry>();

    // Load in priority order: lowest first, highest overwrites
    const sources = this.getSourceDirs();
    for (const { dir, source } of sources) {
      const skills = this.loadFromDir(dir, source);
      for (const skill of skills) {
        if (!this.shouldIncludeSkill(skill)) continue;
        skillMap.set(skill.name, skill);
      }
    }

    return Array.from(skillMap.values());
  }

  /**
   * Load skills from a single directory.
   * Each subdirectory containing SKILL.md is treated as a skill.
   */
  loadFromDir(dir: string, source: SkillEntry['source']): SkillEntry[] {
    if (!fs.existsSync(dir)) return [];

    const skills: SkillEntry[] = [];
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return [];
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillDir = path.join(dir, entry.name);
      const skillFile = path.join(skillDir, SKILL_FILENAME);

      if (!fs.existsSync(skillFile)) continue;

      try {
        const skill = this.parseSkillFile(skillFile, skillDir, source);
        if (skill) skills.push(skill);
      } catch {
        // Skip malformed skills silently
      }
    }

    return skills;
  }

  /**
   * Parse a single SKILL.md file into a SkillEntry.
   */
  parseSkillFile(
    filePath: string,
    skillDir: string,
    source: SkillEntry['source'],
  ): SkillEntry | null {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(raw);

    const dirName = path.basename(skillDir);
    const name = frontmatter.name ?? dirName;
    const description = frontmatter.description ?? '';

    return {
      name,
      description,
      content: body,
      filePath,
      baseDir: skillDir,
      metadata: frontmatter.metadata,
      source,
    };
  }

  /**
   * Check whether a skill should be included based on config and requirements.
   *
   * Checks:
   * - `skills.entries.<name>.enabled: false` → skip
   * - `skills.load.bundledAllowlist` → only allow listed bundled skills
   * - `metadata.requires.bins` → check binaries on PATH
   * - `metadata.requires.env` → check environment variables
   */
  shouldIncludeSkill(skill: SkillEntry): boolean {
    // Check per-skill enabled flag
    const entryConfig = this.config.entries?.[skill.name];
    if (entryConfig?.enabled === false) return false;

    // Check bundled allowlist
    if (skill.source === 'bundled' && this.config.load?.bundledAllowlist) {
      if (!this.config.load.bundledAllowlist.includes(skill.name)) return false;
    }

    // Check required binaries
    if (skill.metadata?.requires?.bins) {
      for (const bin of skill.metadata.requires.bins) {
        if (!this.isBinaryAvailable(bin)) return false;
      }
    }

    // Check required environment variables
    if (skill.metadata?.requires?.env) {
      for (const envVar of skill.metadata.requires.env) {
        if (!process.env[envVar]) return false;
      }
    }

    return true;
  }

  /**
   * Check if a binary is available on PATH.
   */
  private isBinaryAvailable(bin: string): boolean {
    try {
      const cmd = process.platform === 'win32' ? `where ${bin}` : `which ${bin}`;
      execSync(cmd, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Build the ordered list of source directories (lowest priority first).
   */
  private getSourceDirs(): Array<{ dir: string; source: SkillEntry['source'] }> {
    const dirs: Array<{ dir: string; source: SkillEntry['source'] }> = [];

    // 5. Plugin skills — future, skip

    // 4. Extra dirs (lowest active priority)
    if (this.config.load?.extraDirs) {
      for (const extra of this.config.load.extraDirs) {
        dirs.push({ dir: extra, source: 'managed' });
      }
    }

    // 3. Bundled skills
    if (this.bundledDir) {
      dirs.push({ dir: this.bundledDir, source: 'bundled' });
    }

    // 2. Managed / global (~/.phalanx/skills)
    const managedDir = path.join(os.homedir(), '.phalanx', 'skills');
    dirs.push({ dir: managedDir, source: 'managed' });

    // 1. Workspace (highest priority)
    if (this.projectRoot) {
      dirs.push({ dir: path.join(this.projectRoot, 'skills'), source: 'workspace' });
    }

    return dirs;
  }
}
