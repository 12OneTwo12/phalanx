/**
 * SkillLoader — loads skills from SKILL.md files across multiple directories.
 *
 * Priority: workspace/skills > ~/.phalanx/skills > bundled skills
 * Skills with the same name from higher-priority sources override lower ones.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { Skill, SkillFrontmatter } from './types.js';

const SKILL_FILENAME = 'SKILL.md';

export interface SkillLoaderOptions {
  /** Project root directory */
  projectRoot?: string;
  /** Extra directories to scan for skills */
  extraDirs?: string[];
  /** Path to bundled skills (defaults to <packageRoot>/skills) */
  bundledDir?: string;
}

export class SkillLoader {
  private readonly projectRoot?: string;
  private readonly extraDirs: string[];
  private readonly bundledDir?: string;

  constructor(options: SkillLoaderOptions = {}) {
    this.projectRoot = options.projectRoot;
    this.extraDirs = options.extraDirs ?? [];
    this.bundledDir = options.bundledDir;
  }

  /**
   * Load all skills from all directories with priority resolution.
   * Higher-priority sources override lower ones by name.
   */
  loadAll(): Skill[] {
    const skillMap = new Map<string, Skill>();

    // Load in reverse priority order (lowest first, highest overwrites)
    const sources = this.getSourceDirs();
    for (const { dir, source } of sources) {
      const skills = this.loadFromDir(dir, source);
      for (const skill of skills) {
        skillMap.set(skill.name, skill);
      }
    }

    return Array.from(skillMap.values());
  }

  /**
   * Load skills from a single directory. Each subdirectory containing SKILL.md is a skill.
   */
  loadFromDir(dir: string, source: Skill['source']): Skill[] {
    if (!fs.existsSync(dir)) return [];

    const skills: Skill[] = [];
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
        // Skip malformed skills
      }
    }

    return skills;
  }

  /**
   * Parse a single SKILL.md file into a Skill object.
   */
  parseSkillFile(
    filePath: string,
    skillDir: string,
    source: Skill['source'],
  ): Skill | null {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { frontmatter, body } = this.parseFrontmatter(raw);

    const dirName = path.basename(skillDir);
    const name = frontmatter.name ?? dirName;
    const description = frontmatter.description ?? '';

    return {
      name,
      description,
      content: body.trim(),
      metadata: {
        bins: frontmatter.requires?.bins,
        config: frontmatter.requires?.config,
        roles: frontmatter.roles,
      },
      source,
      path: skillDir,
    };
  }

  /**
   * Parse YAML frontmatter from a markdown string.
   * Supports --- delimited frontmatter blocks.
   */
  parseFrontmatter(raw: string): { frontmatter: SkillFrontmatter; body: string } {
    const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
    if (!match) {
      return { frontmatter: {}, body: raw };
    }

    const yamlStr = match[1];
    const body = match[2];

    // Simple YAML parser for flat/nested structures we need
    const frontmatter: SkillFrontmatter = {};
    try {
      frontmatter.name = this.extractYamlString(yamlStr, 'name');
      frontmatter.description = this.extractYamlString(yamlStr, 'description');
      frontmatter.roles = this.extractYamlArray(yamlStr, 'roles');

      // Parse requires block
      const requiresMatch = yamlStr.match(/requires:\s*\n((?:\s+.*\n?)*)/);
      if (requiresMatch) {
        const reqBlock = requiresMatch[1];
        frontmatter.requires = {
          bins: this.extractYamlArray(reqBlock, 'bins'),
          config: this.extractYamlArray(reqBlock, 'config'),
        };
      }
    } catch {
      // Return what we could parse
    }

    return { frontmatter, body };
  }

  private extractYamlString(yaml: string, key: string): string | undefined {
    const match = yaml.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : undefined;
  }

  private extractYamlArray(yaml: string, key: string): string[] | undefined {
    const sectionMatch = yaml.match(new RegExp(`${key}:\\s*\\n((?:\\s+-\\s+.*\\n?)*)`, 'm'));
    if (!sectionMatch) {
      // Try inline array: key: [a, b, c]
      const inlineMatch = yaml.match(new RegExp(`${key}:\\s*\\[([^\\]]+)\\]`, 'm'));
      if (inlineMatch) {
        return inlineMatch[1].split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
      }
      return undefined;
    }

    const items: string[] = [];
    const lines = sectionMatch[1].split('\n');
    for (const line of lines) {
      const itemMatch = line.match(/^\s+-\s+(.+)/);
      if (itemMatch) items.push(itemMatch[1].trim().replace(/^["']|["']$/g, ''));
    }
    return items.length > 0 ? items : undefined;
  }

  private getSourceDirs(): Array<{ dir: string; source: Skill['source'] }> {
    const dirs: Array<{ dir: string; source: Skill['source'] }> = [];

    // Bundled (lowest priority)
    if (this.bundledDir) {
      dirs.push({ dir: this.bundledDir, source: 'bundled' });
    }

    // User home
    const userDir = path.join(os.homedir(), '.phalanx', 'skills');
    dirs.push({ dir: userDir, source: 'user' });

    // Extra dirs
    for (const extra of this.extraDirs) {
      dirs.push({ dir: extra, source: 'user' });
    }

    // Workspace (highest priority)
    if (this.projectRoot) {
      dirs.push({ dir: path.join(this.projectRoot, 'skills'), source: 'workspace' });
    }

    return dirs;
  }
}
