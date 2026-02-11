import OpenAI from 'openai';
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
  MessageContent,
} from '../types.js';
import { MODEL_CATALOG } from '../model-catalog.js';
import { effectiveThinkingLevel } from '../thinking-level.js';

// ---------------------------------------------------------------------------
// OpenAI message conversion
// ---------------------------------------------------------------------------

export function toOpenAIMessages(
  messages: Message[],
  systemPrompt?: string,
): OpenAI.ChatCompletionMessageParam[] {
  const result: OpenAI.ChatCompletionMessageParam[] = [];

  if (systemPrompt) {
    result.push({ role: 'system', content: systemPrompt });
  }

  for (const msg of messages) {
    if (msg.role === 'system') {
      const text = typeof msg.content === 'string'
        ? msg.content
        : msg.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
      result.push({ role: 'system', content: text });
      continue;
    }

    if (typeof msg.content === 'string') {
      result.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
      continue;
    }

    // Handle structured content using discriminated union narrowing
    const contents = msg.content as MessageContent[];

    if (msg.role === 'assistant') {
      let text = '';
      const toolCalls: OpenAI.ChatCompletionMessageToolCall[] = [];

      for (const c of contents) {
        if (c.type === 'text') {
          text += c.text;
        } else if (c.type === 'tool_use') {
          toolCalls.push({
            id: c.id,
            type: 'function',
            function: { name: c.name, arguments: JSON.stringify(c.input) },
          });
        }
      }

      const assistantMsg: OpenAI.ChatCompletionAssistantMessageParam = {
        role: 'assistant',
        content: text,
      };
      if (toolCalls.length > 0) {
        assistantMsg.tool_calls = toolCalls;
      }
      result.push(assistantMsg);
    } else if (msg.role === 'user') {
      let text = '';

      for (const c of contents) {
        if (c.type === 'tool_result') {
          result.push({
            role: 'tool',
            tool_call_id: c.toolUseId,
            content: c.content,
          });
        } else if (c.type === 'text') {
          text += c.text;
        }
      }

      if (text) {
        result.push({ role: 'user', content: text });
      }
    }
  }

  return result;
}

export function toOpenAITools(
  tools: ChatWithToolsParams['tools'],
): OpenAI.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

function extractUsage(usage?: OpenAI.CompletionUsage | null): TokenUsage {
  return {
    inputTokens: usage?.prompt_tokens ?? 0,
    outputTokens: usage?.completion_tokens ?? 0,
    // reasoning_tokens is a subset of completion_tokens (already included in outputTokens)
    thinkingTokens: usage?.completion_tokens_details?.reasoning_tokens ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Reasoning model helpers
// ---------------------------------------------------------------------------

function isReasoningModel(model: string): boolean {
  return model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4');
}

function applyReasoningConfig(
  params: OpenAI.ChatCompletionCreateParams,
  model: string,
  thinkingLevel: string,
  maxTokens?: number,
  temperature?: number,
): void {
  if (isReasoningModel(model) && thinkingLevel !== 'off') {
    Object.assign(params, { reasoning_effort: thinkingLevel });
  } else {
    params.max_tokens = maxTokens ?? 4096;
    if (temperature !== undefined) {
      params.temperature = temperature;
    }
  }
}

// ---------------------------------------------------------------------------
// OpenAIProvider
// ---------------------------------------------------------------------------

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';

  get models(): string[] {
    return MODEL_CATALOG.filter((e) => e.provider === 'openai').map((e) => e.id);
  }

  private client: OpenAI;
  private apiKey: string;

  constructor(config: ProviderConfig = {}) {
    this.apiKey = config.apiKey ?? process.env.OPENAI_API_KEY ?? '';
    this.client = new OpenAI({
      apiKey: this.apiKey || undefined,
      baseURL: config.baseUrl,
      maxRetries: config.maxRetries ?? 2,
      timeout: config.timeout ?? 120_000,
    });
  }

  async chat(params: ChatParams): Promise<ChatResult> {
    const thinkingLevel = effectiveThinkingLevel(params.thinkingLevel, params.model);

    const requestParams: OpenAI.ChatCompletionCreateParams = {
      model: params.model,
      messages: toOpenAIMessages(params.messages, params.systemPrompt),
      ...(params.stopSequences && { stop: params.stopSequences }),
    };

    applyReasoningConfig(requestParams, params.model, thinkingLevel, params.maxTokens, params.temperature);

    const response = await this.client.chat.completions.create(
      requestParams,
    );
    const choice = response.choices[0];

    return {
      content: choice?.message?.content ?? '',
      stopReason: mapStopReason(choice?.finish_reason),
      usage: extractUsage(response.usage),
      model: response.model,
    };
  }

  async chatWithTools(params: ChatWithToolsParams): Promise<ToolCallResult> {
    const thinkingLevel = effectiveThinkingLevel(params.thinkingLevel, params.model);

    const requestParams: OpenAI.ChatCompletionCreateParams = {
      model: params.model,
      messages: toOpenAIMessages(params.messages, params.systemPrompt),
      tools: toOpenAITools(params.tools),
      ...(params.stopSequences && { stop: params.stopSequences }),
    };

    if (params.toolChoice) {
      if (params.toolChoice === 'auto') {
        requestParams.tool_choice = 'auto';
      } else if (params.toolChoice === 'none') {
        requestParams.tool_choice = 'none';
      } else {
        requestParams.tool_choice = {
          type: 'function',
          function: { name: params.toolChoice.name },
        };
      }
    }

    applyReasoningConfig(requestParams, params.model, thinkingLevel, params.maxTokens, params.temperature);

    const response = await this.client.chat.completions.create(
      requestParams,
    );
    const choice = response.choices[0];

    const toolCalls: ToolCall[] = (choice?.message?.tool_calls ?? []).map((tc) => {
      let input: Record<string, unknown>;
      try {
        input = JSON.parse(tc.function.arguments || '{}');
      } catch {
        input = { _raw: tc.function.arguments };
      }
      return { id: tc.id, name: tc.function.name, input };
    });

    return {
      content: choice?.message?.content ?? '',
      toolCalls,
      stopReason: mapStopReason(choice?.finish_reason),
      usage: extractUsage(response.usage),
      model: response.model,
    };
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
}

export const openaiProviderFactory: ProviderFactory = {
  name: 'openai',
  shouldActivate: (config, env) => !!(config.apiKey ?? env.OPENAI_API_KEY),
  create: (config) => new OpenAIProvider(config),
};

function mapStopReason(
  reason: string | null | undefined,
): ChatResult['stopReason'] {
  switch (reason) {
    case 'stop':
      return 'end_turn';
    case 'length':
      return 'max_tokens';
    case 'tool_calls':
      return 'tool_use';
    default:
      return 'end_turn';
  }
}
