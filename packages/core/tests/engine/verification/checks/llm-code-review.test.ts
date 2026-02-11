import { describe, it, expect, vi } from 'vitest';
import { LLMCodeReviewCheck, type LLMReviewer } from '../../../../src/engine/verification/checks/llm-code-review.js';
import type { CheckContext } from '../../../../src/engine/verification/verification-check.js';

const ctx: CheckContext = { ticketId: 't1', workingDirectory: '/proj', branch: 'b', baseBranch: 'dev', diff: '+const x = 1;' };

describe('LLMCodeReviewCheck', () => {
  it('should pass when reviewer approves', async () => {
    const reviewer: LLMReviewer = { review: vi.fn(async () => ({ approved: true, feedback: 'LGTM' })) };
    const result = await new LLMCodeReviewCheck(reviewer).run(ctx);
    expect(result.passed).toBe(true);
    expect(result.details).toBe('LGTM');
  });

  it('should fail when reviewer rejects', async () => {
    const reviewer: LLMReviewer = { review: vi.fn(async () => ({ approved: false, feedback: 'Bug found' })) };
    const result = await new LLMCodeReviewCheck(reviewer).run(ctx);
    expect(result.passed).toBe(false);
  });

  it('should pass when no diff', async () => {
    const reviewer: LLMReviewer = { review: vi.fn() };
    const result = await new LLMCodeReviewCheck(reviewer).run({ ...ctx, diff: '' });
    expect(result.passed).toBe(true);
  });

  it('should fail when reviewer throws', async () => {
    const reviewer: LLMReviewer = { review: vi.fn(async () => { throw new Error('API error'); }) };
    const result = await new LLMCodeReviewCheck(reviewer).run(ctx);
    expect(result.passed).toBe(false);
    expect(result.details).toContain('API error');
  });
});
