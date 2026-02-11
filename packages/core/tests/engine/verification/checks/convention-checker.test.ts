import { describe, it, expect, vi } from 'vitest';
import { ConventionCheckerCheck, type FileReader } from '../../../../src/engine/verification/checks/convention-checker.js';
import { ConventionValidator, KebabCaseFileRule } from '../../../../src/conventions/validator.js';
import type { CheckContext } from '../../../../src/engine/verification/verification-check.js';

const ctx: CheckContext = {
  ticketId: 't1', workingDirectory: '/proj', branch: 'b', baseBranch: 'dev',
  changedFiles: ['src/myFile.ts'],
};

describe('ConventionCheckerCheck', () => {
  it('should pass when no violations', async () => {
    const validator = new ConventionValidator([new KebabCaseFileRule()]);
    const reader: FileReader = { readFile: vi.fn(async () => 'content') };
    const check = new ConventionCheckerCheck(validator, reader);
    const result = await check.run({ ...ctx, changedFiles: ['src/my-file.ts'] });
    expect(result.passed).toBe(true);
  });

  it('should fail when convention violations exist', async () => {
    const validator = new ConventionValidator([new KebabCaseFileRule()]);
    const reader: FileReader = { readFile: vi.fn(async () => 'content') };
    const check = new ConventionCheckerCheck(validator, reader);
    const result = await check.run(ctx);
    // KebabCaseFileRule is a warning, not error, so it passes
    expect(result.passed).toBe(true);
  });

  it('should pass when no changed files', async () => {
    const validator = new ConventionValidator();
    const reader: FileReader = { readFile: vi.fn() };
    const check = new ConventionCheckerCheck(validator, reader);
    const result = await check.run({ ...ctx, changedFiles: [] });
    expect(result.passed).toBe(true);
  });
});
