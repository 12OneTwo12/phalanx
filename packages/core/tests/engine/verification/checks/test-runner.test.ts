import { describe, it, expect, vi } from 'vitest';
import { TestRunnerCheck, type CommandRunner } from '../../../../src/engine/verification/checks/test-runner.js';
import type { CheckContext } from '../../../../src/engine/verification/verification-check.js';

const ctx: CheckContext = { ticketId: 't1', workingDirectory: '/proj', branch: 'ticket/t1-x', baseBranch: 'dev' };

describe('TestRunnerCheck', () => {
  it('should pass when tests succeed', async () => {
    const runner: CommandRunner = { exec: vi.fn(async () => ({ stdout: 'ok', stderr: '', exitCode: 0 })) };
    const check = new TestRunnerCheck(runner);
    const result = await check.run(ctx);
    expect(result.passed).toBe(true);
  });

  it('should fail when tests fail', async () => {
    const runner: CommandRunner = { exec: vi.fn(async () => ({ stdout: 'FAIL', stderr: '', exitCode: 1 })) };
    const check = new TestRunnerCheck(runner);
    const result = await check.run(ctx);
    expect(result.passed).toBe(false);
    expect(result.details).toContain('exit code 1');
  });

  it('should fail when runner throws', async () => {
    const runner: CommandRunner = { exec: vi.fn(async () => { throw new Error('boom'); }) };
    const check = new TestRunnerCheck(runner);
    const result = await check.run(ctx);
    expect(result.passed).toBe(false);
    expect(result.details).toContain('boom');
  });

  it('should use custom test command', async () => {
    const runner: CommandRunner = { exec: vi.fn(async () => ({ stdout: '', stderr: '', exitCode: 0 })) };
    const check = new TestRunnerCheck(runner, 'pnpm test');
    await check.run(ctx);
    expect(runner.exec).toHaveBeenCalledWith('pnpm test', '/proj');
  });
});
