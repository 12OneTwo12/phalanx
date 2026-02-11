import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ConventionGenerator } from '../../src/conventions/generator.js';
import type { ConventionDraft, DetectedPatterns } from '../../src/conventions/types.js';

function makeDraft(): ConventionDraft {
  const patterns: DetectedPatterns = {
    language: 'TypeScript',
    framework: 'Express',
    linter: 'ESLint',
    formatter: 'Prettier',
    testFramework: 'Vitest',
    namingConvention: 'kebab-case',
    commitStyle: 'conventional',
    folderStructure: ['src', 'tests'],
    packageManager: 'pnpm',
    buildTool: 'tsup',
    tsStrict: true,
  };
  return {
    conventions: '# Team Conventions\nTest content',
    architecture: '# Architecture\nTest content',
    style: '# Code Style\nTest content',
    detectedPatterns: patterns,
  };
}

describe('ConventionGenerator', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phalanx-gen-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should write all convention files', () => {
    const gen = new ConventionGenerator({ projectDir: tmpDir });
    gen.write(makeDraft());

    expect(fs.existsSync(path.join(tmpDir, '.phalanx', 'CONVENTIONS.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.phalanx', 'ARCHITECTURE.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.phalanx', 'STYLE.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.phalanx', 'history', 'conventions-changelog.md'))).toBe(true);
  });

  it('should write correct content', () => {
    const gen = new ConventionGenerator({ projectDir: tmpDir });
    gen.write(makeDraft());

    const content = fs.readFileSync(path.join(tmpDir, '.phalanx', 'CONVENTIONS.md'), 'utf-8');
    expect(content).toBe('# Team Conventions\nTest content');
  });

  it('should update a specific file', () => {
    const gen = new ConventionGenerator({ projectDir: tmpDir });
    gen.write(makeDraft());
    gen.updateFile('conventions', '# Updated', 'user', 'Manual edit');

    const content = fs.readFileSync(path.join(tmpDir, '.phalanx', 'CONVENTIONS.md'), 'utf-8');
    expect(content).toBe('# Updated');

    const changelog = fs.readFileSync(path.join(tmpDir, '.phalanx', 'history', 'conventions-changelog.md'), 'utf-8');
    expect(changelog).toContain('Updated CONVENTIONS.md');
    expect(changelog).toContain('Manual edit');
  });

  it('should use custom convention directory', () => {
    const gen = new ConventionGenerator({ projectDir: tmpDir, conventionDir: '.custom' });
    gen.write(makeDraft());
    expect(fs.existsSync(path.join(tmpDir, '.custom', 'CONVENTIONS.md'))).toBe(true);
  });
});
