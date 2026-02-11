/**
 * Verification check interface — Strategy pattern for individual QA checks.
 */

export interface CheckResult {
  name: string;
  passed: boolean;
  details?: string;
}

/**
 * A single verification check that can be run against a ticket's changes.
 */
export interface VerificationCheck {
  /** Unique name of this check */
  readonly name: string;

  /**
   * Run the check and return the result.
   * @param context - Contextual information for running the check
   */
  run(context: CheckContext): Promise<CheckResult>;
}

/**
 * Context provided to each verification check.
 */
export interface CheckContext {
  /** Ticket ID being verified */
  ticketId: string;
  /** Working directory of the project */
  workingDirectory: string;
  /** Branch name where changes were made */
  branch: string;
  /** Base branch to diff against */
  baseBranch: string;
  /** Diff content (optional, preloaded for efficiency) */
  diff?: string;
  /** List of changed file paths */
  changedFiles?: string[];
}
