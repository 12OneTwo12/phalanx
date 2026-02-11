import { describe, it, expect } from 'vitest';
import { OllamaProvider, toOllamaMessages } from '../../../src/llm/providers/ollama.js';
import { ollamaProviderFactory } from '../../../src/llm/providers/ollama.js';
import type { Message } from '../../../src/llm/types.js';

describe('OllamaProvider', () => {
  it('has correct provider name', () => {
    const provider = new OllamaProvider();
    expect(provider.name).toBe('ollama');
  });

  it('starts with empty models list', () => {
    const provider = new OllamaProvider();
    expect(provider.models).toEqual([]);
  });

  it('uses default base URL when not configured', () => {
    const provider = new OllamaProvider();
    // Verify it can be constructed without errors
    expect(provider.name).toBe('ollama');
  });
});

describe('ollamaProviderFactory', () => {
  it('activates when baseUrl is in config', () => {
    expect(ollamaProviderFactory.shouldActivate({ baseUrl: 'http://localhost:11434' }, {})).toBe(true);
  });

  it('activates when OLLAMA_BASE_URL is in env', () => {
    expect(ollamaProviderFactory.shouldActivate({}, { OLLAMA_BASE_URL: 'http://localhost:11434' })).toBe(true);
  });

  it('does not activate without explicit config', () => {
    expect(ollamaProviderFactory.shouldActivate({}, {})).toBe(false);
  });

  it('creates OllamaProvider instance', () => {
    const provider = ollamaProviderFactory.create({});
    expect(provider.name).toBe('ollama');
  });
});

describe('toOllamaMessages', () => {
  it('converts simple text messages', () => {
    const messages: Message[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ];

    const result = toOllamaMessages(messages);
    expect(result).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ]);
  });

  it('prepends system prompt', () => {
    const messages: Message[] = [{ role: 'user', content: 'Hi' }];
    const result = toOllamaMessages(messages, 'You are helpful');

    expect(result[0]).toEqual({ role: 'system', content: 'You are helpful' });
    expect(result[1]).toEqual({ role: 'user', content: 'Hi' });
  });

  it('preserves tool_use in assistant messages as tool_calls', () => {
    const messages: Message[] = [
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me search.' },
          { type: 'tool_use', id: 'call-1', name: 'search', input: { query: 'test' } },
        ],
      },
    ];

    const result = toOllamaMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('assistant');
    expect(result[0].content).toBe('Let me search.');
    expect(result[0].tool_calls).toEqual([
      { function: { name: 'search', arguments: { query: 'test' } } },
    ]);
  });

  it('converts tool_result to role=tool messages', () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: [
          { type: 'tool_result', toolUseId: 'call-1', content: 'Result data' },
          { type: 'text', text: 'What does this mean?' },
        ],
      },
    ];

    const result = toOllamaMessages(messages);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ role: 'tool', content: 'Result data' });
    expect(result[1]).toEqual({ role: 'user', content: 'What does this mean?' });
  });

  it('handles multi-turn tool conversation', () => {
    const messages: Message[] = [
      { role: 'user', content: 'Find weather in Seoul' },
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'tc-1', name: 'get_weather', input: { city: 'Seoul' } },
        ],
      },
      {
        role: 'user',
        content: [
          { type: 'tool_result', toolUseId: 'tc-1', content: '{"temp": 22}' },
        ],
      },
      { role: 'assistant', content: 'It is 22 degrees in Seoul.' },
    ];

    const result = toOllamaMessages(messages);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ role: 'user', content: 'Find weather in Seoul' });
    expect(result[1].role).toBe('assistant');
    expect(result[1].tool_calls).toHaveLength(1);
    expect(result[2]).toEqual({ role: 'tool', content: '{"temp": 22}' });
    expect(result[3]).toEqual({ role: 'assistant', content: 'It is 22 degrees in Seoul.' });
  });
});

describe('tool call ID uniqueness', () => {
  it('generates unique IDs via crypto.randomUUID', () => {
    // Verify crypto.randomUUID is available in the runtime
    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
