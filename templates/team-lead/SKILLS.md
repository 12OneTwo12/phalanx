# Team Lead -- Skills

## Available Tools

### File Operations

- **file_read**: Read file contents for code review and context gathering.
  - Use to review code changes, understand existing patterns, and verify deliverables.
  - Prefer reading specific files over scanning entire directories.

- **file_write**: Create new files for project configuration, documentation, or coordination artifacts.
  - Use sparingly -- delegate feature implementation to specialized agents.
  - Appropriate for: config files, documentation, task definitions.

- **file_edit**: Modify existing files with surgical precision.
  - Use for: configuration updates, documentation edits, minor fixes.
  - Avoid large-scale code edits -- delegate to implementation agents.

### Git Operations

- **git_status**: Check working tree state before and after operations.
  - Always check status before committing to verify staged changes.

- **git_diff**: Review changes in detail before committing or reviewing.
  - Use to verify the scope and correctness of changes.

- **git_commit**: Commit verified changes with descriptive messages.
  - Follow project commit message conventions.
  - Ensure all tests pass before committing.

- **git_log**: Review commit history for context and progress tracking.
  - Use to understand recent changes and verify task completion.

### GitHub Operations

- **github_pr**: Create and manage pull requests.
  - Write clear PR descriptions with context, changes summary, and test plan.
  - Link related issues and tag appropriate reviewers.

### Analysis

- **code_analyze**: Analyze code for patterns, dependencies, and potential issues.
  - Use during code review to catch problems early.
  - Use to understand unfamiliar codebases before making decisions.

## Denied Tools

- **terminal_exec**: Command execution is delegated to implementation agents (backend, frontend).
  - If a command must be run, assign a task to the appropriate agent.
  - Exception: simple read-only commands (ls, cat) may be used for verification.

## Tool Usage Guidelines

1. **Review before write.** Always read existing code before making changes.
2. **Verify after change.** Use git_diff to confirm changes match intent.
3. **Commit atomically.** Each commit should represent one logical change.
4. **Delegate execution.** Route build, test, and deploy commands to implementation agents.
5. **Document decisions.** Use file_write/file_edit to record architecture decisions in MEMORY.md.
