/**
 * Test runner check — runs the project test suite via shell command.
 */
import type { VerificationCheck, CheckResult, CheckContext } from '../verification-check.js';

/**
 * Shell command executor abstraction for testability.
 */
export interface CommandRunner {
  exec(command: string, cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number }>;
}

export class TestRunnerCheck implements VerificationCheck {
  readonly name = 'test-runner';

  constructor(
    private readonly runner: CommandRunner,
    private readonly testCommand = 'npm test',
  ) {}

  async run(context: CheckContext): Promise<CheckResult> {
    try {
      const result = await this.runner.exec(this.testCommand, context.workingDirectory);

      if (result.exitCode === 0) {
        return {
          name: this.name,
          passed: true,
          details: 'All tests passed',
        };
      }

      const output = (result.stdout + '\n' + result.stderr).trim();
      return {
        name: this.name,
        passed: false,
        details: `Tests failed (exit code ${result.exitCode}):\n${output.slice(0, 2000)}`,
      };
    } catch (err) {
      return {
        name: this.name,
        passed: false,
        details: `Failed to run tests: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
