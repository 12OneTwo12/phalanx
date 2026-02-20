import { z } from 'zod';
import type {
  LLMProvider,
  ToolCallResult,
  Message,
  MessageContent,
  ToolUseContent,
  ToolResultContent,
  TextContent,
  TokenUsage,
} from '../llm/types.js';
import type { ToolRegistry } from '../tools/tool-registry.js';
import type { ToolExecutionContext } from '../tools/types.js';
import { zodToToolDefinition } from '../tools/tool-schema.js';
import type { TokenTracker } from '../llm/token-tracker.js';
import type { AgentConfig, AgentExecutionResult, AgentStatus } from './types.js';
import { IterationGuard } from './iteration-guard.js';
import { formatToolError, shouldEscalate, isRetryableError } from './error-recovery.js';

// ---------------------------------------------------------------------------
// AgentExecutor — the core agent execution loop
// ---------------------------------------------------------------------------

/** Maximum number of retries for transient LLM errors */
const MAX_LLM_RETRIES = 2;

export class AgentExecutor {
  constructor(
    private provider: LLMProvider,
    private toolRegistry: ToolRegistry,
    private tokenTracker?: TokenTracker,
  ) {}

  /**
   * Run an agent to completion.
   *
   * Execution loop: system prompt → LLM chatWithTools → tool execution → feedback → repeat
   * Continues until:
   *   - LLM returns end_turn / stop_sequence (completed)
   *   - Max iterations reached (escalated)
   *   - Unrecoverable error (error)
   */
  async run(config: AgentConfig, task: string): Promise<AgentExecutionResult> {
    const guard = new IterationGuard({
      maxIterations: config.maxIterations,
      warningThreshold: Math.floor(config.maxIterations * 0.8),
    });

    // Resolve available tools for this agent
    const availableTools = this.toolRegistry.getForAgent(config.tools);
    const toolDefinitions = availableTools.map(zodToToolDefinition);

    // Build system prompt from soul config
    const systemPrompt = this.buildSystemPrompt(config);

    // Initialize conversation
    const messages: Message[] = [{ role: 'user', content: task }];

    const totalUsage: TokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
    };
    let iterations = 0;
    let toolCallCount = 0;
    let consecutiveToolErrors = 0;

    while (true) {
      iterations++;

      // Check iteration limit
      const guardResult = guard.check(iterations);
      if (guardResult === 'exceeded') {
        return this.buildResult(
          'escalated',
          guard.getExceededMessage(),
          messages,
          iterations,
          totalUsage,
          toolCallCount,
        );
      }

      // Inject warning message when approaching limit
      if (guardResult === 'warning' && iterations === guard.warningThreshold) {
        messages.push({
          role: 'user',
          content: guard.getWarningMessage(iterations),
        });
      }

      // Call LLM with retry for transient errors
      let result: ToolCallResult | undefined;
      let lastError: unknown;

      for (let attempt = 0; attempt <= MAX_LLM_RETRIES; attempt++) {
        try {
          result = await this.provider.chatWithTools({
            model: config.model.model,
            messages,
            systemPrompt,
            tools: toolDefinitions,
            thinkingLevel: config.thinkingLevel,
            maxTokens: 4096,
            temperature: config.temperature,
          });
          break;
        } catch (error) {
          lastError = error;
          if (attempt < MAX_LLM_RETRIES && isRetryableError(error)) {
            continue;
          }
          break;
        }
      }

      if (!result) {
        return this.buildResult(
          'error',
          '',
          messages,
          iterations,
          totalUsage,
          toolCallCount,
          lastError instanceof Error ? lastError.message : String(lastError),
        );
      }

      // Accumulate token usage
      this.accumulateUsage(totalUsage, result.usage);
      this.recordUsage(config, result);

      // Handle tool_use stop reason
      if (result.stopReason === 'tool_use' && result.toolCalls.length > 0) {
        // Append assistant message with tool calls
        const assistantContent: MessageContent[] = [];
        if (result.content) {
          assistantContent.push({ type: 'text', text: result.content } as TextContent);
        }
        for (const tc of result.toolCalls) {
          assistantContent.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.input,
            ...(tc.thoughtSignature && { thoughtSignature: tc.thoughtSignature }),
          } as ToolUseContent);
        }
        messages.push({ role: 'assistant', content: assistantContent });

        // Execute each tool call
        const toolResults: MessageContent[] = [];
        for (const toolCall of result.toolCalls) {
          toolCallCount++;
          const toolResult = await this.executeTool(
            toolCall.id,
            toolCall.name,
            toolCall.input,
            config,
          );
          toolResults.push(toolResult);

          // Track consecutive errors for escalation
          if (toolResult.isError) {
            consecutiveToolErrors++;
            if (shouldEscalate(consecutiveToolErrors)) {
              return this.buildResult(
                'escalated',
                `Tool execution failed ${consecutiveToolErrors} times consecutively. Escalating.`,
                messages,
                iterations,
                totalUsage,
                toolCallCount,
              );
            }
          } else {
            consecutiveToolErrors = 0;
          }
        }

        // Append tool results as user message
        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      // Handle end_turn — agent is done
      if (result.stopReason === 'end_turn' || result.stopReason === 'stop_sequence') {
        return this.buildResult(
          'completed',
          result.content,
          messages,
          iterations,
          totalUsage,
          toolCallCount,
        );
      }

      // Handle max_tokens — output was truncated, ask to continue
      if (result.stopReason === 'max_tokens') {
        messages.push({ role: 'assistant', content: result.content });
        messages.push({ role: 'user', content: 'Please continue from where you left off.' });
        continue;
      }

      // Handle error stop reason
      if (result.stopReason === 'error') {
        return this.buildResult(
          'error',
          result.content,
          messages,
          iterations,
          totalUsage,
          toolCallCount,
          'LLM returned error stop reason',
        );
      }

      // Unknown stop reason — treat as completed
      return this.buildResult(
        'completed',
        result.content,
        messages,
        iterations,
        totalUsage,
        toolCallCount,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private buildSystemPrompt(config: AgentConfig): string {
    const sections: string[] = [];

    if (config.soul.soul) {
      sections.push(`# Soul\n\n${config.soul.soul}`);
    }
    if (config.soul.identity) {
      sections.push(`# Identity\n\n${config.soul.identity}`);
    }
    if (config.soul.skills) {
      sections.push(`# Skills\n\n${config.soul.skills}`);
    }
    if (config.soul.memory) {
      sections.push(`# Memory\n\n${config.soul.memory}`);
    }
    if (config.conventions) {
      sections.push(`# Project Conventions\n\n${config.conventions}`);
    }
    if (config.skillsContent) {
      sections.push(config.skillsContent);
    }

    return sections.join('\n\n---\n\n');
  }

  private async executeTool(
    toolCallId: string,
    toolName: string,
    input: Record<string, unknown>,
    config: AgentConfig,
  ): Promise<ToolResultContent> {
    const tool = this.toolRegistry.get(toolName);

    if (!tool) {
      return {
        type: 'tool_result',
        toolUseId: toolCallId,
        name: toolName,
        content: `Unknown tool: '${toolName}'. Available tools: ${this.toolRegistry.getForAgent(config.tools).map((t) => t.name).join(', ')}`,
        isError: true,
      };
    }

    // Validate parameters with Zod
    const schemaObj = z.object(tool.schema);
    const parseResult = schemaObj.safeParse(input);

    if (!parseResult.success) {
      const errorMessages = parseResult.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      return {
        type: 'tool_result',
        toolUseId: toolCallId,
        name: toolName,
        content: `Invalid parameters for '${toolName}': ${errorMessages}`,
        isError: true,
      };
    }

    // Execute the tool
    const context: ToolExecutionContext = {
      agentId: config.id,
      workingDirectory: config.workingDirectory,
      timeout: 120_000,
      ticketId: config.ticketId,
    };

    try {
      const toolResult = await tool.execute(parseResult.data, context);
      return {
        type: 'tool_result',
        toolUseId: toolCallId,
        name: toolName,
        content: toolResult.success ? toolResult.content : formatToolError(toolResult.error ?? 'Unknown error', toolName),
        isError: !toolResult.success,
      };
    } catch (error) {
      return {
        type: 'tool_result',
        toolUseId: toolCallId,
        name: toolName,
        content: formatToolError(error, toolName),
        isError: true,
      };
    }
  }

  private accumulateUsage(total: TokenUsage, delta: TokenUsage): void {
    total.inputTokens += delta.inputTokens;
    total.outputTokens += delta.outputTokens;
    if (delta.thinkingTokens) {
      total.thinkingTokens = (total.thinkingTokens ?? 0) + delta.thinkingTokens;
    }
    if (delta.cacheReadTokens) {
      total.cacheReadTokens = (total.cacheReadTokens ?? 0) + delta.cacheReadTokens;
    }
    if (delta.cacheWriteTokens) {
      total.cacheWriteTokens = (total.cacheWriteTokens ?? 0) + delta.cacheWriteTokens;
    }
  }

  private recordUsage(config: AgentConfig, result: ToolCallResult): void {
    this.tokenTracker?.record({
      provider: config.model.provider,
      model: config.model.model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      thinkingTokens: result.usage.thinkingTokens,
      cacheReadTokens: result.usage.cacheReadTokens,
      cacheWriteTokens: result.usage.cacheWriteTokens,
      agentId: config.id,
      timestamp: new Date(),
    });
  }

  private buildResult(
    status: AgentStatus,
    finalContent: string,
    conversationHistory: Message[],
    iterations: number,
    totalUsage: TokenUsage,
    toolCallCount: number,
    error?: string,
  ): AgentExecutionResult {
    return {
      status,
      finalContent,
      conversationHistory,
      iterations,
      totalUsage,
      toolCallCount,
      error,
    };
  }
}
