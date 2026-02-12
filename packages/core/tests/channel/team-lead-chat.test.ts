import { describe, it, expect, vi } from 'vitest';
import { TeamLeadChatService, type ChatMessage } from '../../src/channel/team-lead-chat.js';
import type { LLMProvider, ChatResult } from '../../src/llm/types.js';

function mockProvider(response: string): LLMProvider {
  return {
    name: 'mock',
    models: ['mock-model'],
    chat: vi.fn().mockResolvedValue({
      content: response,
      usage: { inputTokens: 50, outputTokens: 100 },
      model: 'mock-model',
    } satisfies ChatResult),
    chatWithTools: vi.fn(),
    isAvailable: vi.fn().mockResolvedValue(true),
  };
}

describe('TeamLeadChatService', () => {
  it('should generate a response from channel history', async () => {
    const provider = mockProvider('I will coordinate the team on this.');
    const service = new TeamLeadChatService(provider);

    const history: ChatMessage[] = [
      { role: 'user', content: 'How is the project going?' },
    ];

    const response = await service.respond(history);
    expect(response).toBe('I will coordinate the team on this.');
    expect(provider.chat).toHaveBeenCalledOnce();
  });

  it('should convert channel roles to LLM message roles', async () => {
    const provider = mockProvider('OK');
    const service = new TeamLeadChatService(provider);

    const history: ChatMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'team-lead', content: 'Hi!' },
      { role: 'user', content: 'Status?' },
    ];

    await service.respond(history);
    expect(provider.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
          { role: 'user', content: 'Status?' },
        ],
      }),
    );
  });

  it('should include soul prompt in system prompt', async () => {
    const provider = mockProvider('OK');
    const service = new TeamLeadChatService(provider, {
      soulPrompt: 'You are a decisive team lead.',
    });

    await service.respond([{ role: 'user', content: 'Hello' }]);
    expect(provider.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining('decisive team lead'),
      }),
    );
  });

  it('should include project context in system prompt', async () => {
    const provider = mockProvider('OK');
    const service = new TeamLeadChatService(provider);

    await service.respond(
      [{ role: 'user', content: 'What are we working on?' }],
      {
        goals: [{ description: 'Build auth system', status: 'active' }],
        agents: [{ name: 'Agent-1', role: 'backend', status: 'running' }],
        activeTicketCount: 5,
      },
    );

    const call = (provider.chat as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.systemPrompt).toContain('Build auth system');
    expect(call.systemPrompt).toContain('Agent-1');
    expect(call.systemPrompt).toContain('Active: 5');
  });

  it('should use default system prompt when no soul provided', async () => {
    const provider = mockProvider('OK');
    const service = new TeamLeadChatService(provider);

    await service.respond([{ role: 'user', content: 'Hello' }]);
    const call = (provider.chat as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.systemPrompt).toContain('Phalanx');
    expect(call.systemPrompt).toContain('Team Lead');
  });

  it('should use custom model and config', async () => {
    const provider = mockProvider('OK');
    const service = new TeamLeadChatService(provider, {
      model: 'custom-model',
      maxTokens: 4096,
      temperature: 0.2,
    });

    await service.respond([{ role: 'user', content: 'Hello' }]);
    expect(provider.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'custom-model',
        maxTokens: 4096,
        temperature: 0.2,
      }),
    );
  });
});
