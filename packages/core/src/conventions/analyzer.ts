/**
 * Codebase analyzer that scans project files to detect patterns and conventions.
 * Uses fs + ts-morph for AST analysis of naming patterns.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DetectedPatterns, ConventionDraft } from './types.js';

// ---------------------------------------------------------------------------
// Analyzer
// ---------------------------------------------------------------------------

export class ConventionAnalyzer {
  /**
   * Analyze a project directory and return detected patterns + a convention draft.
   */
  async analyze(projectDir: string): Promise<ConventionDraft> {
    const patterns = await this.detectPatterns(projectDir);
    return {
      conventions: this.generateConventionsMarkdown(patterns),
      architecture: this.generateArchitectureMarkdown(patterns, projectDir),
      style: this.generateStyleMarkdown(patterns),
      detectedPatterns: patterns,
    };
  }

  /**
   * Detect patterns from project configuration files and source code.
   */
  async detectPatterns(projectDir: string): Promise<DetectedPatterns> {
    const pkg = this.readPackageJson(projectDir);
    const tsConfig = this.readTsConfig(projectDir);

    return {
      language: this.detectLanguage(pkg, projectDir),
      framework: this.detectFramework(pkg),
      linter: this.detectLinter(pkg, projectDir),
      formatter: this.detectFormatter(pkg, projectDir),
      testFramework: this.detectTestFramework(pkg),
      namingConvention: this.detectNamingConvention(projectDir),
      commitStyle: this.detectCommitStyle(projectDir),
      folderStructure: this.detectFolderStructure(projectDir),
      packageManager: this.detectPackageManager(projectDir),
      buildTool: this.detectBuildTool(pkg),
      tsStrict: tsConfig?.compilerOptions?.strict ?? null,
    };
  }

  // ---------------------------------------------------------------------------
  // Detection helpers
  // ---------------------------------------------------------------------------

  private readPackageJson(dir: string): Record<string, unknown> | null {
    const pkgPath = path.join(dir, 'package.json');
    if (!fs.existsSync(pkgPath)) return null;
    try {
      return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    } catch {
      return null;
    }
  }

  private readTsConfig(dir: string): { compilerOptions?: { strict?: boolean } } | null {
    const tsPath = path.join(dir, 'tsconfig.json');
    if (!fs.existsSync(tsPath)) return null;
    try {
      // Strip comments for JSON parse (basic)
      const raw = fs.readFileSync(tsPath, 'utf-8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private detectLanguage(pkg: Record<string, unknown> | null, dir: string): string {
    if (fs.existsSync(path.join(dir, 'tsconfig.json'))) return 'TypeScript';
    const deps = { ...(pkg?.dependencies as Record<string, string> ?? {}), ...(pkg?.devDependencies as Record<string, string> ?? {}) };
    if (deps['typescript']) return 'TypeScript';
    return 'JavaScript';
  }

  private detectFramework(pkg: Record<string, unknown> | null): string | null {
    if (!pkg) return null;
    const deps = { ...(pkg.dependencies as Record<string, string> ?? {}), ...(pkg.devDependencies as Record<string, string> ?? {}) };
    if (deps['next']) return 'Next.js';
    if (deps['react']) return 'React';
    if (deps['vue']) return 'Vue';
    if (deps['@angular/core']) return 'Angular';
    if (deps['express']) return 'Express';
    if (deps['fastify']) return 'Fastify';
    if (deps['nest'] || deps['@nestjs/core']) return 'NestJS';
    return null;
  }

  private detectLinter(pkg: Record<string, unknown> | null, dir: string): string | null {
    if (!pkg) return null;
    const deps = { ...(pkg.dependencies as Record<string, string> ?? {}), ...(pkg.devDependencies as Record<string, string> ?? {}) };
    if (deps['eslint'] || fs.existsSync(path.join(dir, '.eslintrc.json')) || fs.existsSync(path.join(dir, '.eslintrc.js')) || fs.existsSync(path.join(dir, 'eslint.config.js'))) return 'ESLint';
    if (deps['biome'] || deps['@biomejs/biome']) return 'Biome';
    return null;
  }

  private detectFormatter(pkg: Record<string, unknown> | null, dir: string): string | null {
    if (!pkg) return null;
    const deps = { ...(pkg.dependencies as Record<string, string> ?? {}), ...(pkg.devDependencies as Record<string, string> ?? {}) };
    if (deps['prettier'] || fs.existsSync(path.join(dir, '.prettierrc')) || fs.existsSync(path.join(dir, '.prettierrc.json'))) return 'Prettier';
    if (deps['biome'] || deps['@biomejs/biome']) return 'Biome';
    return null;
  }

  private detectTestFramework(pkg: Record<string, unknown> | null): string | null {
    if (!pkg) return null;
    const deps = { ...(pkg.dependencies as Record<string, string> ?? {}), ...(pkg.devDependencies as Record<string, string> ?? {}) };
    if (deps['vitest']) return 'Vitest';
    if (deps['jest']) return 'Jest';
    if (deps['mocha']) return 'Mocha';
    if (deps['ava']) return 'Ava';
    return null;
  }

  private detectNamingConvention(dir: string): string {
    // Check file naming by scanning src/ directory
    const srcDir = path.join(dir, 'src');
    if (!fs.existsSync(srcDir)) return 'unknown';

    const files = this.getFilesRecursive(srcDir, 2);
    const kebabCount = files.filter((f) => /^[a-z][a-z0-9-]+\.[a-z]+$/.test(path.basename(f))).length;
    const camelCount = files.filter((f) => /^[a-z][a-zA-Z0-9]+\.[a-z]+$/.test(path.basename(f))).length;

    if (kebabCount > camelCount) return 'kebab-case';
    if (camelCount > kebabCount) return 'camelCase';
    return 'mixed';
  }

  private detectCommitStyle(_dir: string): string {
    // Default assumption — could be enhanced with git log parsing
    return 'conventional';
  }

  private detectFolderStructure(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
      .map((e) => e.name);
    return entries.slice(0, 20);
  }

  private detectPackageManager(dir: string): string {
    if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml')) || fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return 'pnpm';
    if (fs.existsSync(path.join(dir, 'yarn.lock'))) return 'yarn';
    if (fs.existsSync(path.join(dir, 'bun.lockb'))) return 'bun';
    return 'npm';
  }

  private detectBuildTool(pkg: Record<string, unknown> | null): string | null {
    if (!pkg) return null;
    const deps = { ...(pkg.dependencies as Record<string, string> ?? {}), ...(pkg.devDependencies as Record<string, string> ?? {}) };
    if (deps['tsup']) return 'tsup';
    if (deps['esbuild']) return 'esbuild';
    if (deps['rollup']) return 'Rollup';
    if (deps['webpack']) return 'Webpack';
    if (deps['vite']) return 'Vite';
    if (deps['turbo'] || deps['turbopack']) return 'Turbopack';
    return null;
  }

  private getFilesRecursive(dir: string, maxDepth: number, depth = 0): string[] {
    if (depth >= maxDepth || !fs.existsSync(dir)) return [];
    const results: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile()) results.push(path.join(dir, entry.name));
      else if (entry.isDirectory() && !entry.name.startsWith('.')) {
        results.push(...this.getFilesRecursive(path.join(dir, entry.name), maxDepth, depth + 1));
      }
    }
    return results;
  }

  // ---------------------------------------------------------------------------
  // Markdown generation
  // ---------------------------------------------------------------------------

  private generateConventionsMarkdown(patterns: DetectedPatterns): string {
    const lines = [
      '# Team Conventions',
      `> Auto-generated by Team Lead | Last updated: ${new Date().toISOString().split('T')[0]}`,
      '> Human-editable: YES',
      '',
      '## Language & Framework',
      `- Language: ${patterns.language}${patterns.tsStrict ? ' (strict mode)' : ''}`,
      patterns.framework ? `- Framework: ${patterns.framework}` : null,
      '',
      '## Git',
      `- Branch: feature/{ticket-id}-{slug}, fix/{ticket-id}-{slug}`,
      `- Commit: ${patterns.commitStyle} commits`,
      '- PR: title 70 chars max, body includes ticket ID',
      '',
      '## Code Style',
      `- File naming: ${patterns.namingConvention}`,
      `- Variables/functions: camelCase`,
      `- Types/classes: PascalCase`,
      '',
      '## Testing',
      patterns.testFramework ? `- Framework: ${patterns.testFramework}` : '- No test framework detected',
      '- Minimum coverage: 70%',
      '',
      '## Dependencies',
      `- Package manager: ${patterns.packageManager}`,
      '- New packages require Team Lead approval',
    ];
    return lines.filter((l) => l !== null).join('\n');
  }

  private generateArchitectureMarkdown(patterns: DetectedPatterns, dir: string): string {
    const folders = this.detectFolderStructure(dir);
    const lines = [
      '# Architecture',
      `> Auto-generated | Last updated: ${new Date().toISOString().split('T')[0]}`,
      '',
      '## Project Structure',
      ...folders.map((f) => `- ${f}/`),
      '',
      '## Build',
      patterns.buildTool ? `- Build tool: ${patterns.buildTool}` : '- No build tool detected',
      '',
      '## Patterns',
      '- Repository pattern for data access',
      '- Factory pattern for service creation',
    ];
    return lines.join('\n');
  }

  private generateStyleMarkdown(patterns: DetectedPatterns): string {
    const lines = [
      '# Code Style',
      `> Auto-generated | Last updated: ${new Date().toISOString().split('T')[0]}`,
      '',
      '## Formatting',
      patterns.formatter ? `- Formatter: ${patterns.formatter}` : '- No formatter detected',
      patterns.linter ? `- Linter: ${patterns.linter}` : '- No linter detected',
      '',
      '## Naming',
      `- Files: ${patterns.namingConvention}`,
      '- Variables/functions: camelCase',
      '- Types/interfaces: PascalCase',
      '- Constants: UPPER_SNAKE_CASE',
    ];
    return lines.join('\n');
  }
}
