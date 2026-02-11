import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentTicketExecutor, DefaultAgentConfigResolver } from '../../src/engine/agent-ticket-executor.js';
import type { AgentTicketExecutorConfig } from '../../src/engine/agent-ticket-executor.js';
import type { BranchManager } from '../../src/engine/branch-manager.js';
import type { AgentExecutor } from '../../src/agents/agent-executor.js';
import type { Ticket } from '../../src/db/schema.js';

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 't1',
    epicId: 'e1',
    title: 'Add Login',
    description: 'Implement login feature',
    status: 'in_progress',
    priority: 'medium',
    assignedAgentId: null,
    branch: null,
    prUrl: null,
    retryCount: 0,
    maxRetries: 3,
    dependsOn: null,
    proposedBy: null,
    approvedAt: null,
    metadata: null,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

function makeMockBranchManager(): BranchManager {
  return {
    createTicketBranch: vi.fn(async (id: string, slug: string) => `ticket/${id}-${slug}`),
    switchBranch: vi.fn(async () => {}),
    deleteBranch: vi.fn(async () => {}),
    getCurrentBranch: vi.fn(async () => 'dev'),
    branchExists: vi.fn(async () => false),
    getDiff: vi.fn(async () => ''),
    getChangedFiles: vi.fn(async () => []),
    buildBranchName: vi.fn((id: string, slug: string) => `ticket/${id}-${slug}`),
  } as unknown as BranchManager;
}

function makeMockAgentExecutor(): AgentExecutor {
  return {
    run: vi.fn(async () => ({
      status: 'completed' as const,
      finalContent: 'Done',
      conversationHistory: [],
      iterations: 1,
      totalUsage: { inputTokens: 0, outputTokens: 0 },
      toolCallCount: 0,
    })),
  } as unknown as AgentExecutor;
}

const defaultConfig: AgentTicketExecutorConfig = {
  defaultModel: { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929', fullId: 'anthropic/claude-sonnet-4-5-20250929' } as any,
  defaultThinkingLevel: 'low',
  defaultToolPermissions: {},
  workingDirectory: '/project',
  maxIterations: 25,
  baseBranch: 'dev',
};

describe('AgentTicketExecutor', () => {
  let executor: AgentExecutor;
  let branchManager: BranchManager;
  let ticketExecutor: AgentTicketExecutor;

  beforeEach(() => {
    executor = makeMockAgentExecutor();
    branchManager = makeMockBranchManager();
    ticketExecutor = new AgentTicketExecutor(executor, branchManager, defaultConfig);
  });

  it('should execute a ticket successfully', async () => {
    const result = await ticketExecutor.execute(makeTicket());
    expect(result.success).toBe(true);
    expect(branchManager.createTicketBranch).toHaveBeenCalledWith('t1', 'Add Login');
    expect(executor.run).toHaveBeenCalled();
  });

  it('should return failure when agent fails', async () => {
    vi.mocked(executor.run).mockResolvedValue({
      status: 'error',
      finalContent: '',
      conversationHistory: [],
      iterations: 1,
      totalUsage: { inputTokens: 0, outputTokens: 0 },
      toolCallCount: 0,
      error: 'LLM error',
    });

    const result = await ticketExecutor.execute(makeTicket());
    expect(result.success).toBe(false);
    expect(result.error).toBe('LLM error');
  });

  it('should return failure when branch creation fails', async () => {
    vi.mocked(branchManager.createTicketBranch).mockRejectedValue(new Error('Branch exists'));
    const result = await ticketExecutor.execute(makeTicket());
    expect(result.success).toBe(false);
    expect(result.error).toBe('Branch exists');
  });

  it('should inject conventions into task prompt when available', async () => {
    const configWithConventions = { ...defaultConfig, conventions: 'Use kebab-case' };
    ticketExecutor = new AgentTicketExecutor(executor, branchManager, configWithConventions);

    await ticketExecutor.execute(makeTicket());

    const call = vi.mocked(executor.run).mock.calls[0];
    expect(call[1]).toContain('Use kebab-case');
  });
});

describe('DefaultAgentConfigResolver', () => {
  const resolver = new DefaultAgentConfigResolver();

  it('should resolve backend role by default', () => {
    const result = resolver.resolve(makeTicket(), defaultConfig);
    expect(result.role).toBe('backend');
  });

  it('should resolve role from ticket metadata category', () => {
    const ticket = makeTicket({ metadata: JSON.stringify({ category: 'frontend' }) });
    const result = resolver.resolve(ticket, defaultConfig);
    expect(result.role).toBe('frontend');
  });

  it('should fallback to backend for unknown category', () => {
    const ticket = makeTicket({ metadata: JSON.stringify({ category: 'unknown' }) });
    const result = resolver.resolve(ticket, defaultConfig);
    expect(result.role).toBe('backend');
  });
});
