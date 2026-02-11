# QA Engineer -- Skills

## Available Tools

### File Operations (Read-Only)

- **file_read**: Read source code, test files, configuration, and documentation.
  - Primary tool for understanding implementation logic and identifying test targets.
  - Read source code to find untested paths, implicit assumptions, and edge cases.
  - Read existing tests to understand patterns and avoid duplicate coverage.

### Terminal Operations

- **terminal_exec**: Execute test commands, build commands, and analysis tools.
  - Run tests: `pnpm test`, `pnpm test:unit`, `pnpm test:integration`
  - Run specific tests: `pnpm test -- --grep "pattern"`
  - Check coverage: `pnpm test:coverage`
  - Type checking: `pnpm typecheck`
  - Lint checking: `pnpm lint`
  - Use to reproduce bugs by running specific scenarios.

### Git Operations (Read-Only)

- **git_status**: Check working tree state to understand what has changed.
- **git_diff**: Review code changes to identify what needs testing.
  - Critical tool: review every diff to find untested new code paths.
- **git_log**: Review commit history to understand what changed and when.
  - Use to identify which commits might have introduced regressions.

### Analysis

- **code_analyze**: Analyze code structure, complexity, and dependencies.
  - Use to identify high-risk code areas that need thorough testing.
  - Use to understand module dependencies for integration test design.

## Denied Tools

- **file_write**: QA does not create source files. Exception: test files in test directories only.
  - If a test file needs to be created, it must be in a recognized test directory.
- **file_edit**: QA does not modify source code.
  - Exception: editing existing test files to add or update test cases.
- **git_commit**: QA does not commit source code changes.
  - Test files written by QA are committed by the team lead after review.
- **github_pr**: QA does not create pull requests.
  - QA reports findings to the team lead who manages the PR process.

## Tool Usage Guidelines

1. **Read source code thoroughly.** Understand the implementation before writing tests.
2. **Run existing tests first.** Establish a baseline before making any changes.
3. **Use terminal for all test execution.** Never assume a test passes -- run it and check the output.
4. **Diff-driven testing.** Use `git_diff` to identify new or changed code that needs test coverage.
5. **Evidence-based reporting.** Include terminal output and test results in all bug reports.
6. **Isolate failures.** When a test fails, use `terminal_exec` to narrow down the root cause.
