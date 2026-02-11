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
  ProviderFactory,
  Message,
} from '../types.js';
import { MODEL_CATALOG } from '../model-catalog.js';
import type { AnthropicThinkingConfig } from '../thinking-level.js';
import { effectiveThinkingLevel, resolveAnthropicThinking } from '../thinking-level.js';

// ---------------------------------------------------------------------------
// Request/response helpers (extracted to reduce chat/chatWithTools duplication)
// ---------------------------------------------------------------------------

function applyThinkingConfig(
  params: Anthropic.MessageCreateParams,
  config: AnthropicThinkingConfig,
): void {
  if (config.type !== 'enabled' || !config.budgetTokens) return;
  Object.assign(params, {
    thinking: { type: 'enabled', budget_tokens: config.budgetTokens },
  });
  params.max_tokens = Math.max(params.max_tokens, config.budgetTokens + 4096);
  delete params.temperature;
}

function extractUsage(response: Anthropic.Message): TokenUsage {
  return {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? undefined,
    cacheWriteTokens: response.usage.cache_creation_input_tokens ?? undefined,
  };
}

function extractContent(response: Anthropic.Message): {
  text: string;
  thinking: string;
  toolCalls: ToolCall[];
} {
  let text = '';
  let thinking = '';
  const toolCalls: ToolCall[] = [];

  for (const block of response.content) {
    if (block.type === 'text') {
      text += block.text;
    } else if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id,
        name: block.name,
        input: block.input as Record<string, unknown>,
      });
    } else if (block.type === 'thinking') {
      thinking += block.thinking;
    }
  }

  return { text, thinking, toolCalls };
}

// ---------------------------------------------------------------------------
// Anthropic message conversion
// ---------------------------------------------------------------------------

export function toAnthropicMessages(
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
          default: {
            const _exhaustiveCheck: never = c;
            throw new Error(`Unhandled content type: ${(_exhaustiveCheck as { type: string }).type}`);
          }
        }
      });

      return { role: m.role as 'user' | 'assistant', content: blocks };
    });
}

export function toAnthropicTools(
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

// ---------------------------------------------------------------------------
// AnthropicProvider
// ---------------------------------------------------------------------------

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';

  get models(): string[] {
    return MODEL_CATALOG.filter((e) => e.provider === 'anthropic').map((e) => e.id);
  }

  private client: Anthropic;
  private apiKey: string;

  constructor(
    config: ProviderConfig = {},
    env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
  ) {
    this.apiKey = config.apiKey ?? env.ANTHROPIC_API_KEY ?? '';
    this.client = new Anthropic({
      apiKey: this.apiKey || undefined,
      baseURL: config.baseUrl,
      maxRetries: config.maxRetries ?? 2,
      timeout: config.timeout ?? 120_000,
    });
  }

  async chat(params: ChatParams): Promise<ChatResult> {
    const thinkingConfig = resolveAnthropicThinking(
      effectiveThinkingLevel(params.thinkingLevel, params.model),
    );

    const requestParams: Anthropic.MessageCreateParams = {
      model: params.model,
      messages: toAnthropicMessages(params.messages),
      max_tokens: params.maxTokens ?? 4096,
      ...(params.systemPrompt && { system: params.systemPrompt }),
      ...(params.temperature !== undefined && { temperature: params.temperature }),
      ...(params.stopSequences && { stop_sequences: params.stopSequences }),
    };

    applyThinkingConfig(requestParams, thinkingConfig);

    const response = await this.client.messages.create(requestParams);
    const { text, thinking } = extractContent(response);

    return {
      content: text,
      stopReason: mapStopReason(response.stop_reason),
      usage: extractUsage(response),
      model: response.model,
      thinkingContent: thinking || undefined,
    };
  }

  async chatWithTools(params: ChatWithToolsParams): Promise<ToolCallResult> {
    const thinkingConfig = resolveAnthropicThinking(
      effectiveThinkingLevel(params.thinkingLevel, params.model),
    );

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
        delete (requestParams as { tools?: unknown }).tools;
      } else {
        requestParams.tool_choice = { type: 'tool', name: params.toolChoice.name };
      }
    }

    applyThinkingConfig(requestParams, thinkingConfig);

    const response = await this.client.messages.create(requestParams);
    const { text, thinking, toolCalls } = extractContent(response);

    return {
      content: text,
      toolCalls,
      stopReason: mapStopReason(response.stop_reason),
      usage: extractUsage(response),
      model: response.model,
      thinkingContent: thinking || undefined,
    };
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
}

export const anthropicProviderFactory: ProviderFactory = {
  name: 'anthropic',
  shouldActivate: (config, env) => !!(config.apiKey ?? env.ANTHROPIC_API_KEY),
  create: (config, env) => new AnthropicProvider(config, env),
};

function mapStopReason(reason: string | null): ChatResult['stopReason'] {
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
