import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { injectConventions } from '../../src/engine/convention-injector.js';
import type { AgentTicketExecutorConfig } from '../../src/engine/agent-ticket-executor.js';

function makeBaseConfig(): Omit<AgentTicketExecutorConfig, 'conventions'> {
  return {
    defaultModel: { provider: 'test', model: 'test-model', fullId: 'test/test-model', resolvedFrom: 'system' },
    defaultThinkingLevel: 'medium',
    defaultToolPermissions: {},
    workingDirectory: '/tmp',
    maxIterations: 25,
    baseBranch: 'main',
  };
}

describe('injectConventions', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'convention-injector-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should populate conventions when CONVENTIONS.md exists', () => {
    const phalanxDir = path.join(tmpDir, '.phalanx');
    fs.mkdirSync(phalanxDir);
    fs.writeFileSync(path.join(phalanxDir, 'CONVENTIONS.md'), '## Naming\nUse kebab-case.');

    const result = injectConventions(makeBaseConfig(), tmpDir);
    expect(result.conventions).toContain('Use kebab-case.');
    expect(result.conventions).toContain('TEAM CONVENTIONS');
  });

  it('should include architecture and style when present', () => {
    const phalanxDir = path.join(tmpDir, '.phalanx');
    fs.mkdirSync(phalanxDir);
    fs.writeFileSync(path.join(phalanxDir, 'CONVENTIONS.md'), 'Naming rules');
    fs.writeFileSync(path.join(phalanxDir, 'ARCHITECTURE.md'), 'Layered architecture');
    fs.writeFileSync(path.join(phalanxDir, 'STYLE.md'), 'Semicolons required');

    const result = injectConventions(makeBaseConfig(), tmpDir);
    expect(result.conventions).toContain('Naming rules');
    expect(result.conventions).toContain('Layered architecture');
    expect(result.conventions).toContain('Semicolons required');
  });

  it('should leave conventions undefined when no convention files exist', () => {
    const result = injectConventions(makeBaseConfig(), tmpDir);
    expect(result.conventions).toBeUndefined();
  });

  it('should preserve all other config fields', () => {
    const base = makeBaseConfig();
    const result = injectConventions(base, tmpDir);
    expect(result.defaultModel).toBe(base.defaultModel);
    expect(result.maxIterations).toBe(base.maxIterations);
    expect(result.baseBranch).toBe(base.baseBranch);
  });
});
