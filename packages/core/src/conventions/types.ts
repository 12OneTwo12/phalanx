import { z } from 'zod';

// ---------------------------------------------------------------------------
// Detected Patterns (from analyzer)
// ---------------------------------------------------------------------------

export const DetectedPatternsSchema = z.object({
  language: z.string(),
  framework: z.string().nullable(),
  linter: z.string().nullable(),
  formatter: z.string().nullable(),
  testFramework: z.string().nullable(),
  namingConvention: z.string(),
  commitStyle: z.string(),
  folderStructure: z.array(z.string()),
  packageManager: z.string(),
  buildTool: z.string().nullable(),
  tsStrict: z.boolean().nullable(),
});

export type DetectedPatterns = z.infer<typeof DetectedPatternsSchema>;

// ---------------------------------------------------------------------------
// Convention Draft (generated from patterns)
// ---------------------------------------------------------------------------

export interface ConventionDraft {
  conventions: string;
  architecture: string;
  style: string;
  detectedPatterns: DetectedPatterns;
}

// ---------------------------------------------------------------------------
// Convention Violation (from validator)
// ---------------------------------------------------------------------------

export const ConventionViolationSeverity = z.enum(['error', 'warning']);
export type ConventionViolationSeverity = z.infer<typeof ConventionViolationSeverity>;

export interface ConventionViolation {
  file: string;
  line?: number;
  rule: string;
  severity: ConventionViolationSeverity;
  message: string;
  suggestion?: string;
}

// ---------------------------------------------------------------------------
// Validation Result
// ---------------------------------------------------------------------------

export interface ValidationResult {
  passed: boolean;
  violations: ConventionViolation[];
}

// ---------------------------------------------------------------------------
// Convention Proposal
// ---------------------------------------------------------------------------

export const ConventionProposalStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type ConventionProposalStatus = z.infer<typeof ConventionProposalStatusSchema>;

export interface ConventionProposal {
  id: string;
  proposedBy: 'team-lead';
  reason: string;
  diff: string;
  status: ConventionProposalStatus;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Convention Rule (strategy pattern for validator)
// ---------------------------------------------------------------------------

export interface ConventionRule {
  readonly name: string;
  readonly description: string;
  readonly severity: ConventionViolationSeverity;
  validate(filePath: string, content: string): ConventionViolation[];
}

// ---------------------------------------------------------------------------
// Loaded Conventions (for prompt injection)
// ---------------------------------------------------------------------------

export interface LoadedConventions {
  conventions: string | null;
  architecture: string | null;
  style: string | null;
}

// ---------------------------------------------------------------------------
// File Change (for validator input)
// ---------------------------------------------------------------------------

export interface FileChange {
  path: string;
  content: string;
}

// ---------------------------------------------------------------------------
// Watcher Events
// ---------------------------------------------------------------------------

export type WatcherEventType = 'added' | 'changed' | 'removed';

export interface WatcherEvent {
  type: WatcherEventType;
  path: string;
}
