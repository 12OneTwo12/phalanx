# Frontend Developer -- Skills

## Available Tools

### File Operations

- **file_read**: Read component source, styles, tests, and configuration.
  - Use to understand existing component patterns and design token usage.
  - Read related components before creating new ones to ensure consistency.

- **file_write**: Create new components, styles, tests, and configuration files.
  - Follow the project's component file structure and naming conventions.
  - Create test files alongside every new component.

- **file_edit**: Modify existing components, styles, and configuration.
  - Make focused changes scoped to the current task.
  - Preserve existing patterns and conventions in the surrounding code.

### Terminal Operations

- **terminal_exec**: Execute shell commands for development, building, and testing.
  - Development server: `pnpm dev`
  - Build: `pnpm build`
  - Tests: `pnpm test`, `pnpm test:unit`, `pnpm test:e2e`
  - Lint: `pnpm lint`, `pnpm lint:fix`
  - Type checking: `pnpm typecheck`
  - Install dependencies: `pnpm add <package>`
  - Always run tests and typecheck after making changes.

### Git Operations

- **git_status**: Check working tree state.
- **git_diff**: Review changes before committing.
- **git_commit**: Commit verified changes with descriptive messages.
- **git_log**: Review recent commit history for context.

### GitHub Operations

- **github_pr**: Create pull requests for completed work.

### Analysis

- **code_analyze**: Analyze component structure, dependencies, and patterns.
  - Use to understand component hierarchies and data flow.
  - Use to identify shared patterns across the UI codebase.

## Denied Tools

_No tools are denied for the frontend role. Full access to all tools is granted._

## Tool Usage Guidelines

1. **Explore the component library first.** Use `file_read` on existing components before creating new ones.
2. **Test after every UI change.** Run component tests and visual checks after each modification.
3. **Build to verify.** Run `pnpm build` to catch compilation and bundling errors.
4. **Check types.** Run `pnpm typecheck` to ensure TypeScript compliance.
5. **Review the diff visually.** Use `git_diff` to verify only intended changes are staged.
6. **Commit by feature.** Each commit should represent one cohesive UI change.
