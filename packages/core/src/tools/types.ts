import { z } from 'zod';

// ---------------------------------------------------------------------------
// Tool Categories
// ---------------------------------------------------------------------------

export const ToolCategory = z.enum([
  'filesystem',
  'git',
  'terminal',
  'github',
  'analysis',
  'database',
]);
export type ToolCategory = z.infer<typeof ToolCategory>;

// ---------------------------------------------------------------------------
// Tool Result
// ---------------------------------------------------------------------------

export interface ToolResult {
  /** Whether the tool executed successfully */
  success: boolean;
  /** Output content (text response for LLM consumption) */
  content: string;
  /** Error message when success is false */
  error?: string;
}

// ---------------------------------------------------------------------------
// Tool Execution Context
// ---------------------------------------------------------------------------

export interface ToolExecutionContext {
  /** ID of the agent executing this tool */
  agentId: string;
  /** Working directory for relative path resolution */
  workingDirectory: string;
  /** Execution timeout in milliseconds */
  timeout?: number;
}

// ---------------------------------------------------------------------------
// Tool Interface
// ---------------------------------------------------------------------------

/**
 * Unified tool interface with Zod parameter validation.
 *
 * Each tool declares its parameters as a Zod raw shape (plain object of
 * z.ZodType values). The shape is wrapped in z.object() at validation time
 * by the registry, and converted to JSON Schema for LLM function calling
 * via zodToToolDefinition().
 *
 * @template TSchema - A Zod raw shape describing the tool's parameters
 */
export interface Tool<TSchema extends z.ZodRawShape = z.ZodRawShape> {
  /** Unique tool name (e.g., 'file_read') */
  readonly name: string;
  /** Human-readable description for the LLM */
  readonly description: string;
  /** Tool category for permission filtering */
  readonly category: ToolCategory;
  /** Zod raw shape defining accepted parameters */
  readonly schema: TSchema;
  /**
   * Execute the tool with validated parameters.
   * Implementations must NOT throw — return ToolResult with success: false instead.
   */
  execute(
    params: z.infer<z.ZodObject<TSchema>>,
    context: ToolExecutionContext,
  ): Promise<ToolResult>;
}

// ---------------------------------------------------------------------------
// Tool Permission
// ---------------------------------------------------------------------------

/**
 * Per-agent tool access control.
 *
 * Resolution order (deny-always-wins):
 *   1. denylist — always denied, overrides everything
 *   2. categoryDenylist — deny all tools in these categories
 *   3. allowlist — if set, ONLY these tools are available
 *   4. default — all registered tools are available
 */
export interface AgentToolPermissions {
  /** If set, only these tool names are available (exclusive allowlist) */
  allowlist?: string[];
  /** Always denied — overrides allowlist */
  denylist?: string[];
  /** Deny all tools in these categories */
  categoryDenylist?: ToolCategory[];
}
