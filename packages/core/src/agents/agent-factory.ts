import type { ModelResolutionContext, ThinkingLevel } from '../llm/types.js';
import type { ModelResolver } from '../llm/model-resolver.js';
import type { ProviderRegistry } from '../llm/provider-registry.js';
import type { TokenTracker } from '../llm/token-tracker.js';
import type { ToolRegistry } from '../tools/tool-registry.js';
import type { AgentToolPermissions } from '../tools/types.js';
import type { AgentConfig, AgentRole, AgentSoulConfig } from './types.js';
import { SoulLoader } from './soul-loader.js';
import { AgentExecutor } from './agent-executor.js';

// ---------------------------------------------------------------------------
// AgentFactory — assembles all dependencies into a runnable agent
// ---------------------------------------------------------------------------

export interface CreateAgentOptions {
  /** Agent role determines which soul templates to load */
  role: AgentRole;
  /** Optional agent ID override (auto-generated if not provided) */
  id?: string;
  /** Model resolution context for the 5-step pipeline */
  modelContext?: Partial<ModelResolutionContext>;
  /** Tool permissions for this agent */
  toolPermissions?: AgentToolPermissions;
  /** Maximum iterations before escalation (default: 25) */
  maxIterations?: number;
  /** Thinking level override */
  thinkingLevel?: ThinkingLevel;
  /** Temperature override */
  temperature?: number;
  /** Soul config override (bypasses template loading) */
  soulOverride?: Partial<AgentSoulConfig>;
}

export class AgentFactory {
  private soulLoader: SoulLoader;

  constructor(
    private modelResolver: ModelResolver,
    private providerRegistry: ProviderRegistry,
    private toolRegistry: ToolRegistry,
    private tokenTracker: TokenTracker,
    templatesDir: string,
  ) {
    this.soulLoader = new SoulLoader(templatesDir);
  }

  /**
   * Create an AgentExecutor and its configuration from the given options.
   *
   * Assembly order:
   *   1. Load soul templates for the role
   *   2. Resolve model via 5-step pipeline
   *   3. Look up LLMProvider
   *   4. Create AgentExecutor with provider + tool registry + token tracker
   */
  create(options: CreateAgentOptions): { executor: AgentExecutor; config: AgentConfig } {
    // 1. Load soul
    const baseSoul = this.soulLoader.load(options.role);
    const soul: AgentSoulConfig = {
      soul: options.soulOverride?.soul ?? baseSoul.soul,
      identity: options.soulOverride?.identity ?? baseSoul.identity,
      memory: options.soulOverride?.memory ?? baseSoul.memory,
      skills: options.soulOverride?.skills ?? baseSoul.skills,
    };

    // 2. Resolve model
    const modelContext: ModelResolutionContext = {
      systemDefault: 'anthropic/claude-sonnet-4-5-20250929',
      ...options.modelContext,
    };
    const resolvedModel = this.modelResolver.resolve(modelContext);

    // 3. Look up provider
    const provider = this.providerRegistry.get(resolvedModel.provider);
    if (!provider) {
      throw new Error(
        `Provider '${resolvedModel.provider}' not found in registry. ` +
        `Resolved model: ${resolvedModel.fullId}`,
      );
    }

    // 4. Build config
    const config: AgentConfig = {
      id: options.id ?? `${options.role}-${Date.now()}`,
      role: options.role,
      soul,
      model: resolvedModel,
      tools: options.toolPermissions ?? {},
      maxIterations: options.maxIterations ?? 25,
      thinkingLevel: options.thinkingLevel,
      temperature: options.temperature,
    };

    // 5. Create executor
    const executor = new AgentExecutor(provider, this.toolRegistry, this.tokenTracker);

    return { executor, config };
  }
}
