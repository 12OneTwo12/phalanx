/**
 * PR control system types.
 */
import type { VerificationResult } from '../types.js';

export type PRMode = 'manual' | 'smart' | 'auto';
export type PRDecision = 'auto_merge' | 'manual_review';

export interface AutoMergeRuleConfig {
  maxFilesChanged: number;
  forbiddenPaths: string[];
  forbiddenKeywords: string[];
  requireTestsPass: boolean;
  allowNewDependencies: boolean;
}

export const DEFAULT_AUTO_MERGE_RULE_CONFIG: AutoMergeRuleConfig = {
  maxFilesChanged: 20,
  forbiddenPaths: ['.env', 'package-lock.json', 'pnpm-lock.yaml'],
  forbiddenKeywords: ['FIXME', 'HACK', 'XXX'],
  requireTestsPass: true,
  allowNewDependencies: false,
};

export interface PRContext {
  ticketId: string;
  branch: string;
  baseBranch: string;
  changedFiles: string[];
  diff: string;
  verificationResult: VerificationResult;
}

export interface PRCreateResult {
  title: string;
  body: string;
  branch: string;
  baseBranch: string;
  decision: PRDecision;
}

export interface TicketInfo {
  id: string;
  title: string;
  description: string;
  epicId?: string;
  goalId?: string;
}
