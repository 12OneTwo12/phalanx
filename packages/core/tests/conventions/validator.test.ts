import { describe, it, expect } from 'vitest';
import {
  ConventionValidator,
  KebabCaseFileRule,
  NoConsoleLogRule,
  createDefaultValidator,
} from '../../src/conventions/validator.js';
import type { ConventionRule, ConventionViolation } from '../../src/conventions/types.js';

describe('ConventionValidator', () => {
  describe('KebabCaseFileRule', () => {
    const rule = new KebabCaseFileRule();

    it('should pass kebab-case files', () => {
      expect(rule.validate('my-component.ts', '')).toHaveLength(0);
      expect(rule.validate('index.ts', '')).toHaveLength(0);
    });

    it('should flag camelCase files', () => {
      const violations = rule.validate('myComponent.ts', '');
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('kebab-case-files');
    });

    it('should flag PascalCase files', () => {
      const violations = rule.validate('MyComponent.ts', '');
      expect(violations).toHaveLength(1);
    });
  });

  describe('NoConsoleLogRule', () => {
    const rule = new NoConsoleLogRule();

    it('should flag console.log in production code', () => {
      const violations = rule.validate('src/app.ts', 'console.log("hello");');
      expect(violations).toHaveLength(1);
      expect(violations[0].line).toBe(1);
    });

    it('should skip test files', () => {
      expect(rule.validate('src/app.test.ts', 'console.log("hello");')).toHaveLength(0);
      expect(rule.validate('src/app.spec.ts', 'console.log("hello");')).toHaveLength(0);
    });

    it('should skip commented lines', () => {
      expect(rule.validate('src/app.ts', '// console.log("hello");')).toHaveLength(0);
    });

    it('should detect multiple occurrences', () => {
      const code = 'console.log("a");\nconst x = 1;\nconsole.log("b");';
      const violations = rule.validate('src/app.ts', code);
      expect(violations).toHaveLength(2);
      expect(violations[0].line).toBe(1);
      expect(violations[1].line).toBe(3);
    });
  });

  describe('ConventionValidator', () => {
    it('should validate files against all rules', () => {
      const validator = createDefaultValidator();
      const result = validator.validate([
        { path: 'MyFile.ts', content: 'console.log("x");' },
      ]);
      // kebab-case violation + console.log violation
      expect(result.violations.length).toBeGreaterThanOrEqual(2);
    });

    it('should pass when no violations', () => {
      const validator = createDefaultValidator();
      const result = validator.validate([
        { path: 'my-file.ts', content: 'const x = 1;' },
      ]);
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should add and remove rules', () => {
      const validator = new ConventionValidator();
      expect(validator.getRules()).toHaveLength(0);

      validator.addRule(new KebabCaseFileRule());
      expect(validator.getRules()).toHaveLength(1);

      validator.removeRule('kebab-case-files');
      expect(validator.getRules()).toHaveLength(0);
    });

    it('should mark as failed only for error severity', () => {
      const errorRule: ConventionRule = {
        name: 'always-error',
        description: 'test',
        severity: 'error',
        validate: () => [{ file: 'x', rule: 'always-error', severity: 'error', message: 'fail' }],
      };
      const validator = new ConventionValidator([errorRule]);
      const result = validator.validate([{ path: 'x', content: '' }]);
      expect(result.passed).toBe(false);
    });

    it('should pass with only warnings', () => {
      const validator = createDefaultValidator();
      // Warnings don't cause failure
      const result = validator.validate([{ path: 'BadName.ts', content: '' }]);
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(1);
    });
  });
});
