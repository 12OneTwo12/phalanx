/**
 * Convention generator — writes detected conventions to .phalanx/ directory.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ConventionDraft } from './types.js';

export interface GeneratorOptions {
  /** Root directory of the target project */
  projectDir: string;
  /** Subdirectory for convention files. Default: '.phalanx' */
  conventionDir?: string;
}

/**
 * Writes convention draft files to the project's .phalanx/ directory.
 */
export class ConventionGenerator {
  private readonly conventionPath: string;

  constructor(private readonly options: GeneratorOptions) {
    this.conventionPath = path.join(options.projectDir, options.conventionDir ?? '.phalanx');
  }

  /**
   * Write all convention files from a draft.
   * Creates the directory if it doesn't exist.
   */
  write(draft: ConventionDraft): void {
    fs.mkdirSync(this.conventionPath, { recursive: true });
    fs.mkdirSync(path.join(this.conventionPath, 'history'), { recursive: true });

    fs.writeFileSync(path.join(this.conventionPath, 'CONVENTIONS.md'), draft.conventions, 'utf-8');
    fs.writeFileSync(path.join(this.conventionPath, 'ARCHITECTURE.md'), draft.architecture, 'utf-8');
    fs.writeFileSync(path.join(this.conventionPath, 'STYLE.md'), draft.style, 'utf-8');

    this.appendChangelog('Initial conventions generated', 'team-lead', 'Project initialization');
  }

  /**
   * Update a specific convention file.
   */
  updateFile(type: 'conventions' | 'architecture' | 'style', content: string, updatedBy: string, reason: string): void {
    const fileMap: Record<string, string> = {
      conventions: 'CONVENTIONS.md',
      architecture: 'ARCHITECTURE.md',
      style: 'STYLE.md',
    };
    const filePath = path.join(this.conventionPath, fileMap[type]);
    fs.writeFileSync(filePath, content, 'utf-8');
    this.appendChangelog(`Updated ${fileMap[type]}`, updatedBy, reason);
  }

  /**
   * Append an entry to the conventions changelog.
   */
  private appendChangelog(change: string, author: string, reason: string): void {
    const changelogPath = path.join(this.conventionPath, 'history', 'conventions-changelog.md');
    const date = new Date().toISOString().split('T')[0];
    const entry = `\n## ${date}: ${change}\n- **Author:** ${author}\n- **Reason:** ${reason}\n`;

    let existing = '';
    if (fs.existsSync(changelogPath)) {
      existing = fs.readFileSync(changelogPath, 'utf-8');
    } else {
      existing = '# Conventions Changelog\n';
    }
    fs.writeFileSync(changelogPath, existing + entry, 'utf-8');
  }

  /** Get the convention directory path */
  get conventionDirPath(): string {
    return this.conventionPath;
  }
}
