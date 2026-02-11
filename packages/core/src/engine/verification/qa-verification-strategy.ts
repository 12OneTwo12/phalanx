/**
 * QA verification strategy — runs all checks in sequence and aggregates results.
 * Implements VerificationStrategy from the verification service.
 */
import type { VerificationStrategy } from '../verification-service.js';
import type { VerificationResult } from '../types.js';
import type { VerificationCheck, CheckContext } from './verification-check.js';
import type { BranchManager } from '../branch-manager.js';

export interface QAVerificationConfig {
  /** Working directory of the project */
  workingDirectory: string;
  /** Base branch to diff against */
  baseBranch: string;
}

/**
 * Resolves the branch name for a given ticket ID.
 */
export interface TicketBranchResolver {
  resolve(ticketId: string): string;
}

export class QAVerificationStrategy implements VerificationStrategy {
  private readonly checks: VerificationCheck[] = [];

  constructor(
    private readonly branchManager: BranchManager,
    private readonly branchResolver: TicketBranchResolver,
    private readonly config: QAVerificationConfig,
  ) {}

  /** Add a check to the pipeline */
  addCheck(check: VerificationCheck): void {
    this.checks.push(check);
  }

  /** Get all registered checks */
  getChecks(): readonly VerificationCheck[] {
    return this.checks;
  }

  async verify(ticketId: string): Promise<VerificationResult> {
    const branch = this.branchResolver.resolve(ticketId);

    // Preload context for efficiency
    let diff: string | undefined;
    let changedFiles: string[] | undefined;
    try {
      diff = await this.branchManager.getDiff(this.config.baseBranch);
      changedFiles = await this.branchManager.getChangedFiles(this.config.baseBranch);
    } catch {
      // If diff fails, individual checks will handle it
    }

    const context: CheckContext = {
      ticketId,
      workingDirectory: this.config.workingDirectory,
      branch,
      baseBranch: this.config.baseBranch,
      diff,
      changedFiles,
    };

    const checks: VerificationResult['checks'] = [];
    let allPassed = true;
    const feedbackParts: string[] = [];

    for (const check of this.checks) {
      const result = await check.run(context);
      checks.push({
        name: result.name,
        passed: result.passed,
        details: result.details,
      });

      if (!result.passed) {
        allPassed = false;
        feedbackParts.push(`[${result.name}] ${result.details ?? 'Check failed'}`);
      }
    }

    return {
      ticketId,
      status: allPassed ? 'passed' : 'failed',
      checks,
      feedback: feedbackParts.length > 0 ? feedbackParts.join('\n\n') : undefined,
    };
  }
}
