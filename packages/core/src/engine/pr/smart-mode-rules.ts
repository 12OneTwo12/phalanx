/**
 * Smart mode rules — Strategy pattern for auto-merge decision rules.
 * Open/Closed: new rules can be added without modifying SmartModeEngine.
 */
import type { PRContext, AutoMergeRuleConfig } from './types.js';
import { DEFAULT_AUTO_MERGE_RULE_CONFIG } from './types.js';

export interface RuleEvaluation {
  allowed: boolean;
  reason?: string;
}

/**
 * Individual auto-merge rule. All rules must pass for auto-merge.
 */
export interface AutoMergeRule {
  readonly name: string;
  evaluate(context: PRContext): RuleEvaluation;
}

// ---------------------------------------------------------------------------
// Built-in rules
// ---------------------------------------------------------------------------

export class MaxFilesChangedRule implements AutoMergeRule {
  readonly name = 'max-files-changed';

  constructor(private readonly maxFiles: number = 20) {}

  evaluate(context: PRContext): RuleEvaluation {
    if (context.changedFiles.length > this.maxFiles) {
      return {
        allowed: false,
        reason: `Too many files changed: ${context.changedFiles.length} > ${this.maxFiles}`,
      };
    }
    return { allowed: true };
  }
}

export class ForbiddenPathsRule implements AutoMergeRule {
  readonly name = 'forbidden-paths';

  constructor(private readonly forbiddenPaths: string[] = []) {}

  evaluate(context: PRContext): RuleEvaluation {
    const violations = context.changedFiles.filter((f) =>
      this.forbiddenPaths.some((forbidden) => f.includes(forbidden)),
    );

    if (violations.length > 0) {
      return {
        allowed: false,
        reason: `Forbidden files changed: ${violations.join(', ')}`,
      };
    }
    return { allowed: true };
  }
}

export class RequireTestsPassRule implements AutoMergeRule {
  readonly name = 'require-tests-pass';

  evaluate(context: PRContext): RuleEvaluation {
    const testCheck = context.verificationResult.checks.find(
      (c) => c.name === 'test-runner',
    );

    if (testCheck && !testCheck.passed) {
      return { allowed: false, reason: 'Tests did not pass' };
    }
    return { allowed: true };
  }
}

export class ForbiddenKeywordsRule implements AutoMergeRule {
  readonly name = 'forbidden-keywords';

  constructor(private readonly keywords: string[] = ['FIXME', 'HACK', 'XXX']) {}

  evaluate(context: PRContext): RuleEvaluation {
    const found = this.keywords.filter((kw) => context.diff.includes(kw));
    if (found.length > 0) {
      return {
        allowed: false,
        reason: `Forbidden keywords found in diff: ${found.join(', ')}`,
      };
    }
    return { allowed: true };
  }
}

export class NoNewDependenciesRule implements AutoMergeRule {
  readonly name = 'no-new-dependencies';

  evaluate(context: PRContext): RuleEvaluation {
    const hasPackageJson = context.changedFiles.some((f) => f.endsWith('package.json'));
    if (hasPackageJson && context.diff.includes('"dependencies"')) {
      return {
        allowed: false,
        reason: 'New dependencies detected in package.json changes',
      };
    }
    return { allowed: true };
  }
}

// ---------------------------------------------------------------------------
// Smart mode engine
// ---------------------------------------------------------------------------

export class SmartModeEngine {
  private readonly rules: AutoMergeRule[] = [];

  constructor(rules?: AutoMergeRule[]) {
    if (rules) {
      this.rules.push(...rules);
    }
  }

  addRule(rule: AutoMergeRule): void {
    this.rules.push(rule);
  }

  getRules(): readonly AutoMergeRule[] {
    return this.rules;
  }

  /**
   * Evaluate all rules. All must pass for auto-merge to be allowed.
   */
  evaluate(context: PRContext): { allowed: boolean; reasons: string[] } {
    const reasons: string[] = [];

    for (const rule of this.rules) {
      const result = rule.evaluate(context);
      if (!result.allowed && result.reason) {
        reasons.push(`[${rule.name}] ${result.reason}`);
      }
    }

    return {
      allowed: reasons.length === 0,
      reasons,
    };
  }
}

/**
 * Create a SmartModeEngine with default rules.
 * Uses DEFAULT_AUTO_MERGE_RULE_CONFIG as baseline, overridden by provided config.
 */
export function createDefaultSmartModeEngine(
  config?: Partial<AutoMergeRuleConfig>,
): SmartModeEngine {
  const merged = { ...DEFAULT_AUTO_MERGE_RULE_CONFIG, ...config };

  return new SmartModeEngine([
    new MaxFilesChangedRule(merged.maxFilesChanged),
    new ForbiddenPathsRule(merged.forbiddenPaths),
    new RequireTestsPassRule(),
    new ForbiddenKeywordsRule(merged.forbiddenKeywords),
    new NoNewDependenciesRule(),
  ]);
}
