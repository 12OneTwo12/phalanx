/**
 * QA verification strategy factory — assembles the full verification pipeline
 * with all available checks including convention checking.
 */
import * as fs from 'node:fs/promises';
import { QAVerificationStrategy, type QAVerificationConfig, type TicketBranchResolver } from './qa-verification-strategy.js';
import { TestRunnerCheck, type CommandRunner } from './checks/test-runner.js';
import { LintCheckerCheck } from './checks/lint-checker.js';
import { TypeCheckerCheck } from './checks/type-checker.js';
import { ConventionCheckerCheck, type FileReader } from './checks/convention-checker.js';
import { LLMCodeReviewCheck, type LLMReviewer } from './checks/llm-code-review.js';
import { createDefaultValidator } from '../../conventions/validator.js';
import type { BranchManager } from '../branch-manager.js';

/** NodeJS filesystem FileReader implementation */
class NodeFileReader implements FileReader {
  async readFile(path: string): Promise<string> {
    return fs.readFile(path, 'utf-8');
  }
}

export interface QAVerificationFactoryDeps {
  branchManager: BranchManager;
  branchResolver: TicketBranchResolver;
  config: QAVerificationConfig;
  commandRunner?: CommandRunner;
  llmReviewer?: LLMReviewer;
  /** Set to false to disable convention checking. Default: true */
  enableConventionCheck?: boolean;
  /** Custom FileReader for convention checking (useful for testing) */
  fileReader?: FileReader;
}

/**
 * Create a QAVerificationStrategy with all checks wired up.
 */
export function createQAVerificationStrategy(deps: QAVerificationFactoryDeps): QAVerificationStrategy {
  const strategy = new QAVerificationStrategy(
    deps.branchManager,
    deps.branchResolver,
    deps.config,
  );

  // Core build checks
  if (deps.commandRunner) {
    strategy.addCheck(new TestRunnerCheck(deps.commandRunner));
    strategy.addCheck(new LintCheckerCheck(deps.commandRunner));
    strategy.addCheck(new TypeCheckerCheck(deps.commandRunner));
  }

  // Convention checking (enabled by default)
  if (deps.enableConventionCheck !== false) {
    const validator = createDefaultValidator();
    const fileReader = deps.fileReader ?? new NodeFileReader();
    strategy.addCheck(new ConventionCheckerCheck(validator, fileReader));
  }

  // Optional LLM code review
  if (deps.llmReviewer) {
    strategy.addCheck(new LLMCodeReviewCheck(deps.llmReviewer));
  }

  return strategy;
}
