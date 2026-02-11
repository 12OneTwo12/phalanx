/**
 * Convention loader — reads .phalanx/ files and formats them for agent prompt injection.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { LoadedConventions } from './types.js';

export class ConventionLoader {
  private readonly conventionPath: string;

  constructor(projectDir: string, conventionDir = '.phalanx') {
    this.conventionPath = path.join(projectDir, conventionDir);
  }

  /**
   * Load all convention files from disk.
   */
  load(): LoadedConventions {
    return {
      conventions: this.readFile('CONVENTIONS.md'),
      architecture: this.readFile('ARCHITECTURE.md'),
      style: this.readFile('STYLE.md'),
    };
  }

  /**
   * Format loaded conventions for injection into agent system prompts.
   */
  formatForPrompt(loaded?: LoadedConventions): string {
    const data = loaded ?? this.load();
    const sections: string[] = [];

    if (data.conventions) {
      sections.push('=== TEAM CONVENTIONS ===', data.conventions);
    }
    if (data.architecture) {
      sections.push('=== ARCHITECTURE ===', data.architecture);
    }
    if (data.style) {
      sections.push('=== CODE STYLE ===', data.style);
    }

    if (sections.length === 0) {
      return '';
    }

    return sections.join('\n\n');
  }

  /**
   * Check if conventions exist on disk.
   */
  exists(): boolean {
    return fs.existsSync(path.join(this.conventionPath, 'CONVENTIONS.md'));
  }

  private readFile(filename: string): string | null {
    const filePath = path.join(this.conventionPath, filename);
    if (!fs.existsSync(filePath)) return null;
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch {
      return null;
    }
  }
}
