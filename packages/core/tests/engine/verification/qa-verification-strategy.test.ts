import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QAVerificationStrategy, type TicketBranchResolver } from '../../../src/engine/verification/qa-verification-strategy.js';
import type { BranchManager } from '../../../src/engine/branch-manager.js';
import type { VerificationCheck, CheckResult } from '../../../src/engine/verification/verification-check.js';

function makeMockBranchManager(): BranchManager {
  return {
    getDiff: vi.fn(async () => 'diff'),
    getChangedFiles: vi.fn(async () => ['a.ts']),
  } as unknown as BranchManager;
}

function makeCheck(name: string, passed: boolean): VerificationCheck {
  return {
    name,
    run: vi.fn(async (): Promise<CheckResult> => ({ name, passed, details: passed ? 'ok' : 'failed' })),
  };
}

describe('QAVerificationStrategy', () => {
  const resolver: TicketBranchResolver = { resolve: (id: string) => `ticket/${id}-x` };
  let branchManager: BranchManager;
  let strategy: QAVerificationStrategy;

  beforeEach(() => {
    branchManager = makeMockBranchManager();
    strategy = new QAVerificationStrategy(branchManager, resolver, {
      workingDirectory: '/proj',
      baseBranch: 'dev',
    });
  });

  it('should pass when all checks pass', async () => {
    strategy.addCheck(makeCheck('test', true));
    strategy.addCheck(makeCheck('lint', true));

    const result = await strategy.verify('t1');
    expect(result.status).toBe('passed');
    expect(result.checks).toHaveLength(2);
    expect(result.feedback).toBeUndefined();
  });

  it('should fail when any check fails', async () => {
    strategy.addCheck(makeCheck('test', true));
    strategy.addCheck(makeCheck('lint', false));

    const result = await strategy.verify('t1');
    expect(result.status).toBe('failed');
    expect(result.feedback).toContain('lint');
  });

  it('should return passed with no checks', async () => {
    const result = await strategy.verify('t1');
    expect(result.status).toBe('passed');
    expect(result.checks).toHaveLength(0);
  });

  it('should provide check context with diff and changed files', async () => {
    const check = makeCheck('test', true);
    strategy.addCheck(check);

    await strategy.verify('t1');

    const ctx = vi.mocked(check.run).mock.calls[0][0];
    expect(ctx.diff).toBe('diff');
    expect(ctx.changedFiles).toEqual(['a.ts']);
    expect(ctx.branch).toBe('ticket/t1-x');
  });
});
