/**
 * PR creator — assembles PR data from ticket context, verification, and template.
 */
import type { BranchManager } from '../branch-manager.js';
import type { VerificationResult } from '../types.js';
import type { PRCreateResult, TicketInfo } from './types.js';
import { PRTemplate } from './pr-template.js';

export class PRCreator {
  private readonly template: PRTemplate;

  constructor(
    private readonly branchManager: BranchManager,
    template?: PRTemplate,
  ) {
    this.template = template ?? new PRTemplate();
  }

  /**
   * Create PR data for a ticket.
   */
  async create(params: {
    ticket: TicketInfo;
    branch: string;
    baseBranch: string;
    verificationResult: VerificationResult;
    decision: PRCreateResult['decision'];
  }): Promise<PRCreateResult> {
    let changedFiles: string[] = [];
    try {
      changedFiles = await this.branchManager.getChangedFiles(params.baseBranch);
    } catch {
      // If we can't get changed files, continue with empty list
    }

    const title = this.template.generateTitle(params.ticket);
    const body = this.template.generate({
      ticket: params.ticket,
      verificationResult: params.verificationResult,
      changedFiles,
    });

    return {
      title,
      body,
      branch: params.branch,
      baseBranch: params.baseBranch,
      decision: params.decision,
    };
  }
}
