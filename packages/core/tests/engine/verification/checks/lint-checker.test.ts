import { describe, it, expect, vi } from 'vitest';
import { LintCheckerCheck } from '../../../../src/engine/verification/checks/lint-checker.js';
import type { CommandRunner } from '../../../../src/engine/verification/checks/test-runner.js';
import type { CheckContext } from '../../../../src/engine/verification/verification-check.js';

const ctx: CheckContext = { ticketId: 't1', workingDirectory: '/proj', branch: 'b', baseBranch: 'dev' };

describe('LintCheckerCheck', () => {
  it('should pass when lint succeeds', async () => {
    const runner: CommandRunner = { exec: vi.fn(async () => ({ stdout: '', stderr: '', exitCode: 0 })) };
    const result = await new LintCheckerCheck(runner).run(ctx);
    expect(result.passed).toBe(true);
  });

  it('should fail when lint fails', async () => {
    const runner: CommandRunner = { exec: vi.fn(async () => ({ stdout: 'errors', stderr: '', exitCode: 1 })) };
    const result = await new LintCheckerCheck(runner).run(ctx);
    expect(result.passed).toBe(false);
  });
});
