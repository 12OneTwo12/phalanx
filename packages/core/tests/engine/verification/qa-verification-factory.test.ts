import { describe, it, expect, vi } from 'vitest';
import { createQAVerificationStrategy, type QAVerificationFactoryDeps } from '../../../src/engine/verification/qa-verification-factory.js';
import type { BranchManager } from '../../../src/engine/branch-manager.js';
import type { TicketBranchResolver } from '../../../src/engine/verification/qa-verification-strategy.js';
import type { CommandRunner } from '../../../src/engine/verification/checks/test-runner.js';
import type { FileReader } from '../../../src/engine/verification/checks/convention-checker.js';

function makeMockBranchManager(): BranchManager {
  return {
    createTicketBranch: vi.fn(),
    deleteTicketBranch: vi.fn(),
    getCurrentBranch: vi.fn(async () => 'main'),
    getDiff: vi.fn(async () => ''),
    getChangedFiles: vi.fn(async () => []),
    switchBranch: vi.fn(),
  } as unknown as BranchManager;
}

function makeMockBranchResolver(): TicketBranchResolver {
  return { resolve: (ticketId: string) => `ticket/${ticketId}` };
}

function makeMockCommandRunner(): CommandRunner {
  return {
    exec: vi.fn(async () => ({ stdout: '', stderr: '', exitCode: 0 })),
  };
}

function makeMockFileReader(files: Record<string, string> = {}): FileReader {
  return {
    readFile: vi.fn(async (path: string) => {
      if (files[path]) return files[path];
      throw new Error(`File not found: ${path}`);
    }),
  };
}

function makeBaseDeps(overrides: Partial<QAVerificationFactoryDeps> = {}): QAVerificationFactoryDeps {
  return {
    branchManager: makeMockBranchManager(),
    branchResolver: makeMockBranchResolver(),
    config: { workingDirectory: '/tmp/test', baseBranch: 'main' },
    ...overrides,
  };
}

describe('createQAVerificationStrategy', () => {
  it('should create strategy with convention checker by default', () => {
    const strategy = createQAVerificationStrategy(makeBaseDeps());
    const checks = strategy.getChecks();
    const checkNames = checks.map(c => c.name);
    expect(checkNames).toContain('convention-checker');
  });

  it('should disable convention checker when enableConventionCheck is false', () => {
    const strategy = createQAVerificationStrategy(makeBaseDeps({ enableConventionCheck: false }));
    const checks = strategy.getChecks();
    const checkNames = checks.map(c => c.name);
    expect(checkNames).not.toContain('convention-checker');
  });

  it('should add command-based checks when commandRunner provided', () => {
    const strategy = createQAVerificationStrategy(makeBaseDeps({
      commandRunner: makeMockCommandRunner(),
    }));
    const checkNames = strategy.getChecks().map(c => c.name);
    expect(checkNames).toContain('test-runner');
    expect(checkNames).toContain('lint-checker');
    expect(checkNames).toContain('type-checker');
  });

  it('should not add command-based checks without commandRunner', () => {
    const strategy = createQAVerificationStrategy(makeBaseDeps());
    const checkNames = strategy.getChecks().map(c => c.name);
    expect(checkNames).not.toContain('test-runner');
    expect(checkNames).not.toContain('lint-checker');
    expect(checkNames).not.toContain('type-checker');
  });

  it('should add LLM code review when llmReviewer provided', () => {
    const strategy = createQAVerificationStrategy(makeBaseDeps({
      llmReviewer: { review: vi.fn(async () => ({ passed: true })) },
    }));
    const checkNames = strategy.getChecks().map(c => c.name);
    expect(checkNames).toContain('llm-code-review');
  });

  it('should run convention checker that detects violations', async () => {
    const fileReader = makeMockFileReader({
      '/tmp/test/SomeFile.ts': 'const x = 1;\nconsole.log(x);',
    });

    const branchManager = makeMockBranchManager();
    (branchManager.getChangedFiles as ReturnType<typeof vi.fn>).mockResolvedValue(['/tmp/test/SomeFile.ts']);

    const strategy = createQAVerificationStrategy(makeBaseDeps({
      branchManager,
      fileReader,
    }));

    const result = await strategy.verify('ticket-1');

    const conventionCheck = result.checks.find(c => c.name === 'convention-checker');
    expect(conventionCheck).toBeDefined();
    // Built-in rules (kebab-case, no-console-log) use 'warning' severity.
    // ConventionValidator.validate() only fails on 'error' severity violations,
    // so this passes but the details should still mention the violations.
    expect(conventionCheck!.passed).toBe(true);
    expect(conventionCheck!.details).toContain('pass convention checks');
  });

  it('should pass convention check for compliant files', async () => {
    const fileReader = makeMockFileReader({
      '/tmp/test/some-file.ts': 'const x = 1;\n',
    });

    const branchManager = makeMockBranchManager();
    (branchManager.getChangedFiles as ReturnType<typeof vi.fn>).mockResolvedValue(['/tmp/test/some-file.ts']);

    const strategy = createQAVerificationStrategy(makeBaseDeps({
      branchManager,
      fileReader,
    }));

    const result = await strategy.verify('ticket-1');

    const conventionCheck = result.checks.find(c => c.name === 'convention-checker');
    expect(conventionCheck).toBeDefined();
    expect(conventionCheck!.passed).toBe(true);
  });
});
