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
  MessageContent,
} from '../types.js';
import { MODEL_CATALOG } from '../model-catalog.js';

// ---------------------------------------------------------------------------
// Gemini API types (direct HTTP, no SDK dependency)
// ---------------------------------------------------------------------------

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiResponse {
  candidates: Array<{
    content: { parts: GeminiPart[] };
    finishReason: string;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  modelVersion?: string;
}

// ---------------------------------------------------------------------------
// GeminiProvider — Google Gemini API via REST
// ---------------------------------------------------------------------------

export const geminiProviderFactory: ProviderFactory = {
  name: 'gemini',
  shouldActivate: (config, env) => !!(config.apiKey ?? env.GEMINI_API_KEY),
  create: (config, env) => new GeminiProvider(config, env),
};

export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';

  get models(): string[] {
    return MODEL_CATALOG.filter((e) => e.provider === 'gemini').map((e) => e.id);
  }

  private apiKey: string;
  private baseUrl: string;
  private config: ProviderConfig;

  constructor(
    config: ProviderConfig = {},
    env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
  ) {
    this.config = config;
    this.apiKey = config.apiKey ?? env.GEMINI_API_KEY ?? '';
    this.baseUrl =
      config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
  }

  private toGeminiContents(
    messages: Message[],
    systemPrompt?: string,
  ): { contents: GeminiContent[]; systemInstruction?: { parts: Array<{ text: string }> } } {
    const contents: GeminiContent[] = [];
    let sysInstruction: { parts: Array<{ text: string }> } | undefined;

    if (systemPrompt) {
      sysInstruction = { parts: [{ text: systemPrompt }] };
    }

    for (const msg of messages) {
      if (msg.role === 'system') {
        const text = typeof msg.content === 'string'
          ? msg.content
          : msg.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
        sysInstruction = { parts: [{ text }] };
        continue;
      }

      const role = msg.role === 'assistant' ? 'model' : 'user';

      if (typeof msg.content === 'string') {
        contents.push({ role, parts: [{ text: msg.content }] });
      } else {
        const parts: GeminiPart[] = [];
        for (const c of msg.content as MessageContent[]) {
          if (c.type === 'text') {
            parts.push({ text: c.text });
          } else if (c.type === 'tool_use') {
            parts.push({
              functionCall: { name: c.name, args: c.input },
            });
          } else if (c.type === 'tool_result') {
            parts.push({
              functionResponse: {
                name: c.name ?? c.toolUseId,
                response: { content: c.content },
              },
            });
          }
        }
        if (parts.length > 0) {
          contents.push({ role, parts });
        }
      }
    }

    return { contents, systemInstruction: sysInstruction };
  }

  async chat(params: ChatParams): Promise<ChatResult> {
    const { contents, systemInstruction } = this.toGeminiContents(
      params.messages,
      params.systemPrompt,
    );

    const body: Record<string, unknown> = {
      contents,
      ...(systemInstruction && { systemInstruction }),
      generationConfig: {
        ...(params.maxTokens && { maxOutputTokens: params.maxTokens }),
        ...(params.temperature !== undefined && { temperature: params.temperature }),
        ...(params.stopSequences && { stopSequences: params.stopSequences }),
      },
    };

    const response = await this.request<GeminiResponse>(params.model, 'generateContent', body);
    const candidate = response.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';

    return {
      content: text,
      stopReason: mapFinishReason(candidate?.finishReason),
      usage: {
        inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      },
      model: response.modelVersion ?? params.model,
    };
  }

  async chatWithTools(params: ChatWithToolsParams): Promise<ToolCallResult> {
    const { contents, systemInstruction } = this.toGeminiContents(
      params.messages,
      params.systemPrompt,
    );

    const tools = [
      {
        functionDeclarations: params.tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
      },
    ];

    const body: Record<string, unknown> = {
      contents,
      tools,
      ...(systemInstruction && { systemInstruction }),
      generationConfig: {
        ...(params.maxTokens && { maxOutputTokens: params.maxTokens }),
        ...(params.temperature !== undefined && { temperature: params.temperature }),
      },
    };

    const response = await this.request<GeminiResponse>(params.model, 'generateContent', body);
    const candidate = response.candidates?.[0];

    let textContent = '';
    const toolCalls: ToolCall[] = [];

    for (const part of candidate?.content?.parts ?? []) {
      if (part.text) {
        textContent += part.text;
      }
      if (part.functionCall) {
        toolCalls.push({
          id: crypto.randomUUID(),
          name: part.functionCall.name,
          input: part.functionCall.args,
        });
      }
    }

    return {
      content: textContent,
      toolCalls,
      stopReason: toolCalls.length > 0 ? 'tool_use' : mapFinishReason(candidate?.finishReason),
      usage: {
        inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      },
      model: response.modelVersion ?? params.model,
    };
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  private async request<T>(model: string, method: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}/models/${model}:${method}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeout ?? 120_000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${text}`);
    }

    return response.json() as Promise<T>;
  }
}

function mapFinishReason(reason?: string): ChatResult['stopReason'] {
  switch (reason) {
    case 'STOP':
      return 'end_turn';
    case 'MAX_TOKENS':
      return 'max_tokens';
    case 'SAFETY':
    case 'RECITATION':
      return 'end_turn';
    default:
      return 'end_turn';
  }
}
