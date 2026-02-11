import { z } from 'zod';

// ---------------------------------------------------------------------------
// Thinking Level
// ---------------------------------------------------------------------------

export const ThinkingLevel = z.enum(['off', 'low', 'medium', 'high']);
export type ThinkingLevel = z.infer<typeof ThinkingLevel>;

// ---------------------------------------------------------------------------
// Model API Protocol Types
// Each provider uses a different wire protocol for the same semantic operations.
// ---------------------------------------------------------------------------

export type ModelApi =
  | 'anthropic-messages'
  | 'openai-chat'
  | 'openai-responses'
  | 'google-generative-ai'
  | 'ollama-chat';

// ---------------------------------------------------------------------------
// Model Definition — rich metadata per model
// ---------------------------------------------------------------------------

export interface ModelCost {
  /** Cost per 1M input tokens (USD) */
  input: number;
  /** Cost per 1M output tokens (USD) */
  output: number;
  /** Cost per 1M cached-read tokens (USD) */
  cacheRead: number;
  /** Cost per 1M cached-write tokens (USD) */
  cacheWrite: number;
}

export interface ModelCompatConfig {
  /** Whether the model supports extended thinking / reasoning */
  supportsThinking?: boolean;
  /** Whether the model supports tool use / function calling */
  supportsTools?: boolean;
  /** Whether the model supports image inputs */
  supportsImages?: boolean;
  /** Whether the model supports streaming */
  supportsStreaming?: boolean;
  /** For OpenAI reasoning models: use reasoning_effort instead of temperature */
  supportsReasoningEffort?: boolean;
  /** Which field name the model uses for max output tokens */
  maxTokensField?: 'max_tokens' | 'max_completion_tokens' | 'maxOutputTokens';
}

export interface ModelDefinition {
  /** Model ID as used by the provider (e.g., 'claude-sonnet-4-5-20250929') */
  id: string;
  /** Human-readable name */
  name: string;
  /** API protocol this model uses */
  api: ModelApi;
  /** Provider identifier */
  provider: string;
  /** Whether this is a reasoning model (o3, etc.) */
  reasoning: boolean;
  /** Supported input types */
  input: Array<'text' | 'image'>;
  /** Token pricing */
  cost: ModelCost;
  /** Context window size in tokens */
  contextWindow: number;
  /** Maximum output tokens */
  maxTokens: number;
  /** Per-model compatibility quirks */
  compat?: ModelCompatConfig;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: 'tool_result';
  toolUseId: string;
  /** Function name (needed for Gemini's functionResponse correlation) */
  name?: string;
  content: string;
  isError?: boolean;
}

export type MessageContent = TextContent | ToolUseContent | ToolResultContent;

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string | MessageContent[];
}

// ---------------------------------------------------------------------------
// Tool definitions (passed to LLM for function calling)
// ---------------------------------------------------------------------------

export interface ToolParameter {
  type: string;
  description?: string;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
}

// ---------------------------------------------------------------------------
// Chat params & results
// ---------------------------------------------------------------------------

export interface ChatParams {
  model: string;
  messages: Message[];
  systemPrompt?: string;
  thinkingLevel?: ThinkingLevel;
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
}

export interface ChatWithToolsParams extends ChatParams {
  tools: ToolDefinition[];
  toolChoice?: 'auto' | 'none' | { name: string };
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export interface ChatResult {
  content: string;
  stopReason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | 'error';
  usage: TokenUsage;
  model: string;
  thinkingContent?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolCallResult {
  content: string;
  toolCalls: ToolCall[];
  stopReason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | 'error';
  usage: TokenUsage;
  model: string;
  thinkingContent?: string;
}

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

export interface LLMProvider {
  /** Provider identifier (e.g., 'anthropic', 'openai') */
  readonly name: string;

  /** List of supported model IDs */
  readonly models: string[];

  /** Send a chat message and get a text response */
  chat(params: ChatParams): Promise<ChatResult>;

  /** Send a chat message with tool definitions and get tool calls back */
  chatWithTools(params: ChatWithToolsParams): Promise<ToolCallResult>;

  /**
   * Check if the provider is available for use.
   * For API-key-based providers: checks key existence (no network call).
   * For local providers (e.g. Ollama): may perform a lightweight network ping.
   */
  isAvailable(): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Provider configuration
// ---------------------------------------------------------------------------

export type ProviderAuthMode = 'api-key' | 'oauth' | 'token' | 'none';

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  maxRetries?: number;
  timeout?: number;
  /** Authentication mode for this provider */
  auth?: ProviderAuthMode;
  /** Custom headers to send with every request */
  headers?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Model resolution (5-step pipeline)
// ---------------------------------------------------------------------------

export type AgentMode = 'primary' | 'subagent' | 'all';

export interface ModelResolutionContext {
  /** Step 1: Ticket-level override */
  ticketModel?: string;
  /** Step 2: Agent config model */
  agentModel?: string;
  /** Step 3: Role-based default */
  roleDefault?: string;
  /** Step 4: Provider fallback chain */
  fallbackChain?: string[];
  /** Step 5: System default */
  systemDefault: string;
  /** Agent mode affects resolution behavior */
  agentMode?: AgentMode;
}

export interface ResolvedModel {
  provider: string;
  model: string;
  fullId: string;
  resolvedFrom: 'ticket' | 'agent' | 'role' | 'fallback' | 'system';
}

// ---------------------------------------------------------------------------
// Token tracking
// ---------------------------------------------------------------------------

export interface TokenUsageRecord {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  goalId?: string;
  ticketId?: string;
  agentId?: string;
  timestamp: Date;
}

export interface TokenUsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalThinkingTokens: number;
  estimatedCost: number;
  byProvider: Record<string, { input: number; output: number; thinking: number; cost: number }>;
  byModel: Record<string, { input: number; output: number; thinking: number; cost: number }>;
}

// ---------------------------------------------------------------------------
// Provider health (for fallback chain)
// ---------------------------------------------------------------------------

export type ProviderStatus = 'healthy' | 'degraded' | 'unavailable' | 'cooldown';

export interface ProviderHealth {
  provider: string;
  status: ProviderStatus;
  lastSuccess?: Date;
  lastFailure?: Date;
  consecutiveFailures: number;
  cooldownUntil?: Date;
  averageLatencyMs?: number;
}

// ---------------------------------------------------------------------------
// Failover types
// ---------------------------------------------------------------------------

export type FailoverReason =
  | 'auth'
  | 'billing'
  | 'rate_limit'
  | 'timeout'
  | 'format'
  | 'context_overflow'
  | 'unknown';

export interface FallbackAttempt {
  provider: string;
  model: string;
  error: string;
  reason: FailoverReason;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Model catalog entry (for model registry)
// ---------------------------------------------------------------------------

export interface ModelCatalogEntry extends ModelDefinition {
  /** Full ID in "provider/model" format */
  fullId: string;
}

// ---------------------------------------------------------------------------
// Provider factory (plugin pattern for extensible provider registration)
// ---------------------------------------------------------------------------

export interface ProviderFactory {
  /** Provider identifier (e.g., 'anthropic') */
  readonly name: string;
  /** Determine if this provider should be activated given config and env */
  shouldActivate(config: ProviderConfig, env: Record<string, string | undefined>): boolean;
  /** Create the provider instance with config and injected env */
  create(config: ProviderConfig, env: Record<string, string | undefined>): LLMProvider;
}

// ---------------------------------------------------------------------------
// Agent model requirements
// ---------------------------------------------------------------------------

/**
 * Agent-level model requirements for the agent orchestration layer.
 * Reserved for W2 (Agent Framework) — not consumed by W1 LLM layer.
 */
export interface AgentModelRequirement {
  /** Required provider (e.g., 'anthropic' for thinking support) */
  requiresProvider?: string;
  /** Required specific model */
  requiresModel?: string;
  /** Fallback chain if the primary model isn't available, with optional variants */
  fallbackChain?: Array<{ model: string; variant?: ThinkingLevel }>;
}
