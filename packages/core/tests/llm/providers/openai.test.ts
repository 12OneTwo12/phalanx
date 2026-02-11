import { describe, it, expect } from 'vitest';
import { toOpenAIMessages, toOpenAITools } from '../../../src/llm/providers/openai.js';
import type { Message, ToolDefinition } from '../../../src/llm/types.js';

describe('toOpenAIMessages', () => {
  it('converts simple text messages', () => {
    const messages: Message[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
    ];
    const result = toOpenAIMessages(messages);
    expect(result).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
    ]);
  });

  it('prepends system prompt', () => {
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];
    const result = toOpenAIMessages(messages, 'You are helpful');
    expect(result[0]).toEqual({ role: 'system', content: 'You are helpful' });
    expect(result[1]).toEqual({ role: 'user', content: 'Hello' });
  });

  it('passes through system role messages', () => {
    const messages: Message[] = [
      { role: 'system', content: 'System msg' },
      { role: 'user', content: 'Hello' },
    ];
    const result = toOpenAIMessages(messages);
    expect(result[0]).toEqual({ role: 'system', content: 'System msg' });
  });

  it('converts assistant messages with tool calls', () => {
    const messages: Message[] = [
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me search' },
          { type: 'tool_use', id: 'call_1', name: 'search', input: { q: 'test' } },
        ],
      },
    ];
    const result = toOpenAIMessages(messages);
    expect(result).toHaveLength(1);
    const msg = result[0] as { role: string; content: string; tool_calls?: unknown[] };
    expect(msg.content).toBe('Let me search');
    expect(msg.tool_calls).toHaveLength(1);
    expect(msg.tool_calls![0]).toEqual({
      id: 'call_1',
      type: 'function',
      function: { name: 'search', arguments: '{"q":"test"}' },
    });
  });

  it('converts tool result messages to tool role', () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: [
          { type: 'tool_result', toolUseId: 'call_1', content: 'search results' },
        ],
      },
    ];
    const result = toOpenAIMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: 'tool',
      tool_call_id: 'call_1',
      content: 'search results',
    });
  });

  it('handles mixed tool results and text in user messages', () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: [
          { type: 'tool_result', toolUseId: 'call_1', content: 'result' },
          { type: 'text', text: 'Also this' },
        ],
      },
    ];
    const result = toOpenAIMessages(messages);
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe('tool');
    expect(result[1]).toEqual({ role: 'user', content: 'Also this' });
  });
});

describe('toOpenAITools', () => {
  it('converts tool definitions to OpenAI format', () => {
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
    const result = toOpenAITools(tools);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('function');
    expect(result[0].function.name).toBe('search');
    expect(result[0].function.description).toBe('Search the web');
    expect(result[0].function.parameters).toEqual(tools[0].parameters);
  });
});
