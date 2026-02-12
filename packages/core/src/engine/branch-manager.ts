/**
 * Branch manager — Git branch lifecycle management for ticket isolation.
 * Each ticket gets its own branch following the convention: ticket/{id}-{slug}
 */

/**
 * Abstraction over git operations for testability.
 */
export interface GitOperations {
  branch(): Promise<string[]>;
  checkout(branchName: string): Promise<void>;
  checkoutBranch(branchName: string, startPoint: string): Promise<void>;
  deleteLocalBranch(branchName: string, force?: boolean): Promise<void>;
  revparse(args: string[]): Promise<string>;
  diff(args: string[]): Promise<string>;
  raw(args: string[]): Promise<string>;
}

/** Branch naming convention: ticket/{id}-{slug} */
const BRANCH_PREFIX = 'ticket/';
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_BRANCH_LENGTH = 100;

export class BranchManager {
  constructor(private readonly git: GitOperations) {}

  /**
   * Create a new ticket branch from the current HEAD.
   * @returns The full branch name created.
   */
  async createTicketBranch(ticketId: string, slug: string): Promise<string> {
    const branchName = this.buildBranchName(ticketId, slug);
    const currentBranch = await this.getCurrentBranch();
    await this.git.checkoutBranch(branchName, currentBranch);
    return branchName;
  }

  /**
   * Switch to an existing branch.
   */
  async switchBranch(branchName: string): Promise<void> {
    await this.git.checkout(branchName);
  }

  /**
   * Delete a local branch.
   */
  async deleteBranch(branchName: string, force = false): Promise<void> {
    await this.git.deleteLocalBranch(branchName, force);
  }

  /**
   * Get the current branch name.
   */
  async getCurrentBranch(): Promise<string> {
    const result = await this.git.revparse(['--abbrev-ref', 'HEAD']);
    return result.trim();
  }

  /**
   * Check if a branch exists locally.
   */
  async branchExists(branchName: string): Promise<boolean> {
    const branches = await this.git.branch();
    return branches.some((b) => b.trim().replace(/^\* /, '') === branchName);
  }

  /**
   * Get diff for the current branch against a base branch.
   */
  async getDiff(baseBranch: string): Promise<string> {
    return this.git.diff([baseBranch, '--']);
  }

  /**
   * Get list of changed files against a base branch.
   */
  async getChangedFiles(baseBranch: string): Promise<string[]> {
    const result = await this.git.raw(['diff', '--name-only', baseBranch]);
    return result
      .trim()
      .split('\n')
      .filter((f) => f.length > 0);
  }

  /**
   * Build a branch name from ticket ID and slug, enforcing conventions.
   */
  buildBranchName(ticketId: string, slug: string): string {
    if (!ticketId || ticketId.trim().length === 0) {
      throw new Error('Ticket ID cannot be empty');
    }

    const normalizedSlug = this.normalizeSlug(slug, ticketId);
    const branchName = `${BRANCH_PREFIX}${ticketId}-${normalizedSlug}`;

    if (branchName.length > MAX_BRANCH_LENGTH) {
      throw new Error(`Branch name exceeds maximum length of ${MAX_BRANCH_LENGTH}: ${branchName}`);
    }

    return branchName;
  }

  /**
   * Normalize a string into a valid slug for branch naming.
   * Handles special characters (including URL chars like /, ?, &, =)
   * and provides a fallback for inputs that produce no alphanumeric content.
   */
  normalizeSlug(input: string, ticketId?: string): string {
    if (!input || input.trim().length === 0) {
      throw new Error('Slug cannot be empty');
    }

    const slug = input
      .toLowerCase()
      .replace(/\//g, '-')    // Replace slashes explicitly for URL-like strings
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);

    if (slug && SLUG_PATTERN.test(slug)) {
      return slug;
    }

    // Fallback: use ticketId prefix if available, otherwise throw
    if (ticketId) {
      return `task-${ticketId.slice(0, 8)}`;
    }

    throw new Error(`Cannot create valid slug from input: "${input}"`);
  }
}
