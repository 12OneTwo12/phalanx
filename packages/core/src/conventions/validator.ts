/**
 * Convention validator — checks code compliance against conventions.
 * Uses Strategy pattern with extensible ConventionRule interface.
 */
import type { ConventionRule, ConventionViolation, ValidationResult, FileChange } from './types.js';
import { NoTodoRule } from './rules/no-todo-rule.js';
import { MaxFileSizeRule } from './rules/max-file-size-rule.js';
import { TestFileNamingRule } from './rules/test-file-naming-rule.js';

// ---------------------------------------------------------------------------
// Built-in rules
// ---------------------------------------------------------------------------

/** Ensure files use the expected naming convention (kebab-case) */
export class KebabCaseFileRule implements ConventionRule {
  readonly name = 'kebab-case-files';
  readonly description = 'File names should use kebab-case';
  readonly severity = 'warning' as const;

  validate(filePath: string, _content: string): ConventionViolation[] {
    const basename = filePath.split('/').pop() ?? '';
    const nameWithoutExt = basename.replace(/\.[^.]+$/, '');

    // Allow index files, dotfiles, and already kebab-case names
    if (nameWithoutExt === 'index' || basename.startsWith('.')) return [];
    if (/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(nameWithoutExt)) return [];

    return [{
      file: filePath,
      rule: this.name,
      severity: this.severity,
      message: `File "${basename}" does not follow kebab-case naming convention`,
      suggestion: `Rename to ${this.toKebabCase(nameWithoutExt)}`,
    }];
  }

  private toKebabCase(s: string): string {
    return s.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[_\s]+/g, '-').toLowerCase();
  }
}

/** Ensure no console.log statements in production code */
export class NoConsoleLogRule implements ConventionRule {
  readonly name = 'no-console-log';
  readonly description = 'Avoid console.log in production code';
  readonly severity = 'warning' as const;

  validate(filePath: string, content: string): ConventionViolation[] {
    // Skip test files
    if (filePath.includes('.test.') || filePath.includes('.spec.') || filePath.includes('__tests__')) {
      return [];
    }

    const violations: ConventionViolation[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      if (/\bconsole\.log\b/.test(lines[i]) && !lines[i].trim().startsWith('//')) {
        violations.push({
          file: filePath,
          line: i + 1,
          rule: this.name,
          severity: this.severity,
          message: 'Found console.log — use a proper logger instead',
          suggestion: 'Replace with logger.info() or logger.debug()',
        });
      }
    }

    return violations;
  }
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

export class ConventionValidator {
  private readonly rules: ConventionRule[] = [];

  constructor(rules?: ConventionRule[]) {
    if (rules) {
      this.rules.push(...rules);
    }
  }

  /** Add a rule to the validator */
  addRule(rule: ConventionRule): void {
    this.rules.push(rule);
  }

  /** Remove a rule by name */
  removeRule(name: string): void {
    const idx = this.rules.findIndex((r) => r.name === name);
    if (idx >= 0) this.rules.splice(idx, 1);
  }

  /** Get all registered rules */
  getRules(): readonly ConventionRule[] {
    return this.rules;
  }

  /** Validate a set of file changes against all registered rules */
  validate(files: FileChange[]): ValidationResult {
    const violations: ConventionViolation[] = [];

    for (const file of files) {
      for (const rule of this.rules) {
        violations.push(...rule.validate(file.path, file.content));
      }
    }

    return {
      passed: violations.filter((v) => v.severity === 'error').length === 0,
      violations,
    };
  }
}

/** Create a validator with the default built-in rules */
export function createDefaultValidator(): ConventionValidator {
  return new ConventionValidator([
    new KebabCaseFileRule(),
    new NoConsoleLogRule(),
    new NoTodoRule(),
    new MaxFileSizeRule(),
    new TestFileNamingRule(),
  ]);
}
