import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Message, ToolDefinition } from '../../../src/llm/types.js';

// Hoist the mock constructor so it's available before module imports
const mockCreate = vi.fn();
const MockAnthropicConstructor = vi.fn().mockImplementation((opts: Record<string, unknown>) => ({
  _options: opts,
  messages: { create: mockCreate },
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: MockAnthropicConstructor,
}));

// Import AFTER the mock is set up
const { toAnthropicMessages, toAnthropicTools, AnthropicProvider } = await import(
  '../../../src/llm/providers/anthropic.js'
);

describe('toAnthropicMessages', () => {
  it('converts simple text messages', () => {
    const messages: Message[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ];
    const result = toAnthropicMessages(messages);
    expect(result).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ]);
  });

  it('filters out system messages', () => {
    const messages: Message[] = [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'Hello' },
    ];
    const result = toAnthropicMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('user');
  });

  it('converts structured text content', () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'What is this?' }],
      },
    ];
    const result = toAnthropicMessages(messages);
    expect(result[0].content).toEqual([{ type: 'text', text: 'What is this?' }]);
  });

  it('converts tool_use content blocks', () => {
    const messages: Message[] = [
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'call_1', name: 'search', input: { query: 'test' } },
        ],
      },
    ];
    const result = toAnthropicMessages(messages);
    expect(result[0].content).toEqual([
      { type: 'tool_use', id: 'call_1', name: 'search', input: { query: 'test' } },
    ]);
  });

  it('converts tool_result content blocks', () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: [
          { type: 'tool_result', toolUseId: 'call_1', content: 'result data', isError: false },
        ],
      },
    ];
    const result = toAnthropicMessages(messages);
    expect(result[0].content).toEqual([
      { type: 'tool_result', tool_use_id: 'call_1', content: 'result data', is_error: false },
    ]);
  });
});

describe('toAnthropicTools', () => {
  it('converts tool definitions to Anthropic format', () => {
    const tools: ToolDefinition[] = [
      {
        name: 'search',
        description: 'Search the web',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
          },
          required: ['query'],
        },
      },
    ];
    const result = toAnthropicTools(tools);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('search');
    expect(result[0].description).toBe('Search the web');
    expect(result[0].input_schema.type).toBe('object');
    expect(result[0].input_schema.required).toEqual(['query']);
  });

  it('converts multiple tools', () => {
    const tools: ToolDefinition[] = [
      {
        name: 'search',
        description: 'Search',
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'read',
        description: 'Read file',
        parameters: { type: 'object', properties: {} },
      },
    ];
    const result = toAnthropicTools(tools);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('search');
    expect(result[1].name).toBe('read');
  });
});

// ---------------------------------------------------------------------------
// OAuth token support
// ---------------------------------------------------------------------------

describe('AnthropicProvider — OAuth token support', () => {
  beforeEach(() => {
    MockAnthropicConstructor.mockClear();
    mockCreate.mockReset();
  });

  it('detects OAuth token by sk-ant-oat prefix and uses authToken', () => {
    const oauthKey = 'sk-ant-oat01-abc123';
    new AnthropicProvider({ apiKey: oauthKey }, {});

    expect(MockAnthropicConstructor).toHaveBeenCalledTimes(1);
    const opts = MockAnthropicConstructor.mock.calls[0][0] as Record<string, unknown>;
    expect(opts.authToken).toBe(oauthKey);
    expect(opts.apiKey).toBeNull();
    expect(opts.defaultHeaders).toEqual(
      expect.objectContaining({
        'anthropic-beta': expect.stringContaining('oauth-2025-04-20'),
      }),
    );
  });

  it('uses regular apiKey for non-OAuth tokens', () => {
    const regularKey = 'sk-ant-api03-xyz789';
    new AnthropicProvider({ apiKey: regularKey }, {});

    expect(MockAnthropicConstructor).toHaveBeenCalledTimes(1);
    const opts = MockAnthropicConstructor.mock.calls[0][0] as Record<string, unknown>;
    expect(opts.apiKey).toBe(regularKey);
    expect(opts.authToken).toBeUndefined();
  });

  it('prepends Claude Code identity to system prompt for OAuth tokens', async () => {
    const oauthKey = 'sk-ant-oat01-abc123';
    const provider = new AnthropicProvider({ apiKey: oauthKey }, {});

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Hello' }],
      usage: { input_tokens: 10, output_tokens: 5 },
      model: 'claude-sonnet-4-5-20250929',
      stop_reason: 'end_turn',
    });

    await provider.chat({
      model: 'claude-sonnet-4-5-20250929',
      messages: [{ role: 'user', content: 'Hi' }],
      systemPrompt: 'Be helpful.',
    });

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.system).toMatch(
      /^You are Claude Code, Anthropic's official CLI for Claude\.\n\nBe helpful\.$/,
    );
  });

  it('does NOT prepend Claude Code identity for regular API keys', async () => {
    const regularKey = 'sk-ant-api03-xyz789';
    const provider = new AnthropicProvider({ apiKey: regularKey }, {});

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Hello' }],
      usage: { input_tokens: 10, output_tokens: 5 },
      model: 'claude-sonnet-4-5-20250929',
      stop_reason: 'end_turn',
    });

    await provider.chat({
      model: 'claude-sonnet-4-5-20250929',
      messages: [{ role: 'user', content: 'Hi' }],
      systemPrompt: 'Be helpful.',
    });

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.system).toBe('Be helpful.');
  });

  it('isAvailable returns true for OAuth tokens', async () => {
    const provider = new AnthropicProvider({ apiKey: 'sk-ant-oat01-abc' }, {});
    expect(await provider.isAvailable()).toBe(true);
  });
});
