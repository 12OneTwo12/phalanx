/**
 * Edge case tests for conventions modules.
 * Covers: malformed package.json, missing src dir, empty file validation, custom loader dir.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ConventionAnalyzer } from '../../src/conventions/analyzer.js';
import { ConventionLoader } from '../../src/conventions/loader.js';
import { ConventionValidator, KebabCaseFileRule, NoConsoleLogRule, createDefaultValidator } from '../../src/conventions/validator.js';

describe('Conventions Edge Cases', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phalanx-edge-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ---------------------------------------------------------------------------
  // Analyzer — malformed package.json
  // ---------------------------------------------------------------------------
  it('Analyzer: handles malformed package.json gracefully', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), 'NOT_JSON{{{');
    const analyzer = new ConventionAnalyzer();
    const patterns = await analyzer.detectPatterns(tmpDir);
    // Should not throw; falls back to defaults
    expect(patterns.language).toBe('JavaScript');
    expect(patterns.framework).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Analyzer — no src directory for naming detection
  // ---------------------------------------------------------------------------
  it('Analyzer: returns unknown naming when no src directory', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
    const analyzer = new ConventionAnalyzer();
    const patterns = await analyzer.detectPatterns(tmpDir);
    expect(patterns.namingConvention).toBe('unknown');
  });

  // ---------------------------------------------------------------------------
  // Analyzer — empty project directory
  // ---------------------------------------------------------------------------
  it('Analyzer: handles completely empty directory', async () => {
    const analyzer = new ConventionAnalyzer();
    const patterns = await analyzer.detectPatterns(tmpDir);
    expect(patterns.language).toBe('JavaScript');
    expect(patterns.packageManager).toBe('npm');
    expect(patterns.folderStructure).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // Loader — custom convention directory name
  // ---------------------------------------------------------------------------
  it('Loader: works with custom convention directory', () => {
    const customDir = path.join(tmpDir, '.custom');
    fs.mkdirSync(customDir);
    fs.writeFileSync(path.join(customDir, 'CONVENTIONS.md'), '# Custom');

    const loader = new ConventionLoader(tmpDir, '.custom');
    expect(loader.exists()).toBe(true);
    expect(loader.load().conventions).toBe('# Custom');
  });

  // ---------------------------------------------------------------------------
  // Validator — empty file list
  // ---------------------------------------------------------------------------
  it('Validator: passes with empty file list', () => {
    const validator = createDefaultValidator();
    const result = validator.validate([]);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // KebabCaseFileRule — dotfiles and index files
  // ---------------------------------------------------------------------------
  it('KebabCaseFileRule: allows dotfiles', () => {
    const rule = new KebabCaseFileRule();
    expect(rule.validate('.eslintrc.js', '')).toHaveLength(0);
  });

  it('KebabCaseFileRule: allows index files', () => {
    const rule = new KebabCaseFileRule();
    expect(rule.validate('index.ts', '')).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // NoConsoleLogRule — edge cases
  // ---------------------------------------------------------------------------
  it('NoConsoleLogRule: ignores __tests__ directory', () => {
    const rule = new NoConsoleLogRule();
    expect(rule.validate('__tests__/helper.ts', 'console.log("debug");')).toHaveLength(0);
  });

  it('NoConsoleLogRule: detects console.log in non-obvious position', () => {
    const rule = new NoConsoleLogRule();
    const violations = rule.validate('src/app.ts', 'if (true) console.log("x")');
    expect(violations).toHaveLength(1);
  });
});
