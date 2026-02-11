import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMProvider,
  ChatParams,
  ChatResult,
  ChatWithToolsParams,
  ToolCallResult,
  ToolCall,
  TokenUsage,
  ProviderConfig,
  Message,
} from '../types.js';
import { effectiveThinkingLevel, resolveAnthropicThinking } from '../thinking-level.js';

// ---------------------------------------------------------------------------
// Anthropic message conversion
// ---------------------------------------------------------------------------

function toAnthropicMessages(
  messages: Message[],
): Anthropic.MessageCreateParams['messages'] {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      if (typeof m.content === 'string') {
        return { role: m.role as 'user' | 'assistant', content: m.content };
      }

      const blocks: Anthropic.ContentBlockParam[] = m.content.map((c) => {
        switch (c.type) {
          case 'text':
            return { type: 'text' as const, text: c.text };
          case 'tool_use':
            return {
              type: 'tool_use' as const,
              id: c.id,
              name: c.name,
              input: c.input,
            };
          case 'tool_result':
            return {
              type: 'tool_result' as const,
              tool_use_id: c.toolUseId,
              content: c.content,
              is_error: c.isError,
            };
          default:
            return { type: 'text' as const, text: '' };
        }
      });

      return { role: m.role as 'user' | 'assistant', content: blocks };
    });
}

function toAnthropicTools(
  tools: ChatWithToolsParams['tools'],
): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: {
      type: 'object' as const,
      properties: t.parameters.properties as Record<string, Anthropic.Tool.InputSchema>,
      required: t.parameters.required,
    },
  }));
}

function extractUsage(response: Anthropic.Message): TokenUsage {
  return {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: (response.usage as Record<string, number>).cache_read_input_tokens,
    cacheWriteTokens: (response.usage as Record<string, number>).cache_creation_input_tokens,
  };
}

// ---------------------------------------------------------------------------
// AnthropicProvider
// ---------------------------------------------------------------------------

export const ANTHROPIC_MODELS = [
  'claude-opus-4-6-20250414',
  'claude-sonnet-4-5-20250929',
  'claude-haiku-4-5-20251001',
] as const;

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  readonly models: string[] = [...ANTHROPIC_MODELS];

  private client: Anthropic;
  private config: ProviderConfig;

  constructor(config: ProviderConfig = {}) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
      baseURL: config.baseUrl,
      maxRetries: config.maxRetries ?? 2,
      timeout: config.timeout ?? 120_000,
    });
  }

  async chat(params: ChatParams): Promise<ChatResult> {
    const thinkingLevel = effectiveThinkingLevel(params.thinkingLevel, params.model);
    const thinkingConfig = resolveAnthropicThinking(thinkingLevel);

    const requestParams: Anthropic.MessageCreateParams = {
      model: params.model,
      messages: toAnthropicMessages(params.messages),
      max_tokens: params.maxTokens ?? 4096,
      ...(params.systemPrompt && { system: params.systemPrompt }),
      ...(params.temperature !== undefined && { temperature: params.temperature }),
      ...(params.stopSequences && { stop_sequences: params.stopSequences }),
    };

    // Add thinking config if enabled
    if (thinkingConfig.type === 'enabled' && thinkingConfig.budgetTokens) {
      (requestParams as Record<string, unknown>).thinking = {
        type: 'enabled',
        budget_tokens: thinkingConfig.budgetTokens,
      };
      // Anthropic requires max_tokens to be larger than budget_tokens when thinking
      requestParams.max_tokens = Math.max(
        requestParams.max_tokens,
        thinkingConfig.budgetTokens + 4096,
      );
      // Temperature must be 1 when thinking is enabled
      delete (requestParams as Record<string, unknown>).temperature;
    }

    const response = await this.client.messages.create(requestParams);

    // Extract text and thinking content
    let textContent = '';
    let thinkingContent = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        textContent += block.text;
      } else if (block.type === 'thinking') {
        thinkingContent += (block as Record<string, string>).thinking;
      }
    }

    return {
      content: textContent,
      stopReason: mapStopReason(response.stop_reason),
      usage: extractUsage(response),
      model: response.model,
      thinkingContent: thinkingContent || undefined,
    };
  }

  async chatWithTools(params: ChatWithToolsParams): Promise<ToolCallResult> {
    const thinkingLevel = effectiveThinkingLevel(params.thinkingLevel, params.model);
    const thinkingConfig = resolveAnthropicThinking(thinkingLevel);

    const requestParams: Anthropic.MessageCreateParams = {
      model: params.model,
      messages: toAnthropicMessages(params.messages),
      max_tokens: params.maxTokens ?? 4096,
      tools: toAnthropicTools(params.tools),
      ...(params.systemPrompt && { system: params.systemPrompt }),
      ...(params.temperature !== undefined && { temperature: params.temperature }),
      ...(params.stopSequences && { stop_sequences: params.stopSequences }),
    };

    if (params.toolChoice) {
      if (params.toolChoice === 'auto') {
        requestParams.tool_choice = { type: 'auto' };
      } else if (params.toolChoice === 'none') {
        // Anthropic doesn't support 'none' — omit tools instead
        delete (requestParams as Record<string, unknown>).tools;
      } else {
        requestParams.tool_choice = { type: 'tool', name: params.toolChoice.name };
      }
    }

    if (thinkingConfig.type === 'enabled' && thinkingConfig.budgetTokens) {
      (requestParams as Record<string, unknown>).thinking = {
        type: 'enabled',
        budget_tokens: thinkingConfig.budgetTokens,
      };
      requestParams.max_tokens = Math.max(
        requestParams.max_tokens,
        thinkingConfig.budgetTokens + 4096,
      );
      delete (requestParams as Record<string, unknown>).temperature;
    }

    const response = await this.client.messages.create(requestParams);

    let textContent = '';
    let thinkingContent = '';
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        textContent += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      } else if (block.type === 'thinking') {
        thinkingContent += (block as Record<string, string>).thinking;
      }
    }

    return {
      content: textContent,
      toolCalls,
      stopReason: mapStopReason(response.stop_reason),
      usage: extractUsage(response),
      model: response.model,
      thinkingContent: thinkingContent || undefined,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const key = this.config.apiKey || process.env.ANTHROPIC_API_KEY;
      return !!key;
    } catch {
      return false;
    }
  }
}

function mapStopReason(
  reason: string | null,
): ChatResult['stopReason'] {
  switch (reason) {
    case 'end_turn':
      return 'end_turn';
    case 'max_tokens':
      return 'max_tokens';
    case 'stop_sequence':
      return 'stop_sequence';
    case 'tool_use':
      return 'tool_use';
    default:
      return 'end_turn';
  }
}
