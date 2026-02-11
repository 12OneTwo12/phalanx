/**
 * Convention checker — validates changed files against project conventions.
 */
import type { VerificationCheck, CheckResult, CheckContext } from '../verification-check.js';
import type { ConventionValidator } from '../../../conventions/validator.js';
import type { FileChange } from '../../../conventions/types.js';

/**
 * Reads file content for validation.
 */
export interface FileReader {
  readFile(path: string): Promise<string>;
}

export class ConventionCheckerCheck implements VerificationCheck {
  readonly name = 'convention-checker';

  constructor(
    private readonly validator: ConventionValidator,
    private readonly fileReader: FileReader,
  ) {}

  async run(context: CheckContext): Promise<CheckResult> {
    const changedFiles = context.changedFiles ?? [];
    if (changedFiles.length === 0) {
      return { name: this.name, passed: true, details: 'No files to check' };
    }

    try {
      const fileChanges: FileChange[] = [];
      for (const filePath of changedFiles) {
        try {
          const content = await this.fileReader.readFile(filePath);
          fileChanges.push({ path: filePath, content });
        } catch {
          // File may have been deleted; skip it
        }
      }

      if (fileChanges.length === 0) {
        return { name: this.name, passed: true, details: 'No readable files to check' };
      }

      const result = this.validator.validate(fileChanges);

      if (result.passed) {
        return {
          name: this.name,
          passed: true,
          details: `All ${fileChanges.length} files pass convention checks`,
        };
      }

      const violationSummary = result.violations
        .map((v) => `${v.file}${v.line ? `:${v.line}` : ''} [${v.severity}] ${v.message}`)
        .join('\n');

      return {
        name: this.name,
        passed: false,
        details: `Convention violations found:\n${violationSummary}`,
      };
    } catch (err) {
      return {
        name: this.name,
        passed: false,
        details: `Convention check failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
