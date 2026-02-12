/**
 * Convention rule — ensures test files follow naming conventions.
 * Test files must use `.test.ts` or `.spec.ts` suffix and reside in
 * `__tests__/` or alongside source files.
 */
import type { ConventionRule, ConventionViolation } from '../types.js';

export class TestFileNamingRule implements ConventionRule {
  readonly name = 'test-file-naming';
  readonly description = 'Test files must use .test.ts or .spec.ts suffix';
  readonly severity = 'warning' as const;

  validate(filePath: string, content: string): ConventionViolation[] {
    // Only check TypeScript files in test-related directories
    if (!filePath.includes('__tests__') && !filePath.includes('/tests/')) {
      return [];
    }
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) {
      return [];
    }

    // Files in test directories should have .test. or .spec. suffix
    const basename = filePath.split('/').pop() ?? '';
    if (basename.startsWith('index.') || basename.startsWith('setup.') || basename.startsWith('helpers.') || basename.startsWith('fixtures.')) {
      return []; // Allow test utility files
    }

    if (!basename.includes('.test.') && !basename.includes('.spec.')) {
      // Check if the file contains test assertions to confirm it's actually a test
      if (content.includes('describe(') || content.includes('it(') || content.includes('test(')) {
        return [{
          file: filePath,
          rule: this.name,
          severity: this.severity,
          message: `Test file "${basename}" should use .test.ts or .spec.ts suffix`,
          suggestion: `Rename to ${basename.replace(/\.ts(x?)$/, '.test.ts$1')}`,
        }];
      }
    }

    return [];
  }
}
