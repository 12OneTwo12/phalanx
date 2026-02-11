import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ConventionLoader } from '../../src/conventions/loader.js';

describe('ConventionLoader', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phalanx-load-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return null when no files exist', () => {
    const loader = new ConventionLoader(tmpDir);
    const loaded = loader.load();
    expect(loaded.conventions).toBeNull();
    expect(loaded.architecture).toBeNull();
    expect(loaded.style).toBeNull();
  });

  it('should load existing convention files', () => {
    const phalanxDir = path.join(tmpDir, '.phalanx');
    fs.mkdirSync(phalanxDir);
    fs.writeFileSync(path.join(phalanxDir, 'CONVENTIONS.md'), '# Rules');
    fs.writeFileSync(path.join(phalanxDir, 'ARCHITECTURE.md'), '# Arch');

    const loader = new ConventionLoader(tmpDir);
    const loaded = loader.load();
    expect(loaded.conventions).toBe('# Rules');
    expect(loaded.architecture).toBe('# Arch');
    expect(loaded.style).toBeNull();
  });

  it('should format for prompt injection', () => {
    const phalanxDir = path.join(tmpDir, '.phalanx');
    fs.mkdirSync(phalanxDir);
    fs.writeFileSync(path.join(phalanxDir, 'CONVENTIONS.md'), '# Rules');
    fs.writeFileSync(path.join(phalanxDir, 'STYLE.md'), '# Style');

    const loader = new ConventionLoader(tmpDir);
    const prompt = loader.formatForPrompt();
    expect(prompt).toContain('=== TEAM CONVENTIONS ===');
    expect(prompt).toContain('# Rules');
    expect(prompt).toContain('=== CODE STYLE ===');
    expect(prompt).toContain('# Style');
  });

  it('should return empty string when no conventions exist', () => {
    const loader = new ConventionLoader(tmpDir);
    expect(loader.formatForPrompt()).toBe('');
  });

  it('should check existence', () => {
    const loader = new ConventionLoader(tmpDir);
    expect(loader.exists()).toBe(false);

    const phalanxDir = path.join(tmpDir, '.phalanx');
    fs.mkdirSync(phalanxDir);
    fs.writeFileSync(path.join(phalanxDir, 'CONVENTIONS.md'), 'x');
    expect(loader.exists()).toBe(true);
  });
});
