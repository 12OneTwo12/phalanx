import { describe, it, expect } from 'vitest';
import { toAnthropicMessages, toAnthropicTools } from '../../../src/llm/providers/anthropic.js';
import type { Message, ToolDefinition } from '../../../src/llm/types.js';

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
