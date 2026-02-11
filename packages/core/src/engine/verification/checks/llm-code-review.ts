/**
 * LLM code review check — sends diff to an LLM for automated code review.
 */
import type { VerificationCheck, CheckResult, CheckContext } from '../verification-check.js';

/**
 * Abstraction for LLM chat interaction.
 */
export interface LLMReviewer {
  review(prompt: string): Promise<{ approved: boolean; feedback: string }>;
}

export class LLMCodeReviewCheck implements VerificationCheck {
  readonly name = 'llm-code-review';

  constructor(private readonly reviewer: LLMReviewer) {}

  async run(context: CheckContext): Promise<CheckResult> {
    const diff = context.diff;
    if (!diff || diff.trim().length === 0) {
      return { name: this.name, passed: true, details: 'No diff to review' };
    }

    try {
      const prompt = this.buildReviewPrompt(context);
      const result = await this.reviewer.review(prompt);

      return {
        name: this.name,
        passed: result.approved,
        details: result.feedback,
      };
    } catch (err) {
      return {
        name: this.name,
        passed: false,
        details: `LLM code review failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  private buildReviewPrompt(context: CheckContext): string {
    const truncatedDiff = (context.diff ?? '').slice(0, 10000);
    return [
      'Review the following code changes. Focus on:',
      '1. Correctness and potential bugs',
      '2. Security issues',
      '3. Code quality and maintainability',
      '',
      'Respond with whether you approve and provide feedback.',
      '',
      '```diff',
      truncatedDiff,
      '```',
    ].join('\n');
  }
}
