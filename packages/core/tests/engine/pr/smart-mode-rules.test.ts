import { describe, it, expect } from 'vitest';
import {
  MaxFilesChangedRule,
  ForbiddenPathsRule,
  RequireTestsPassRule,
  ForbiddenKeywordsRule,
  NoNewDependenciesRule,
  SmartModeEngine,
  createDefaultSmartModeEngine,
} from '../../../src/engine/pr/smart-mode-rules.js';
import type { PRContext } from '../../../src/engine/pr/types.js';

function makeContext(overrides: Partial<PRContext> = {}): PRContext {
  return {
    ticketId: 't1',
    branch: 'ticket/t1-x',
    baseBranch: 'dev',
    changedFiles: ['src/a.ts'],
    diff: '+const x = 1;',
    verificationResult: {
      ticketId: 't1',
      status: 'passed',
      checks: [{ name: 'test-runner', passed: true }],
    },
    ...overrides,
  };
}

describe('MaxFilesChangedRule', () => {
  it('should allow when under limit', () => {
    expect(new MaxFilesChangedRule(5).evaluate(makeContext()).allowed).toBe(true);
  });

  it('should deny when over limit', () => {
    const ctx = makeContext({ changedFiles: Array(6).fill('f.ts') });
    expect(new MaxFilesChangedRule(5).evaluate(ctx).allowed).toBe(false);
  });
});

describe('ForbiddenPathsRule', () => {
  it('should allow when no forbidden files changed', () => {
    expect(new ForbiddenPathsRule(['.env']).evaluate(makeContext()).allowed).toBe(true);
  });

  it('should deny when forbidden file changed', () => {
    const ctx = makeContext({ changedFiles: ['.env.local'] });
    expect(new ForbiddenPathsRule(['.env']).evaluate(ctx).allowed).toBe(false);
  });
});

describe('RequireTestsPassRule', () => {
  it('should allow when tests pass', () => {
    expect(new RequireTestsPassRule().evaluate(makeContext()).allowed).toBe(true);
  });

  it('should deny when tests fail', () => {
    const ctx = makeContext({
      verificationResult: {
        ticketId: 't1', status: 'failed',
        checks: [{ name: 'test-runner', passed: false }],
      },
    });
    expect(new RequireTestsPassRule().evaluate(ctx).allowed).toBe(false);
  });

  it('should allow when no test-runner check exists', () => {
    const ctx = makeContext({
      verificationResult: { ticketId: 't1', status: 'passed', checks: [] },
    });
    expect(new RequireTestsPassRule().evaluate(ctx).allowed).toBe(true);
  });
});

describe('ForbiddenKeywordsRule', () => {
  it('should allow when no forbidden keywords', () => {
    expect(new ForbiddenKeywordsRule().evaluate(makeContext()).allowed).toBe(true);
  });

  it('should deny when FIXME found', () => {
    const ctx = makeContext({ diff: '+// FIXME: fix later' });
    expect(new ForbiddenKeywordsRule().evaluate(ctx).allowed).toBe(false);
  });
});

describe('NoNewDependenciesRule', () => {
  it('should allow when no package.json changed', () => {
    expect(new NoNewDependenciesRule().evaluate(makeContext()).allowed).toBe(true);
  });

  it('should deny when package.json changed with new deps', () => {
    const ctx = makeContext({
      changedFiles: ['package.json'],
      diff: '+"dependencies": { "new-pkg": "1.0" }',
    });
    expect(new NoNewDependenciesRule().evaluate(ctx).allowed).toBe(false);
  });
});

describe('SmartModeEngine', () => {
  it('should allow when all rules pass', () => {
    const engine = new SmartModeEngine([new MaxFilesChangedRule(10)]);
    const result = engine.evaluate(makeContext());
    expect(result.allowed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('should deny and collect reasons when rules fail', () => {
    const engine = new SmartModeEngine([
      new MaxFilesChangedRule(0),
      new ForbiddenKeywordsRule(['const']),
    ]);
    const result = engine.evaluate(makeContext());
    expect(result.allowed).toBe(false);
    expect(result.reasons).toHaveLength(2);
  });

  it('should create default engine via factory', () => {
    const engine = createDefaultSmartModeEngine();
    expect(engine.getRules().length).toBe(5);
  });
});
