import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketPipeline } from '../../src/engine/ticket-pipeline.js';
import type { TicketExecutor } from '../../src/engine/orchestrator.js';
import type { VerificationService } from '../../src/engine/verification-service.js';
import type { BranchManager } from '../../src/engine/branch-manager.js';
import type { PRController } from '../../src/engine/pr/pr-controller.js';
import type { PRCreator } from '../../src/engine/pr/pr-creator.js';
import type { Ticket } from '../../src/db/schema.js';

function makeTicket(): Ticket {
  return {
    id: 't1', epicId: 'e1', title: 'Task', description: 'Do stuff',
    status: 'in_progress', priority: 'medium', assignedAgentId: null,
    branch: 'ticket/t1-task', prUrl: null, retryCount: 0, maxRetries: 3,
    dependsOn: null, proposedBy: null, approvedAt: null, metadata: null,
    createdAt: '2024-01-01', updatedAt: '2024-01-01',
  };
}

describe('TicketPipeline', () => {
  let executor: TicketExecutor;
  let verificationService: VerificationService;
  let branchManager: BranchManager;
  let prController: PRController;
  let prCreator: PRCreator;
  let pipeline: TicketPipeline;

  beforeEach(() => {
    executor = { execute: vi.fn(async () => ({ success: true })) };
    verificationService = {
      verify: vi.fn(async () => ({
        ticketId: 't1', status: 'passed' as const, checks: [],
      })),
    } as unknown as VerificationService;
    branchManager = {
      getChangedFiles: vi.fn(async () => ['a.ts']),
      getDiff: vi.fn(async () => 'diff'),
    } as unknown as BranchManager;
    prController = {
      decide: vi.fn(() => ({ decision: 'auto_merge' as const, reasons: [] })),
    } as unknown as PRController;
    prCreator = {
      create: vi.fn(async () => ({
        title: 'PR', body: 'body', branch: 'b', baseBranch: 'dev', decision: 'auto_merge' as const,
      })),
    } as unknown as PRCreator;

    pipeline = new TicketPipeline(executor, verificationService, branchManager, prController, prCreator, {
      maxRetries: 3, baseBranch: 'dev', stabilityThreshold: 3,
    });
  });

  it('should complete successfully on first attempt', async () => {
    const result = await pipeline.run(makeTicket());
    expect(result.success).toBe(true);
    expect(result.stage).toBe('completed');
    expect(result.attempts).toBe(1);
    expect(result.prResult).toBeDefined();
  });

  it('should retry on execution failure', async () => {
    let callCount = 0;
    vi.mocked(executor.execute).mockImplementation(async () => {
      callCount++;
      if (callCount < 2) return { success: false, error: 'fail' };
      return { success: true };
    });

    const result = await pipeline.run(makeTicket());
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
  });

  it('should fail after max retries', async () => {
    vi.mocked(executor.execute).mockResolvedValue({ success: false, error: 'always fails' });

    const result = await pipeline.run(makeTicket());
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(3);
  });

  it('should detect stable failure and stop early', async () => {
    vi.mocked(executor.execute).mockResolvedValue({ success: false, error: 'same error' });

    pipeline = new TicketPipeline(executor, verificationService, branchManager, prController, prCreator, {
      maxRetries: 10, baseBranch: 'dev', stabilityThreshold: 3,
    });

    const result = await pipeline.run(makeTicket());
    expect(result.success).toBe(false);
    expect(result.error).toContain('Stable failure');
    expect(result.attempts).toBe(3);
  });

  it('should retry on verification failure', async () => {
    let verifyCount = 0;
    vi.mocked(verificationService.verify).mockImplementation(async () => {
      verifyCount++;
      if (verifyCount < 2) return { ticketId: 't1', status: 'failed', checks: [], feedback: 'lint fail' };
      return { ticketId: 't1', status: 'passed', checks: [] };
    });

    const result = await pipeline.run(makeTicket());
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
  });

  it('should emit pipeline events', async () => {
    const stages: string[] = [];
    pipeline.on('pipeline:stage', (e) => stages.push(e.stage));

    await pipeline.run(makeTicket());
    expect(stages).toContain('execution');
    expect(stages).toContain('verification');
    expect(stages).toContain('pr_decision');
  });
});
