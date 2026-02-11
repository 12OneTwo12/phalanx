/**
 * Edge case tests — Round 2.
 * Covers: branch manager edge cases, verification strategy errors,
 * PR controller/rules edge cases, ticket pipeline error scenarios.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BranchManager, type GitOperations } from '../../src/engine/branch-manager.js';
import { QAVerificationStrategy, type TicketBranchResolver } from '../../src/engine/verification/qa-verification-strategy.js';
import type { VerificationCheck, CheckResult, CheckContext } from '../../src/engine/verification/verification-check.js';
import { PRController } from '../../src/engine/pr/pr-controller.js';
import { SmartModeEngine, MaxFilesChangedRule, ForbiddenPathsRule, ForbiddenKeywordsRule, NoNewDependenciesRule, RequireTestsPassRule } from '../../src/engine/pr/smart-mode-rules.js';
import { PRCreator } from '../../src/engine/pr/pr-creator.js';
import { PRTemplate } from '../../src/engine/pr/pr-template.js';
import { TicketPipeline } from '../../src/engine/ticket-pipeline.js';
import { VerificationService, type VerificationStrategy } from '../../src/engine/verification-service.js';
import { DatabaseManager } from '../../src/db/database.js';
import { up } from '../../src/db/migrations/0001_initial.js';
import { GoalRepository, EpicRepository, TicketRepository } from '../../src/db/repositories/index.js';
import type { PRContext } from '../../src/engine/pr/types.js';
import type { Ticket } from '../../src/db/schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockGit(): GitOperations {
  return {
    branch: vi.fn(async () => ['main', '* dev', 'ticket/t1-task']),
    checkout: vi.fn(async () => {}),
    checkoutBranch: vi.fn(async () => {}),
    deleteLocalBranch: vi.fn(async () => {}),
    revparse: vi.fn(async () => 'dev\n'),
    diff: vi.fn(async () => ''),
    raw: vi.fn(async () => ''),
  };
}

function makePRContext(overrides: Partial<PRContext> = {}): PRContext {
  return {
    ticketId: 't1',
    branch: 'ticket/t1-x',
    baseBranch: 'dev',
    changedFiles: ['src/a.ts'],
    diff: '+const x = 1;',
    verificationResult: { ticketId: 't1', status: 'passed', checks: [] },
    ...overrides,
  };
}

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 't1', epicId: 'e1', title: 'Task', description: 'Do stuff',
    status: 'in_progress', priority: 'medium', assignedAgentId: null,
    branch: 'ticket/t1-task', prUrl: null, retryCount: 0, maxRetries: 3,
    dependsOn: null, proposedBy: null, approvedAt: null, metadata: null,
    createdAt: '2024-01-01', updatedAt: '2024-01-01',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// BranchManager — edge cases
// ---------------------------------------------------------------------------

describe('BranchManager edge cases', () => {
  let git: GitOperations;
  let manager: BranchManager;

  beforeEach(() => {
    git = createMockGit();
    manager = new BranchManager(git);
  });

  it('should detect existing branch via branchExists (with asterisk prefix)', async () => {
    // "* dev" is the current branch format from git
    expect(await manager.branchExists('dev')).toBe(true);
  });

  it('should handle whitespace-only ticket ID as empty', () => {
    expect(() => manager.buildBranchName('   ', 'slug')).toThrow('Ticket ID cannot be empty');
  });

  it('should handle whitespace-only slug as empty', () => {
    expect(() => manager.buildBranchName('t1', '   ')).toThrow('Slug cannot be empty');
  });

  it('should normalize slug with unicode characters', () => {
    const name = manager.buildBranchName('t1', 'café-résumé');
    expect(name).toBe('ticket/t1-caf-r-sum');
  });

  it('should normalize slug with leading/trailing special chars', () => {
    const name = manager.buildBranchName('t1', '---hello-world---');
    expect(name).toBe('ticket/t1-hello-world');
  });

  it('should truncate long slugs to 50 chars', () => {
    const longSlug = 'a-very-long-slug-that-keeps-going-and-going-and-going-and-going-and-never-stops';
    const name = manager.buildBranchName('t1', longSlug);
    // Slug part should be ≤50 chars
    const slugPart = name.replace('ticket/t1-', '');
    expect(slugPart.length).toBeLessThanOrEqual(50);
  });

  it('should return empty array for getChangedFiles with no changes', async () => {
    vi.mocked(git.raw).mockResolvedValue('');
    const files = await manager.getChangedFiles('main');
    expect(files).toEqual([]);
  });

  it('should propagate git errors from createTicketBranch', async () => {
    vi.mocked(git.revparse).mockRejectedValue(new Error('git not found'));
    await expect(manager.createTicketBranch('t1', 'task')).rejects.toThrow('git not found');
  });
});

// ---------------------------------------------------------------------------
// QAVerificationStrategy — all checks fail simultaneously
// ---------------------------------------------------------------------------

describe('QAVerificationStrategy edge cases', () => {
  const resolver: TicketBranchResolver = { resolve: (id: string) => `ticket/${id}-x` };

  function makeCheck(name: string, passed: boolean): VerificationCheck {
    return {
      name,
      run: vi.fn(async (): Promise<CheckResult> => ({ name, passed, details: passed ? 'ok' : `${name} failed` })),
    };
  }

  it('should aggregate feedback from all failing checks', async () => {
    const branchManager = {
      getDiff: vi.fn(async () => 'diff'),
      getChangedFiles: vi.fn(async () => ['a.ts']),
    } as unknown as BranchManager;

    const strategy = new QAVerificationStrategy(branchManager, resolver, {
      workingDirectory: '/proj',
      baseBranch: 'dev',
    });

    strategy.addCheck(makeCheck('test', false));
    strategy.addCheck(makeCheck('lint', false));
    strategy.addCheck(makeCheck('types', false));

    const result = await strategy.verify('t1');
    expect(result.status).toBe('failed');
    expect(result.checks).toHaveLength(3);
    expect(result.checks.every((c) => !c.passed)).toBe(true);
    expect(result.feedback).toContain('[test]');
    expect(result.feedback).toContain('[lint]');
    expect(result.feedback).toContain('[types]');
  });

  it('should handle check that throws an error gracefully via try/catch in caller', async () => {
    const branchManager = {
      getDiff: vi.fn(async () => 'diff'),
      getChangedFiles: vi.fn(async () => ['a.ts']),
    } as unknown as BranchManager;

    const strategy = new QAVerificationStrategy(branchManager, resolver, {
      workingDirectory: '/proj',
      baseBranch: 'dev',
    });

    const throwingCheck: VerificationCheck = {
      name: 'boom',
      run: vi.fn(async () => { throw new Error('Check exploded'); }),
    };
    strategy.addCheck(throwingCheck);

    // QAVerificationStrategy does not catch check errors — they propagate
    await expect(strategy.verify('t1')).rejects.toThrow('Check exploded');
  });

  it('should handle branchManager.getDiff failure gracefully', async () => {
    const branchManager = {
      getDiff: vi.fn(async () => { throw new Error('no git'); }),
      getChangedFiles: vi.fn(async () => { throw new Error('no git'); }),
    } as unknown as BranchManager;

    const strategy = new QAVerificationStrategy(branchManager, resolver, {
      workingDirectory: '/proj',
      baseBranch: 'dev',
    });
    strategy.addCheck(makeCheck('test', true));

    const result = await strategy.verify('t1');
    expect(result.status).toBe('passed');
    // Context should have undefined diff/changedFiles
    const ctx = vi.mocked(makeCheck('test', true).run).mock.calls;
    // Just verify it doesn't throw
  });
});

// ---------------------------------------------------------------------------
// PRController — edge cases
// ---------------------------------------------------------------------------

describe('PRController edge cases', () => {
  it('smart mode without engine returns manual_review', () => {
    const ctrl = new PRController('smart');
    const result = ctrl.decide(makePRContext());
    expect(result.decision).toBe('manual_review');
    expect(result.reasons).toContain('Smart mode but no engine configured');
  });

  it('smart mode with passing rules but failed verification returns manual_review', () => {
    const engine = new SmartModeEngine([new MaxFilesChangedRule(100)]);
    const ctrl = new PRController('smart', engine);
    const ctx = makePRContext({
      verificationResult: { ticketId: 't1', status: 'failed', checks: [] },
    });
    const result = ctrl.decide(ctx);
    expect(result.decision).toBe('manual_review');
    expect(result.reasons).toContain('Verification did not pass');
  });

  it('handles unknown mode gracefully', () => {
    const ctrl = new PRController('unknown' as any);
    const result = ctrl.decide(makePRContext());
    expect(result.decision).toBe('manual_review');
    expect(result.reasons[0]).toContain('Unknown mode');
  });
});

// ---------------------------------------------------------------------------
// SmartModeRules — edge cases
// ---------------------------------------------------------------------------

describe('SmartModeRules edge cases', () => {
  it('MaxFilesChangedRule: exactly at limit is allowed', () => {
    const ctx = makePRContext({ changedFiles: Array(5).fill('f.ts') });
    expect(new MaxFilesChangedRule(5).evaluate(ctx).allowed).toBe(true);
  });

  it('ForbiddenPathsRule: empty forbidden list allows everything', () => {
    const ctx = makePRContext({ changedFiles: ['.env', 'package-lock.json'] });
    expect(new ForbiddenPathsRule([]).evaluate(ctx).allowed).toBe(true);
  });

  it('NoNewDependenciesRule: package.json changed without dependencies key is allowed', () => {
    const ctx = makePRContext({
      changedFiles: ['package.json'],
      diff: '+"scripts": { "test": "vitest" }',
    });
    expect(new NoNewDependenciesRule().evaluate(ctx).allowed).toBe(true);
  });

  it('ForbiddenKeywordsRule: empty keywords list allows everything', () => {
    const ctx = makePRContext({ diff: '+// FIXME HACK XXX' });
    expect(new ForbiddenKeywordsRule([]).evaluate(ctx).allowed).toBe(true);
  });

  it('SmartModeEngine: addRule extends existing rules', () => {
    const engine = new SmartModeEngine();
    expect(engine.getRules()).toHaveLength(0);
    engine.addRule(new MaxFilesChangedRule(5));
    expect(engine.getRules()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// PRCreator — empty changed files
// ---------------------------------------------------------------------------

describe('PRCreator edge cases', () => {
  it('should handle getChangedFiles throwing by using empty list', async () => {
    const branchManager = {
      getChangedFiles: vi.fn(async () => { throw new Error('git error'); }),
      getDiff: vi.fn(async () => ''),
    } as unknown as BranchManager;

    const creator = new PRCreator(branchManager);
    const result = await creator.create({
      ticket: { id: 't1', title: 'Fix', description: 'D' },
      branch: 'ticket/t1-fix',
      baseBranch: 'dev',
      verificationResult: { ticketId: 't1', status: 'passed', checks: [] },
      decision: 'auto_merge',
    });

    expect(result.title).toContain('Fix');
    expect(result.body).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// PRTemplate — edge cases
// ---------------------------------------------------------------------------

describe('PRTemplate edge cases', () => {
  const template = new PRTemplate();

  it('should handle empty changed files list', () => {
    const body = template.generate({
      ticket: { id: 't1', title: 'T', description: 'D' },
      verificationResult: { ticketId: 't1', status: 'passed', checks: [] },
      changedFiles: [],
    });
    expect(body).toContain('T');
  });

  it('should handle ticket with no epicId or goalId', () => {
    const title = template.generateTitle({ id: 't1', title: 'My Task', description: 'D' });
    expect(title).toBe('feat(t1): My Task');
  });
});

// ---------------------------------------------------------------------------
// TicketPipeline — error scenarios
// ---------------------------------------------------------------------------

describe('TicketPipeline edge cases', () => {
  function makePipeline(overrides: {
    executor?: any;
    verification?: any;
    branchManager?: any;
    prController?: any;
    prCreator?: any;
    config?: any;
  } = {}) {
    const executor = overrides.executor ?? { execute: vi.fn(async () => ({ success: true })) };
    const verification = overrides.verification ?? {
      verify: vi.fn(async () => ({ ticketId: 't1', status: 'passed' as const, checks: [] })),
    };
    const branchManager = overrides.branchManager ?? {
      getChangedFiles: vi.fn(async () => ['a.ts']),
      getDiff: vi.fn(async () => 'diff'),
    };
    const prController = overrides.prController ?? {
      decide: vi.fn(() => ({ decision: 'auto_merge' as const, reasons: [] })),
    };
    const prCreator = overrides.prCreator ?? {
      create: vi.fn(async () => ({
        title: 'PR', body: 'body', branch: 'b', baseBranch: 'dev', decision: 'auto_merge' as const,
      })),
    };

    return new TicketPipeline(executor, verification, branchManager, prController, prCreator, {
      maxRetries: 3, baseBranch: 'dev', stabilityThreshold: 3,
      ...overrides.config,
    });
  }

  it('should handle verification throwing an error mid-pipeline', async () => {
    const pipeline = makePipeline({
      verification: {
        verify: vi.fn(async () => { throw new Error('Verification crashed'); }),
      },
    });

    const result = await pipeline.run(makeTicket());
    expect(result.success).toBe(false);
    expect(result.stage).toBe('verification');
    expect(result.error).toContain('Verification crashed');
  });

  it('should handle branchManager failure during PR stage gracefully', async () => {
    const pipeline = makePipeline({
      branchManager: {
        getChangedFiles: vi.fn(async () => { throw new Error('git broken'); }),
        getDiff: vi.fn(async () => { throw new Error('git broken'); }),
      },
    });

    const result = await pipeline.run(makeTicket());
    expect(result.success).toBe(true);
    expect(result.stage).toBe('completed');
  });

  it('should return max retries exceeded when all attempts fail execution', async () => {
    let count = 0;
    const pipeline = makePipeline({
      executor: {
        execute: vi.fn(async () => {
          count++;
          return { success: false, error: `error-${count}` };
        }),
      },
    });

    const result = await pipeline.run(makeTicket());
    expect(result.success).toBe(false);
    expect(result.error).toContain('Max retries');
    expect(result.attempts).toBe(3);
  });

  it('should handle ticket with null branch in PR stage', async () => {
    const pipeline = makePipeline();
    const result = await pipeline.run(makeTicket({ branch: null }));
    expect(result.success).toBe(true);
    // branch should be passed as empty string
  });

  it('should detect stable verification failure and stop early', async () => {
    let count = 0;
    const pipeline = makePipeline({
      verification: {
        verify: vi.fn(async () => ({
          ticketId: 't1', status: 'failed' as const, checks: [], feedback: 'same error',
        })),
      },
      config: { maxRetries: 10, stabilityThreshold: 3 },
    });

    const result = await pipeline.run(makeTicket());
    expect(result.success).toBe(false);
    expect(result.error).toContain('Stable verification failure');
    expect(result.attempts).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// VerificationService — additional edge cases
// ---------------------------------------------------------------------------

describe('VerificationService edge cases', () => {
  let db: DatabaseManager;
  let ticketRepo: TicketRepository;

  beforeEach(() => {
    db = DatabaseManager.create({ path: ':memory:' });
    up(db);
    new GoalRepository(db.orm).create({ id: 'g1', description: 'Goal' });
    new EpicRepository(db.orm).create({ id: 'e1', goalId: 'g1', title: 'Epic' });
    ticketRepo = new TicketRepository(db.orm);
  });

  afterEach(() => { db.close(); });

  it('should handle strategy that throws during verification', async () => {
    ticketRepo.create({ id: 't1', epicId: 'e1', title: 'T', description: 'D', status: 'verification' });
    const strategy: VerificationStrategy = {
      verify: vi.fn(async () => { throw new Error('Strategy exploded'); }),
    };
    const service = new VerificationService(ticketRepo, strategy);
    await expect(service.verify('t1')).rejects.toThrow('Strategy exploded');
    // Ticket status should remain unchanged since error was thrown before update
    expect(ticketRepo.findById('t1')?.status).toBe('verification');
  });

  it('should include current status in error message for wrong-state ticket', async () => {
    ticketRepo.create({ id: 't1', epicId: 'e1', title: 'T', description: 'D', status: 'done' });
    const strategy: VerificationStrategy = {
      verify: vi.fn(async () => ({ ticketId: 't1', status: 'passed' as const, checks: [] })),
    };
    const service = new VerificationService(ticketRepo, strategy);
    await expect(service.verify('t1')).rejects.toThrow('current: done');
  });

  it('should handle maxRetries of 1 (escalate on first failure)', async () => {
    ticketRepo.create({
      id: 't1', epicId: 'e1', title: 'T', description: 'D',
      status: 'verification', retryCount: 0, maxRetries: 1,
    });
    const strategy: VerificationStrategy = {
      verify: vi.fn(async () => ({
        ticketId: 't1', status: 'failed' as const, checks: [], feedback: 'fail',
      })),
    };
    const service = new VerificationService(ticketRepo, strategy);

    const escalatedSpy = vi.fn();
    service.on('verification:escalated', escalatedSpy);

    await service.verify('t1');
    expect(ticketRepo.findById('t1')?.status).toBe('escalated');
    expect(escalatedSpy).toHaveBeenCalledWith({ ticketId: 't1', retryCount: 1 });
  });
});
