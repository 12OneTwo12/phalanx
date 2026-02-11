import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ConventionAnalyzer } from '../../src/conventions/analyzer.js';

describe('ConventionAnalyzer', () => {
  let tmpDir: string;
  let analyzer: ConventionAnalyzer;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phalanx-test-'));
    analyzer = new ConventionAnalyzer();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should detect TypeScript from tsconfig.json', async () => {
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), '{"compilerOptions":{"strict":true}}');
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
    const patterns = await analyzer.detectPatterns(tmpDir);
    expect(patterns.language).toBe('TypeScript');
    expect(patterns.tsStrict).toBe(true);
  });

  it('should detect JavaScript when no TS config', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
    const patterns = await analyzer.detectPatterns(tmpDir);
    expect(patterns.language).toBe('JavaScript');
  });

  it('should detect framework from package.json', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      dependencies: { next: '^15.0.0', react: '^19.0.0' },
    }));
    const patterns = await analyzer.detectPatterns(tmpDir);
    expect(patterns.framework).toBe('Next.js');
  });

  it('should detect pnpm package manager', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
    fs.writeFileSync(path.join(tmpDir, 'pnpm-lock.yaml'), '');
    const patterns = await analyzer.detectPatterns(tmpDir);
    expect(patterns.packageManager).toBe('pnpm');
  });

  it('should detect vitest test framework', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      devDependencies: { vitest: '^3.0.0' },
    }));
    const patterns = await analyzer.detectPatterns(tmpDir);
    expect(patterns.testFramework).toBe('Vitest');
  });

  it('should detect ESLint linter', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      devDependencies: { eslint: '^9.0.0' },
    }));
    const patterns = await analyzer.detectPatterns(tmpDir);
    expect(patterns.linter).toBe('ESLint');
  });

  it('should detect kebab-case file naming', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir);
    fs.writeFileSync(path.join(srcDir, 'my-component.ts'), '');
    fs.writeFileSync(path.join(srcDir, 'another-file.ts'), '');
    fs.writeFileSync(path.join(srcDir, 'third-one.ts'), '');
    const patterns = await analyzer.detectPatterns(tmpDir);
    expect(patterns.namingConvention).toBe('kebab-case');
  });

  it('should detect build tool', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      devDependencies: { tsup: '^8.0.0' },
    }));
    const patterns = await analyzer.detectPatterns(tmpDir);
    expect(patterns.buildTool).toBe('tsup');
  });

  it('should generate a full convention draft', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      dependencies: { express: '^4.0.0' },
      devDependencies: { typescript: '^5.0.0', vitest: '^3.0.0', eslint: '^9.0.0', tsup: '^8.0.0' },
    }));
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), '{"compilerOptions":{"strict":true}}');
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir);
    fs.writeFileSync(path.join(srcDir, 'app.ts'), '');

    const draft = await analyzer.analyze(tmpDir);
    expect(draft.conventions).toContain('Team Conventions');
    expect(draft.architecture).toContain('Architecture');
    expect(draft.style).toContain('Code Style');
    expect(draft.detectedPatterns.framework).toBe('Express');
  });

  it('should handle missing package.json gracefully', async () => {
    const patterns = await analyzer.detectPatterns(tmpDir);
    expect(patterns.language).toBe('JavaScript');
    expect(patterns.framework).toBeNull();
  });

  it('should detect folder structure', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
    fs.mkdirSync(path.join(tmpDir, 'src'));
    fs.mkdirSync(path.join(tmpDir, 'tests'));
    fs.mkdirSync(path.join(tmpDir, 'docs'));
    const patterns = await analyzer.detectPatterns(tmpDir);
    expect(patterns.folderStructure).toContain('src');
    expect(patterns.folderStructure).toContain('tests');
  });
});
