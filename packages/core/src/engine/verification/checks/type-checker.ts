/**
 * Type checker — runs TypeScript type checking via tsc --noEmit.
 */
import type { VerificationCheck, CheckResult, CheckContext } from '../verification-check.js';
import type { CommandRunner } from './test-runner.js';

export class TypeCheckerCheck implements VerificationCheck {
  readonly name = 'type-checker';

  constructor(
    private readonly runner: CommandRunner,
    private readonly tscCommand = 'npx tsc --noEmit',
  ) {}

  async run(context: CheckContext): Promise<CheckResult> {
    try {
      const result = await this.runner.exec(this.tscCommand, context.workingDirectory);

      if (result.exitCode === 0) {
        return { name: this.name, passed: true, details: 'Type check passed' };
      }

      const output = (result.stdout + '\n' + result.stderr).trim();
      return {
        name: this.name,
        passed: false,
        details: `Type errors found (exit code ${result.exitCode}):\n${output.slice(0, 2000)}`,
      };
    } catch (err) {
      return {
        name: this.name,
        passed: false,
        details: `Failed to run type checker: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
