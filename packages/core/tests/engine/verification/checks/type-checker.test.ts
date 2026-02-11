import { describe, it, expect, vi } from 'vitest';
import { TypeCheckerCheck } from '../../../../src/engine/verification/checks/type-checker.js';
import type { CommandRunner } from '../../../../src/engine/verification/checks/test-runner.js';
import type { CheckContext } from '../../../../src/engine/verification/verification-check.js';

const ctx: CheckContext = { ticketId: 't1', workingDirectory: '/proj', branch: 'b', baseBranch: 'dev' };

describe('TypeCheckerCheck', () => {
  it('should pass when type check succeeds', async () => {
    const runner: CommandRunner = { exec: vi.fn(async () => ({ stdout: '', stderr: '', exitCode: 0 })) };
    const result = await new TypeCheckerCheck(runner).run(ctx);
    expect(result.passed).toBe(true);
  });

  it('should fail when type check fails', async () => {
    const runner: CommandRunner = { exec: vi.fn(async () => ({ stdout: 'TS2345', stderr: '', exitCode: 1 })) };
    const result = await new TypeCheckerCheck(runner).run(ctx);
    expect(result.passed).toBe(false);
  });
});
