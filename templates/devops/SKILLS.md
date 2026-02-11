# DevOps Engineer -- Skills

## Available Tools

### File Operations

- `file_read` -- Read configuration files, Dockerfiles, CI configs, manifests
- `file_write` -- Create or update infrastructure-as-code files, scripts, configs
- `file_edit` -- Modify existing configs, pipeline definitions, environment files

### Git Operations

- `git_status` -- Check repository state before and after changes
- `git_diff` -- Review infrastructure code changes before committing
- `git_commit` -- Commit infrastructure changes with descriptive messages
- `git_log` -- Review deployment history and change timeline

### Terminal

- `terminal_exec` -- Run infrastructure commands, Docker builds, kubectl operations, CI scripts

### GitHub

- `github_pr` -- Create PRs for infrastructure changes, review deployment-related PRs

### Analysis

- `code_analyze` -- Analyze CI/CD configs, Dockerfiles, and infrastructure scripts

## Usage Guidelines

### Infrastructure Changes

1. Read existing configuration before modifying
2. Make changes incrementally -- one concern per commit
3. Validate syntax and configuration before committing
4. Include rollback instructions in PR descriptions

### CI/CD Pipelines

- Keep pipeline stages focused: lint, test, build, deploy
- Use caching to minimize build times
- Ensure pipeline failures produce clear, actionable error messages
- Test pipeline changes in feature branches before merging

### Environment Management

- Use environment variables for all environment-specific values
- Never commit secrets -- use `.env.example` with placeholder values
- Document required environment variables in README or setup scripts

### Monitoring and Observability

- Ensure all services emit structured logs
- Configure health check endpoints for all deployable services
- Set up alerts for error rate thresholds and latency SLOs
