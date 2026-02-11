/**
 * Codebase analyzer that scans project files to detect patterns and conventions.
 * Uses fs + ts-morph for AST analysis of naming patterns.
 */
import * as fs from 'node:fs/promises';
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
    const folderStructure = await this.detectFolderStructure(projectDir);
    return {
      conventions: this.generateConventionsMarkdown(patterns),
      architecture: this.generateArchitectureMarkdown(patterns, folderStructure),
      style: this.generateStyleMarkdown(patterns),
      detectedPatterns: patterns,
    };
  }

  /**
   * Detect patterns from project configuration files and source code.
   */
  async detectPatterns(projectDir: string): Promise<DetectedPatterns> {
    const pkg = await this.readPackageJson(projectDir);
    const tsConfig = await this.readTsConfig(projectDir);

    return {
      language: await this.detectLanguage(pkg, projectDir),
      framework: this.detectFramework(pkg),
      linter: await this.detectLinter(pkg, projectDir),
      formatter: await this.detectFormatter(pkg, projectDir),
      testFramework: this.detectTestFramework(pkg),
      namingConvention: await this.detectNamingConvention(projectDir),
      commitStyle: this.detectCommitStyle(projectDir),
      folderStructure: await this.detectFolderStructure(projectDir),
      packageManager: await this.detectPackageManager(projectDir),
      buildTool: this.detectBuildTool(pkg),
      tsStrict: tsConfig?.compilerOptions?.strict ?? null,
    };
  }

  // ---------------------------------------------------------------------------
  // Detection helpers
  // ---------------------------------------------------------------------------

  private async readPackageJson(dir: string): Promise<Record<string, unknown> | null> {
    const pkgPath = path.join(dir, 'package.json');
    try {
      await fs.access(pkgPath);
      const content = await fs.readFile(pkgPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private async readTsConfig(dir: string): Promise<{ compilerOptions?: { strict?: boolean } } | null> {
    const tsPath = path.join(dir, 'tsconfig.json');
    try {
      await fs.access(tsPath);
      const raw = await fs.readFile(tsPath, 'utf-8');
      // Strip single-line and multi-line comments safely.
      // Uses a state machine approach to avoid stripping inside string literals.
      const stripped = this.stripJsonComments(raw);
      return JSON.parse(stripped);
    } catch {
      return null;
    }
  }

  /**
   * Strip JSON comments (single-line // and multi-line /* ... *​/) while
   * preserving strings that may contain comment-like sequences.
   */
  private stripJsonComments(text: string): string {
    let result = '';
    let i = 0;
    while (i < text.length) {
      // String literal — copy verbatim
      if (text[i] === '"') {
        let j = i + 1;
        while (j < text.length && text[j] !== '"') {
          if (text[j] === '\\') j++; // skip escaped char
          j++;
        }
        result += text.slice(i, j + 1);
        i = j + 1;
      // Single-line comment
      } else if (text[i] === '/' && text[i + 1] === '/') {
        while (i < text.length && text[i] !== '\n') i++;
      // Multi-line comment
      } else if (text[i] === '/' && text[i + 1] === '*') {
        i += 2;
        while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
        i += 2;
      } else {
        result += text[i];
        i++;
      }
    }
    return result;
  }

  private async detectLanguage(pkg: Record<string, unknown> | null, dir: string): Promise<string> {
    try {
      await fs.access(path.join(dir, 'tsconfig.json'));
      return 'TypeScript';
    } catch { /* not found */ }
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

  private async detectLinter(pkg: Record<string, unknown> | null, dir: string): Promise<string | null> {
    if (!pkg) return null;
    const deps = { ...(pkg.dependencies as Record<string, string> ?? {}), ...(pkg.devDependencies as Record<string, string> ?? {}) };
    if (deps['eslint']) return 'ESLint';
    for (const f of ['.eslintrc.json', '.eslintrc.js', 'eslint.config.js']) {
      try { await fs.access(path.join(dir, f)); return 'ESLint'; } catch { /* not found */ }
    }
    if (deps['biome'] || deps['@biomejs/biome']) return 'Biome';
    return null;
  }

  private async detectFormatter(pkg: Record<string, unknown> | null, dir: string): Promise<string | null> {
    if (!pkg) return null;
    const deps = { ...(pkg.dependencies as Record<string, string> ?? {}), ...(pkg.devDependencies as Record<string, string> ?? {}) };
    if (deps['prettier']) return 'Prettier';
    for (const f of ['.prettierrc', '.prettierrc.json']) {
      try { await fs.access(path.join(dir, f)); return 'Prettier'; } catch { /* not found */ }
    }
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

  private async detectNamingConvention(dir: string): Promise<string> {
    // Check file naming by scanning src/ directory
    const srcDir = path.join(dir, 'src');
    try { await fs.access(srcDir); } catch { return 'unknown'; }

    const files = await this.getFilesRecursive(srcDir, 2);
    const kebabCount = files.filter((f) => /^[a-z][a-z0-9-]+\.[a-z]+$/.test(path.basename(f))).length;
    const camelCount = files.filter((f) => /^[a-z][a-zA-Z0-9]+\.[a-z]+$/.test(path.basename(f))).length;

    if (kebabCount > camelCount) return 'kebab-case';
    if (camelCount > kebabCount) return 'camelCase';
    return 'mixed';
  }

  private detectCommitStyle(_dir: string): string {
    // TODO: Implement actual git log parsing to detect commit style.
    // Should run `git log --oneline -n 50` and analyze patterns:
    //   - conventional: "type(scope): message"
    //   - angular: "type(scope): message" (similar but different types)
    //   - freeform: no pattern detected
    // Currently hardcoded — always returns 'conventional'.
    return 'conventional';
  }

  private async detectFolderStructure(dir: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
        .map((e) => e.name)
        .slice(0, 20);
    } catch {
      return [];
    }
  }

  private async detectPackageManager(dir: string): Promise<string> {
    for (const [file, manager] of [
      ['pnpm-lock.yaml', 'pnpm'], ['pnpm-workspace.yaml', 'pnpm'],
      ['yarn.lock', 'yarn'], ['bun.lockb', 'bun'],
    ] as const) {
      try { await fs.access(path.join(dir, file)); return manager; } catch { /* not found */ }
    }
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

  private async getFilesRecursive(dir: string, maxDepth: number, depth = 0): Promise<string[]> {
    if (depth >= maxDepth) return [];
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const results: string[] = [];
      for (const entry of entries) {
        if (entry.isFile()) results.push(path.join(dir, entry.name));
        else if (entry.isDirectory() && !entry.name.startsWith('.')) {
          results.push(...await this.getFilesRecursive(path.join(dir, entry.name), maxDepth, depth + 1));
        }
      }
      return results;
    } catch {
      return [];
    }
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

  private generateArchitectureMarkdown(patterns: DetectedPatterns, folders: string[]): string {
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
