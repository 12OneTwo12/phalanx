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
  AutoCommenter,
  WorkLogRecorder,
  createTicketCommentTool,
  createTicketReadCommentsTool,
  createMemoryReadTool,
  createMemoryWriteTool,
  MeetingOrchestrator,
  DebateOrchestrator,
  DiscussionService,
  ApprovalService,
  PRController,
  type PRMode,
  createRequestDiscussionTool,
  createReadDiscussionsTool,
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
  getTicketCommentRepository,
  getWorkLogRepository,
  getMeetingRepository,
  getMeetingParticipantRepository,
  getDebateRepository,
  getDebateArgumentRepository,
  getExecutionTraceRepository,
  getProviderConfigRepository,
} from './db';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { eventBus } from './event-bus';
import { getLLMProvider } from './llm-provider';
import { findProjectRoot } from './convention-sync';

// ---------------------------------------------------------------------------
// globalThis guard for HMR
// ---------------------------------------------------------------------------

interface DaemonState {
  wiring: DaemonWiring;
  started: boolean;
  meetingOrchestrator: InstanceType<typeof MeetingOrchestrator>;
  debateOrchestrator: InstanceType<typeof DebateOrchestrator>;
  prController: PRController;
  approvalService: ApprovalService;
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
// Config helpers
// ---------------------------------------------------------------------------

interface TeamModeConfig {
  mode: 'lean' | 'smart' | 'debate';
  smartThreshold: string;
  agentsPerRole: number;
}

function loadTeamModeConfig(): TeamModeConfig {
  try {
    const projectRoot = process.env.PHALANX_PROJECT_ROOT ?? findProjectRoot(process.cwd());
    const configPath = resolve(projectRoot, '.phalanx', 'config.json');
    if (!existsSync(configPath)) return { mode: 'lean', smartThreshold: 'high', agentsPerRole: 2 };
    const config = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    const daemon = (config.daemon ?? {}) as Record<string, unknown>;
    const tm = (daemon.teamMode ?? {}) as Record<string, unknown>;
    return {
      mode: (tm.mode as TeamModeConfig['mode']) ?? 'lean',
      smartThreshold: (tm.smartThreshold as string) ?? 'high',
      agentsPerRole: (tm.agentsPerRole as number) ?? 3,
    };
  } catch {
    return { mode: 'lean', smartThreshold: 'high', agentsPerRole: 2 };
  }
}

// ---------------------------------------------------------------------------
// Auto-register active providers in DB
// ---------------------------------------------------------------------------

/**
 * Ensure active LLM providers (from credentials + env vars) are registered
 * in the provider_configs table so the Settings page can display them.
 */
function syncProvidersToDb(): void {
  try {
    const providerConfigRepo = getProviderConfigRepository();
    const existing = providerConfigRepo.findAll();
    const existingTypes = new Set(existing.map((p) => p.type));

    // Check credential store
    const credFile = resolve(homedir(), '.phalanx', 'credentials.json');
    const credentials: Record<string, { secret: string; authMode?: string }> = {};
    if (existsSync(credFile)) {
      try {
        Object.assign(credentials, JSON.parse(readFileSync(credFile, 'utf-8')));
      } catch { /* ignore parse errors */ }
    }

    // Check env vars
    const envKeyMap: Record<string, string> = {
      anthropic: 'ANTHROPIC_API_KEY',
      openai: 'OPENAI_API_KEY',
      gemini: 'GOOGLE_API_KEY',
    };

    const providerNames: Record<string, string> = {
      anthropic: 'Anthropic',
      openai: 'OpenAI',
      gemini: 'Google Gemini',
      ollama: 'Ollama',
    };

    const defaultModels: Record<string, string> = {
      anthropic: 'claude-sonnet-4-5-20250929',
      openai: 'gpt-4o',
      gemini: 'gemini-2.0-flash',
    };

    // Register providers from credential store
    for (const providerType of Object.keys(credentials)) {
      if (!existingTypes.has(providerType as 'anthropic' | 'openai' | 'ollama' | 'gemini' | 'custom')) continue;
      // Already registered — skip
    }

    // Register providers that have credentials but aren't in DB
    for (const providerType of Object.keys(credentials)) {
      const typedType = providerType as 'anthropic' | 'openai' | 'ollama' | 'gemini' | 'custom';
      if (existingTypes.has(typedType)) continue;
      providerConfigRepo.create({
        id: randomUUID(),
        type: typedType,
        name: providerNames[providerType] ?? providerType,
        enabled: true,
        defaultModel: defaultModels[providerType] ?? null,
      });
      existingTypes.add(typedType);
      console.log(`[phalanx] Auto-registered provider: ${providerType}`);
    }

    // Register providers from env vars
    for (const [providerType, envVar] of Object.entries(envKeyMap)) {
      const typedType = providerType as 'anthropic' | 'openai' | 'ollama' | 'gemini' | 'custom';
      if (existingTypes.has(typedType)) continue;
      if (!process.env[envVar]) continue;
      providerConfigRepo.create({
        id: randomUUID(),
        type: typedType,
        name: providerNames[providerType] ?? providerType,
        enabled: true,
        defaultModel: defaultModels[providerType] ?? null,
      });
      existingTypes.add(typedType);
      console.log(`[phalanx] Auto-registered provider from env: ${providerType}`);
    }
  } catch (err) {
    console.warn('[phalanx] Failed to sync providers to DB:', err);
  }
}

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

  // Auto-register active providers in DB so Settings page can show them
  syncProvidersToDb();

  // Provider registry for model selector
  const { registry: providerRegistry } = createLLMStack();
  providerRegistry.register(llmProvider);

  // Core services
  const soulLoader = new SoulLoader(templatesDir);
  const toolRegistry = new ToolRegistry();
  for (const tool of BUILTIN_TOOLS) {
    toolRegistry.register(tool);
  }
  // Register ticket tools so agents can read/write comments on their tickets
  const commentRepo = getTicketCommentRepository();
  toolRegistry.register(createTicketCommentTool(commentRepo));
  toolRegistry.register(createTicketReadCommentsTool(commentRepo));

  // Register memory tools so agents can read/write their personal MEMORY.md
  const agentsDir = `${projectRoot}/agents`;
  const memoryFs = {
    readFile: (path: string) => fs.readFile(path, 'utf-8'),
    writeFile: async (path: string, content: string) => {
      const dir = path.substring(0, path.lastIndexOf('/'));
      if (dir) await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path, content, 'utf-8');
    },
    ensureDir: (path: string) => fs.mkdir(path, { recursive: true }).then(() => {}),
  };
  toolRegistry.register(createMemoryReadTool(agentsDir, memoryFs));
  toolRegistry.register(createMemoryWriteTool(agentsDir, memoryFs));

  const agentExecutor = new AgentExecutor(llmProvider, toolRegistry);

  const branchManager = new BranchManager(noopGitOps);

  // Load team mode config early — needed for tool allowlist and executor config
  const teamModeConfig = loadTeamModeConfig();

  const toolAllowlist = [
    'file_read', 'file_write', 'file_edit',
    'terminal_exec',
    'git_status', 'git_diff', 'git_commit',
    'ticket_comment', 'ticket_read_comments',
    'memory_read', 'memory_write',
  ];
  if (teamModeConfig.mode !== 'lean') {
    toolAllowlist.push('request_discussion', 'read_discussions');
  }

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
        allowlist: toolAllowlist,
        denylist: [],
      },
      workingDirectory: projectRoot,
      maxIterations: 20,
      baseBranch: 'main',
      teamMode: teamModeConfig.mode,
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

  // Wire execution trace persistence
  ticketExecutor.setExecutionTraceRepo(getExecutionTraceRepository());

  // Wire MemoryUpdateHook so agents persist learnings to MEMORY.md
  ticketExecutor.addPostExecutionHook(new MemoryUpdateHook(templatesDir, memoryFs, agentsDir));

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
    { maxAgentsPerRole: teamModeConfig.agentsPerRole },
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

  // ApprovalService for manual and auto-approve flows
  const approvalService = new ApprovalService(ticketRepo);

  // AutoCommenter for lifecycle comments on tickets
  const autoCommenter = new AutoCommenter(getTicketCommentRepository());
  const workLogRecorder = new WorkLogRecorder(getWorkLogRepository());

  // Meeting & Debate orchestrators
  const meetingOrchestrator = new MeetingOrchestrator({
    meetingRepo: getMeetingRepository(),
    participantRepo: getMeetingParticipantRepository(),
  });
  const debateOrchestrator = new DebateOrchestrator({
    debateRepo: getDebateRepository(),
    debateArgRepo: getDebateArgumentRepository(),
  });

  // Discussion service — team discussions initiated by agents during execution
  const discussionService = new DiscussionService({
    debateOrchestrator,
    providerRegistry,
    agentRepo,
    ticketRepo,
  });

  // Register discussion tools if team mode allows discussions
  if (teamModeConfig.mode !== 'lean') {
    toolRegistry.register(createRequestDiscussionTool(discussionService));
    toolRegistry.register(createReadDiscussionsTool(debateOrchestrator, ticketRepo));
  }

  // PR controller — reads initial mode from environment
  const prController = new PRController(
    (process.env.PHALANX_PR_MODE as PRMode) ?? 'manual',
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
    autoCommenter,
    workLogRecorder,
    meetingOrchestrator,
    debateOrchestrator,
    eventBus,
    approvalService,
    getApprovalMode: () => {
      // Read approval mode from config file (synced with Settings UI), fallback to env var
      try {
        const configPath = resolve(projectRoot, '.phalanx', 'config.json');
        if (existsSync(configPath)) {
          const config = JSON.parse(readFileSync(configPath, 'utf-8'));
          const mode = config?.daemon?.approval?.mode;
          if (mode === 'auto' || mode === 'manual') return mode;
        }
      } catch { /* fall through to env var */ }
      return (process.env.PHALANX_APPROVAL_MODE as 'manual' | 'auto') ?? 'manual';
    },
  };

  const wiring = new DaemonWiring(deps);
  wiring.wire();

  return { wiring, started: false, meetingOrchestrator, debateOrchestrator, prController, approvalService };
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

/**
 * Get the MeetingOrchestrator instance (creates daemon if needed).
 */
export function getMeetingOrchestrator(): InstanceType<typeof MeetingOrchestrator> {
  const state = globalThis.__phalanx_daemon__ ?? (globalThis.__phalanx_daemon__ = createDaemonWiring());
  return state.meetingOrchestrator;
}

/**
 * Get the DebateOrchestrator instance (creates daemon if needed).
 */
export function getDebateOrchestrator(): InstanceType<typeof DebateOrchestrator> {
  const state = globalThis.__phalanx_daemon__ ?? (globalThis.__phalanx_daemon__ = createDaemonWiring());
  return state.debateOrchestrator;
}

/**
 * Get the PRController instance (creates daemon if needed).
 * Used by config API to update PR mode at runtime via setMode().
 */
export function getPRController(): PRController {
  const state = globalThis.__phalanx_daemon__ ?? (globalThis.__phalanx_daemon__ = createDaemonWiring());
  return state.prController;
}

/**
 * Get the ApprovalService instance (creates daemon if needed).
 * Used by approval API and config API.
 */
export function getApprovalService(): ApprovalService {
  const state = globalThis.__phalanx_daemon__ ?? (globalThis.__phalanx_daemon__ = createDaemonWiring());
  return state.approvalService;
}
