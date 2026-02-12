import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock all heavy dependencies before importing daemon
vi.mock('@phalanx/core', async () => {
  const EventEmitter = (await import('node:events')).EventEmitter;

  class MockDaemonWiring {
    wire = vi.fn();
    start = vi.fn();
    stop = vi.fn().mockResolvedValue(undefined);
    unwire = vi.fn();
  }

  class MockOrchestrator extends EventEmitter {
    processQueue = vi.fn().mockResolvedValue(undefined);
  }

  class MockOrchestratorScheduler {
    start = vi.fn();
    stop = vi.fn().mockResolvedValue(undefined);
  }

  class MockVerificationService extends EventEmitter {
    verify = vi.fn();
  }

  class MockProposalService extends EventEmitter {
    create = vi.fn();
  }

  class MockProposalExecutor {
    execute = vi.fn();
  }

  class MockCompletionHandler extends EventEmitter {
    handleSubmitted = vi.fn();
    handlePass = vi.fn();
    handleEscalation = vi.fn();
  }

  class MockAssignmentService extends EventEmitter {
    assign = vi.fn();
    release = vi.fn();
  }

  class MockGoalManager extends EventEmitter {
    calculateProgress = vi.fn().mockReturnValue(0);
  }

  class MockSmartAssignmentService {
    smartAssign = vi.fn();
  }

  class MockModelSelector {
    select = vi.fn().mockReturnValue({
      provider: 'mock', model: 'mock-model', fullId: 'mock/mock-model', resolvedFrom: 'test',
    });
  }

  class MockAgentConfigurator {
    createConfiguredAgent = vi.fn();
    enhanceForTicket = vi.fn();
  }

  class MockAgentTicketExecutor {
    execute = vi.fn().mockResolvedValue({ success: true });
    addPostExecutionHook = vi.fn();
  }

  class MockDefaultAgentConfigResolver {
    resolve = vi.fn().mockReturnValue({
      role: 'backend', model: { provider: 'mock', model: 'mock' }, thinkingLevel: 'medium',
    });
  }

  class MockBranchManager {
    createTicketBranch = vi.fn().mockResolvedValue('ticket/test');
  }

  class MockSoulLoader {
    load = vi.fn().mockResolvedValue({ soul: '', identity: '', memory: '', skills: '' });
  }

  class MockAgentExecutor {
    run = vi.fn();
  }

  class MockToolRegistry {
    register = vi.fn();
  }

  class MockHeartbeatService extends EventEmitter {
    start = vi.fn();
    stop = vi.fn();
  }

  return {
    DaemonWiring: MockDaemonWiring,
    Orchestrator: MockOrchestrator,
    OrchestratorScheduler: MockOrchestratorScheduler,
    VerificationService: MockVerificationService,
    ProposalService: MockProposalService,
    ProposalExecutor: MockProposalExecutor,
    CompletionHandler: MockCompletionHandler,
    AssignmentService: MockAssignmentService,
    GoalManager: MockGoalManager,
    SmartAssignmentService: MockSmartAssignmentService,
    ModelSelector: MockModelSelector,
    AgentConfigurator: MockAgentConfigurator,
    AgentTicketExecutor: MockAgentTicketExecutor,
    DefaultAgentConfigResolver: MockDefaultAgentConfigResolver,
    BranchManager: MockBranchManager,
    SoulLoader: MockSoulLoader,
    AgentExecutor: MockAgentExecutor,
    ToolRegistry: MockToolRegistry,
    HeartbeatService: MockHeartbeatService,
    BUILTIN_TOOLS: [],
    injectConventions: vi.fn((config: Record<string, unknown>) => config),
    createLLMStack: vi.fn(() => ({
      registry: { register: vi.fn(), has: vi.fn().mockReturnValue(true), getAll: vi.fn().mockReturnValue([]) },
      healthTracker: {},
      resolver: {},
    })),
  };
});

vi.mock('../db', () => ({
  getDb: vi.fn(),
  getTicketRepository: vi.fn(() => ({})),
  getAgentRepository: vi.fn(() => ({ findByRole: vi.fn().mockReturnValue([]) })),
  getProposalRepository: vi.fn(() => ({})),
  getGoalRepository: vi.fn(() => ({})),
  getEpicRepository: vi.fn(() => ({})),
  getEscalationRepository: vi.fn(() => ({})),
  getHeartbeatLogRepository: vi.fn(() => ({})),
  getActivityLogRepository: vi.fn(() => ({})),
  getReverseProposalRepository: vi.fn(() => ({})),
}));

vi.mock('../event-bus', () => ({
  eventBus: { emit: vi.fn(), subscribe: vi.fn() },
}));

vi.mock('../llm-provider', () => ({
  getLLMProvider: vi.fn(() => ({
    provider: { name: 'mock', models: ['mock-model'], chat: vi.fn() },
    model: 'mock-model',
  })),
}));

describe('daemon singleton', () => {
  beforeEach(() => {
    // Reset globalThis state
    delete globalThis.__phalanx_daemon__;
    vi.resetModules();
  });

  afterEach(() => {
    delete globalThis.__phalanx_daemon__;
  });

  it('isDaemonRunning returns false initially', async () => {
    const { isDaemonRunning } = await import('../daemon');
    expect(isDaemonRunning()).toBe(false);
  });

  it('startDaemon sets running to true', async () => {
    const { startDaemon, isDaemonRunning } = await import('../daemon');
    startDaemon();
    expect(isDaemonRunning()).toBe(true);
  });

  it('startDaemon is idempotent', async () => {
    const { startDaemon, getDaemon } = await import('../daemon');
    startDaemon();
    const wiring1 = getDaemon();
    startDaemon();
    const wiring2 = getDaemon();
    expect(wiring1).toBe(wiring2);
    // wire() should be called only once (during creation)
    expect(wiring1.wire).toHaveBeenCalledTimes(1);
    // start() should be called only once (idempotent guard)
    expect(wiring1.start).toHaveBeenCalledTimes(1);
  });

  it('stopDaemon sets running to false', async () => {
    const { startDaemon, stopDaemon, isDaemonRunning } = await import('../daemon');
    startDaemon();
    expect(isDaemonRunning()).toBe(true);
    await stopDaemon();
    expect(isDaemonRunning()).toBe(false);
  });

  it('getDaemon returns same instance across calls', async () => {
    const { getDaemon } = await import('../daemon');
    const d1 = getDaemon();
    const d2 = getDaemon();
    expect(d1).toBe(d2);
  });
});
