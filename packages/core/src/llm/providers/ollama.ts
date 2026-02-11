import type {
  LLMProvider,
  ChatParams,
  ChatResult,
  ChatWithToolsParams,
  ToolCallResult,
  ToolCall,
  ProviderConfig,
  ProviderFactory,
  Message,
} from '../types.js';

// ---------------------------------------------------------------------------
// Ollama API types (no SDK, direct HTTP)
// ---------------------------------------------------------------------------

interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaChatResponse {
  model: string;
  message: {
    role: string;
    content: string;
    tool_calls?: Array<{
      function: { name: string; arguments: Record<string, unknown> };
    }>;
  };
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaListResponse {
  models: Array<{ name: string; model: string }>;
}

// ---------------------------------------------------------------------------
// OllamaProvider — local model execution via Ollama HTTP API
// ---------------------------------------------------------------------------

export const ollamaProviderFactory: ProviderFactory = {
  name: 'ollama',
  shouldActivate: (config, env) => !!(config.baseUrl || env.OLLAMA_BASE_URL),
  create: (config, env) => new OllamaProvider(config, env),
};

export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama';
  private _models: string[] = [];

  get models(): string[] {
    return this._models;
  }

  private baseUrl: string;
  private config: ProviderConfig;

  constructor(
    config: ProviderConfig = {},
    env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
  ) {
    this.config = config;
    this.baseUrl = config.baseUrl ?? env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  }

  private toOllamaMessages(messages: Message[], systemPrompt?: string): OllamaChatMessage[] {
    const result: OllamaChatMessage[] = [];

    if (systemPrompt) {
      result.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        result.push({ role: msg.role, content: msg.content });
      } else {
        let text = '';
        for (const c of msg.content) {
          if (c.type === 'text') {
            text += c.text;
          }
        }
        if (text) {
          result.push({ role: msg.role, content: text });
        }
      }
    }

    return result;
  }

  async chat(params: ChatParams): Promise<ChatResult> {
    const response = await this.request<OllamaChatResponse>('/api/chat', {
      model: params.model,
      messages: this.toOllamaMessages(params.messages, params.systemPrompt),
      stream: false,
      options: {
        ...(params.temperature !== undefined && { temperature: params.temperature }),
        ...(params.maxTokens && { num_predict: params.maxTokens }),
      },
    });

    return {
      content: response.message.content,
      stopReason: 'end_turn',
      usage: {
        inputTokens: response.prompt_eval_count ?? 0,
        outputTokens: response.eval_count ?? 0,
      },
      model: response.model,
    };
  }

  async chatWithTools(params: ChatWithToolsParams): Promise<ToolCallResult> {
    const tools = params.tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const response = await this.request<OllamaChatResponse>('/api/chat', {
      model: params.model,
      messages: this.toOllamaMessages(params.messages, params.systemPrompt),
      tools,
      stream: false,
      options: {
        ...(params.temperature !== undefined && { temperature: params.temperature }),
        ...(params.maxTokens && { num_predict: params.maxTokens }),
      },
    });

    const toolCalls: ToolCall[] = (response.message.tool_calls ?? []).map((tc) => ({
      id: crypto.randomUUID(),
      name: tc.function.name,
      input: tc.function.arguments,
    }));

    return {
      content: response.message.content,
      toolCalls,
      stopReason: toolCalls.length > 0 ? 'tool_use' : 'end_turn',
      usage: {
        inputTokens: response.prompt_eval_count ?? 0,
        outputTokens: response.eval_count ?? 0,
      },
      model: response.model,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /** Discover available models from the local Ollama server */
  async discoverModels(): Promise<string[]> {
    if (this._models.length > 0) return this._models;

    try {
      const data = await this.request<OllamaListResponse>('/api/tags', undefined, 'GET');
      this._models = data.models.map((m) => m.name);
      return this._models;
    } catch {
      return [];
    }
  }

  private async request<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(this.config.timeout ?? 300_000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama API error ${response.status}: ${text}`);
    }

    return response.json() as Promise<T>;
  }
}
