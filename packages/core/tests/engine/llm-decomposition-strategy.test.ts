import { describe, it, expect, vi } from 'vitest';
import { LLMDecompositionStrategy } from '../../src/engine/llm-decomposition-strategy.js';
import type { LLMProvider, ChatResult } from '../../src/llm/types.js';

function mockProvider(response: string): LLMProvider {
  return {
    name: 'mock',
    models: ['mock-model'],
    chat: vi.fn().mockResolvedValue({
      content: response,
      usage: { inputTokens: 100, outputTokens: 200 },
      model: 'mock-model',
    } satisfies ChatResult),
    chatWithTools: vi.fn(),
    isAvailable: vi.fn().mockResolvedValue(true),
  };
}

const VALID_RESPONSE = JSON.stringify({
  epics: [
    {
      title: 'Auth System',
      description: 'Implement authentication',
      tickets: [
        {
          title: 'Add JWT middleware',
          description: 'Implement JWT verification middleware',
          priority: 'high',
          dependsOn: [],
          category: 'backend',
        },
        {
          title: 'Add login endpoint',
          description: 'POST /api/login with email/password',
          priority: 'high',
          dependsOn: ['Add JWT middleware'],
          category: 'backend',
        },
      ],
    },
  ],
});

describe('LLMDecompositionStrategy', () => {
  it('should decompose a goal via LLM', async () => {
    const provider = mockProvider(VALID_RESPONSE);
    const strategy = new LLMDecompositionStrategy(provider);

    const epics = await strategy.decompose('Build user authentication');
    expect(epics).toHaveLength(1);
    expect(epics[0].title).toBe('Auth System');
    expect(epics[0].tickets).toHaveLength(2);
    expect(epics[0].tickets[1].dependsOn).toEqual(['Add JWT middleware']);
  });

  it('should pass goal description to LLM', async () => {
    const provider = mockProvider(VALID_RESPONSE);
    const strategy = new LLMDecompositionStrategy(provider);

    await strategy.decompose('Build a REST API');
    expect(provider.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: expect.stringContaining('Build a REST API') }],
      }),
    );
  });

  it('should include conventions in system prompt', async () => {
    const provider = mockProvider(VALID_RESPONSE);
    const strategy = new LLMDecompositionStrategy(provider, {
      conventions: 'Use kebab-case for files',
    });

    await strategy.decompose('Build something');
    expect(provider.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining('kebab-case'),
      }),
    );
  });

  it('should use custom config', async () => {
    const provider = mockProvider(VALID_RESPONSE);
    const strategy = new LLMDecompositionStrategy(provider, {
      config: { model: 'custom-model', maxTokens: 8192, temperature: 0.5 },
    });

    await strategy.decompose('Build something');
    expect(provider.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'custom-model',
        maxTokens: 8192,
        temperature: 0.5,
      }),
    );
  });

  // -----------------------------------------------------------------------
  // parseResponse
  // -----------------------------------------------------------------------

  describe('parseResponse', () => {
    it('should handle markdown code fences', () => {
      const strategy = new LLMDecompositionStrategy(mockProvider(''));
      const wrapped = '```json\n' + VALID_RESPONSE + '\n```';
      const epics = strategy.parseResponse(wrapped);
      expect(epics).toHaveLength(1);
    });

    it('should handle fences without json tag', () => {
      const strategy = new LLMDecompositionStrategy(mockProvider(''));
      const wrapped = '```\n' + VALID_RESPONSE + '\n```';
      const epics = strategy.parseResponse(wrapped);
      expect(epics).toHaveLength(1);
    });

    it('should throw on invalid JSON', () => {
      const strategy = new LLMDecompositionStrategy(mockProvider(''));
      expect(() => strategy.parseResponse('{invalid}')).toThrow();
    });

    it('should throw on schema violation', () => {
      const strategy = new LLMDecompositionStrategy(mockProvider(''));
      expect(() => strategy.parseResponse('{"epics": [{"title": 123}]}')).toThrow();
    });

    it('should apply defaults for optional fields', () => {
      const strategy = new LLMDecompositionStrategy(mockProvider(''));
      const minimal = JSON.stringify({
        epics: [{
          title: 'E1',
          description: 'D1',
          tickets: [{
            title: 'T1',
            description: 'TD1',
            priority: 'medium',
          }],
        }],
      });
      const epics = strategy.parseResponse(minimal);
      expect(epics[0].tickets[0].dependsOn).toEqual([]);
      expect(epics[0].tickets[0].category).toBe('backend');
    });
  });
});
