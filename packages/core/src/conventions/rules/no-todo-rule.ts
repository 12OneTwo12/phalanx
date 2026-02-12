/**
 * Convention rule — flags TODO/FIXME/HACK/XXX comments in non-test code.
 */
import type { ConventionRule, ConventionViolation } from '../types.js';

const TODO_PATTERN = /\b(TODO|FIXME|HACK|XXX)\b/;

export class NoTodoRule implements ConventionRule {
  readonly name = 'no-todo';
  readonly description = 'Production code should not contain TODO/FIXME/HACK/XXX comments';
  readonly severity = 'warning' as const;

  validate(filePath: string, content: string): ConventionViolation[] {
    // Skip test files
    if (filePath.includes('.test.') || filePath.includes('.spec.') || filePath.includes('__tests__')) {
      return [];
    }

    const violations: ConventionViolation[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const match = TODO_PATTERN.exec(lines[i]);
      if (match) {
        violations.push({
          file: filePath,
          line: i + 1,
          rule: this.name,
          severity: this.severity,
          message: `Found ${match[1]} comment — resolve before merging`,
          suggestion: 'Resolve the TODO or create a ticket to track it',
        });
      }
    }

    return violations;
  }
}
