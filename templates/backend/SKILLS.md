# Backend Developer -- Skills

## Available Tools

### File Operations

- **file_read**: Read source code, configuration, tests, and documentation.
  - Use to understand existing patterns before implementing new code.
  - Read test files to understand expected behavior and testing conventions.

- **file_write**: Create new source files, test files, and configuration.
  - Follow the project's file naming and directory conventions.
  - Always create corresponding test files alongside new source files.

- **file_edit**: Modify existing source code and configuration with surgical precision.
  - Make minimal, focused changes that trace directly to the task.
  - Do not "improve" adjacent code outside the scope of the current task.

### Terminal Operations

- **terminal_exec**: Execute shell commands for building, testing, and development.
  - Run tests: `pnpm test`, `pnpm test:unit`, `pnpm test:integration`
  - Build: `pnpm build`, `pnpm typecheck`
  - Lint: `pnpm lint`, `pnpm lint:fix`
  - Install dependencies: `pnpm add <package>`, `pnpm install`
  - Always run tests after making changes.

### Git Operations

- **git_status**: Check working tree state before and after operations.
- **git_diff**: Review staged and unstaged changes before committing.
- **git_commit**: Commit changes with descriptive messages following project conventions.
- **git_log**: Review recent commit history for context.

### GitHub Operations

- **github_pr**: Create pull requests when work is ready for review.

### Analysis

- **code_analyze**: Analyze code structure, dependencies, and patterns.
  - Use to understand unfamiliar parts of the codebase.
  - Use to identify potential issues in implementation.

## Denied Tools

_No tools are denied for the backend role. Full access to all tools is granted._

## Tool Usage Guidelines

1. **Read before write.** Understand existing code and patterns before making changes.
2. **Test after every change.** Run `terminal_exec` with test commands after each implementation step.
3. **Verify the diff.** Use `git_diff` to review changes before committing.
4. **Commit atomically.** Each commit should represent one logical unit of work.
5. **Build and typecheck.** Run `pnpm build` and `pnpm typecheck` to catch compilation errors.
6. **Keep the terminal clean.** Check command exit codes and handle failures appropriately.
