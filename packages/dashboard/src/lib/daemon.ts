/**
 * Dashboard DaemonWiring singleton — lazy initialization with globalThis
 * for hot-reload safety.
 *
 * Bridges Dashboard ↔ Orchestrator so that ticket status changes trigger
 * automatic agent assignment and execution via the OrchestratorScheduler.
 *
 * Uses globalThis to survive Next.js hot-module reloads in development.
 */
import {
  DaemonWiring,
  type DaemonDeps,
  Orchestrator,
  OrchestratorScheduler,
  VerificationService,
  ProposalService,
  ProposalExecutor,
  CompletionHandler,
  AssignmentService,
  GoalManager,
  SmartAssignmentService,
  AgentConfigurator,
  ModelSelector,
  AgentTicketExecutor,
  DefaultAgentConfigResolver,
  BranchManager,
  injectConventions,
  createLLMStack,
  SoulLoader,
  AgentExecutor,
  ToolRegistry,
  BUILTIN_TOOLS,
  HeartbeatService,
  MemoryUpdateHook,
} from '@phalanx/core';
import * as fs from 'node:fs/promises';
import {
  getTicketRepository,
  getAgentRepository,
  getProposalRepository,
  getGoalRepository,
  getEpicRepository,
  getEscalationRepository,
  getHeartbeatLogRepository,
  getActivityLogRepository,
  getReverseProposalRepository,
} from './db';
import { eventBus } from './event-bus';
import { getLLMProvider } from './llm-provider';
import { findProjectRoot } from './convention-sync';

// ---------------------------------------------------------------------------
// globalThis guard for HMR
// ---------------------------------------------------------------------------

interface DaemonState {
  wiring: DaemonWiring;
  started: boolean;
}

declare global {
  // biome-ignore: globalThis requires var
  var __phalanx_daemon__: DaemonState | undefined;
}

// ---------------------------------------------------------------------------
// Stub implementations for optional services
// ---------------------------------------------------------------------------

/** No-op git operations for environments without git access */
const noopGitOps = {
  async branch() { return []; },
  async checkout() { /* noop */ },
  async checkoutBranch() { /* noop */ },
  async deleteLocalBranch() { /* noop */ },
  async revparse() { return 'HEAD'; },
  async diff() { return ''; },
  async raw() { return ''; },
};

/** Passthrough verification strategy (always passes) for MVP */
const passthroughVerification = {
  async verify(ticketId: string) {
    return { ticketId, status: 'passed' as const, checks: [], feedback: undefined };
  },
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function createDaemonWiring(): DaemonState {
  const projectRoot = process.env.PHALANX_PROJECT_ROOT ?? findProjectRoot(process.cwd());
  const templatesDir = `${projectRoot}/templates`;

  // Repositories
  const ticketRepo = getTicketRepository();
  const agentRepo = getAgentRepository();
  const proposalRepo = getProposalRepository();
  const goalRepo = getGoalRepository();
  const epicRepo = getEpicRepository();
  const escalationRepo = getEscalationRepository();
  const heartbeatLogRepo = getHeartbeatLogRepository();
  const activityLogRepo = getActivityLogRepository();
  const reverseProposalRepo = getReverseProposalRepository();

  // LLM provider
  const llmResult = getLLMProvider();
  if (!llmResult) {
    throw new Error(
      'No LLM provider configured. Run "phalanx init" or set ANTHROPIC_API_KEY / OPENAI_API_KEY.',
    );
  }
  const { provider: llmProvider } = llmResult;

  // Provider registry for model selector
  const { registry: providerRegistry } = createLLMStack();
  providerRegistry.register(llmProvider);

  // Core services
  const soulLoader = new SoulLoader(templatesDir);
  const toolRegistry = new ToolRegistry();
  for (const tool of BUILTIN_TOOLS) {
    toolRegistry.register(tool);
  }
  const agentExecutor = new AgentExecutor(llmProvider, toolRegistry);

  const branchManager = new BranchManager(noopGitOps);

  const executorConfig = injectConventions(
    {
      defaultModel: {
        provider: llmProvider.name,
        model: llmProvider.models[0] ?? 'claude-sonnet-4-5-20250929',
        fullId: `${llmProvider.name}/${llmProvider.models[0] ?? 'claude-sonnet-4-5-20250929'}`,
        resolvedFrom: 'system',
      },
      defaultThinkingLevel: 'medium',
      defaultToolPermissions: {
        allowlist: ['file_read', 'file_write', 'file_edit', 'terminal_exec', 'git_status', 'git_diff', 'git_commit'],
        denylist: [],
      },
      workingDirectory: projectRoot,
      maxIterations: 20,
      baseBranch: 'main',
    },
    projectRoot,
  );

  const ticketExecutor = new AgentTicketExecutor(
    agentExecutor,
    branchManager,
    executorConfig,
    soulLoader,
    new DefaultAgentConfigResolver(),
  );

  // Wire MemoryUpdateHook so agents persist learnings to MEMORY.md
  const memoryFs = {
    readFile: (path: string) => fs.readFile(path, 'utf-8'),
    writeFile: (path: string, content: string) => fs.writeFile(path, content, 'utf-8'),
  };
  ticketExecutor.addPostExecutionHook(new MemoryUpdateHook(templatesDir, memoryFs));

  // Engine services
  const orchestrator = new Orchestrator(ticketRepo, ticketExecutor);
  const orchestratorScheduler = new OrchestratorScheduler(orchestrator, {
    pollIntervalMs: 10_000,
  });

  const verificationService = new VerificationService(ticketRepo, passthroughVerification);
  const reverseProposalService = new ProposalService(reverseProposalRepo);
  const proposalExecutor = new ProposalExecutor(proposalRepo, ticketRepo);
  const assignmentService = new AssignmentService(ticketRepo, agentRepo);
  const goalManager = new GoalManager(goalRepo, epicRepo, ticketRepo);
  const completionHandler = new CompletionHandler(
    ticketRepo,
    epicRepo,
    escalationRepo,
    verificationService,
    assignmentService,
    goalManager,
  );

  // Smart assignment
  const modelSelector = new ModelSelector(providerRegistry);
  const agentConfigurator = new AgentConfigurator(llmProvider, soulLoader, agentRepo);
  const smartAssignment = new SmartAssignmentService(
    agentRepo,
    ticketRepo,
    assignmentService,
    agentConfigurator,
    modelSelector,
    llmProvider,
  );

  // Heartbeat service
  const heartbeatService = new HeartbeatService(
    {
      goalRepo,
      ticketRepo,
      proposalRepo,
      reverseProposalRepo: reverseProposalRepo,
      activityLogRepo,
      heartbeatLogRepo,
    },
    { defaultIntervalMs: 60_000 },
  );

  // Wire everything together
  const deps: DaemonDeps = {
    heartbeatService,
    orchestrator,
    orchestratorScheduler,
    verificationService,
    proposalService: reverseProposalService,
    proposalExecutor,
    completionHandler,
    smartAssignment,
    proposalRepo,
    ticketRepo,
    eventBus,
  };

  const wiring = new DaemonWiring(deps);
  wiring.wire();

  return { wiring, started: false };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get (or create) the DaemonWiring singleton.
 * Survives Next.js hot-module reloads via globalThis.
 */
export function getDaemon(): DaemonWiring {
  if (!globalThis.__phalanx_daemon__) {
    globalThis.__phalanx_daemon__ = createDaemonWiring();
  }
  return globalThis.__phalanx_daemon__.wiring;
}

/**
 * Start the daemon (idempotent). Begins orchestrator scheduling, heartbeat,
 * and channel system (Telegram, Discord, Slack, Web).
 */
export function startDaemon(): void {
  const state = globalThis.__phalanx_daemon__ ?? (globalThis.__phalanx_daemon__ = createDaemonWiring());
  if (!state.started) {
    state.wiring.start();
    state.started = true;
    console.log('[phalanx] Daemon started — orchestrator scheduler and heartbeat active.');

    // Start channel system (async, non-blocking)
    void import('./channel-wiring').then(({ startChannels }) =>
      startChannels().catch((err) =>
        console.error('[phalanx] Channel system start failed:', err),
      ),
    );
  }
}

/**
 * Stop the daemon gracefully.
 */
export async function stopDaemon(): Promise<void> {
  const state = globalThis.__phalanx_daemon__;
  if (state?.started) {
    await state.wiring.stop();
    state.started = false;
    console.log('[phalanx] Daemon stopped.');
  }
}

/**
 * Whether the daemon is currently running.
 */
export function isDaemonRunning(): boolean {
  return globalThis.__phalanx_daemon__?.started ?? false;
}
