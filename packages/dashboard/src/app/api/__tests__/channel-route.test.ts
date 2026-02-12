import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockMessages: Record<string, unknown>[] = [];

vi.mock('@/lib/db', () => ({
  getActivityLogRepository: vi.fn(() => ({
    create: vi.fn(),
  })),
  getChannelMessageRepository: vi.fn(() => ({
    create: vi.fn((data: Record<string, unknown>) => {
      const msg = { ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      mockMessages.push(msg);
      return msg;
    }),
    findAll: vi.fn((opts?: { limit?: number; offset?: number }) => {
      const start = opts?.offset ?? 0;
      const end = start + (opts?.limit ?? 100);
      return mockMessages.slice(start, end);
    }),
    findByRole: vi.fn((role: string) => mockMessages.filter(m => m.role === role)),
    findRecent: vi.fn((limit: number = 50) => mockMessages.slice(-limit).reverse()),
  })),
  getGoalRepository: vi.fn(() => ({
    findAll: vi.fn(() => []),
  })),
  getAgentRepository: vi.fn(() => ({
    findAll: vi.fn(() => []),
  })),
  getTicketRepository: vi.fn(() => ({
    findAll: vi.fn(() => []),
  })),
}));

vi.mock('@/lib/event-bus', () => ({
  eventBus: { emit: vi.fn() },
}));

const mockAgentRun = vi.fn().mockResolvedValue({
  status: 'completed',
  finalContent: 'Team Lead response',
  conversationHistory: [],
  iterations: 1,
  toolCallCount: 0,
  totalUsage: { inputTokens: 50, outputTokens: 100 },
});

vi.mock('@/lib/team-lead-agent', () => ({
  createTeamLeadAgent: vi.fn(() => ({
    run: mockAgentRun,
  })),
}));

vi.mock('@/lib/llm-provider', () => ({
  getLLMProvider: vi.fn(() => ({
    provider: {
      name: 'mock',
      models: ['mock-model'],
      chat: vi.fn(),
      chatWithTools: vi.fn(),
      isAvailable: vi.fn().mockResolvedValue(true),
    },
    model: 'mock-model',
  })),
}));

import { GET, POST } from '../channel/route';

describe('GET /api/channel', () => {
  beforeEach(() => {
    mockMessages.length = 0;
  });

  it('should return messages array', async () => {
    const req = new Request('http://localhost/api/channel');
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });
});

describe('POST /api/channel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMessages.length = 0;
  });

  it('should add a user message and generate team lead response', async () => {
    const req = new Request('http://localhost/api/channel', {
      method: 'POST',
      body: JSON.stringify({ content: 'Hello team' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.userMessage.content).toBe('Hello team');
    expect(body.userMessage.role).toBe('user');
    expect(body.userMessage.id).toBeDefined();
    // Team Lead LLM response should be generated
    expect(body.teamLeadMessage).toBeDefined();
    expect(body.teamLeadMessage.role).toBe('team-lead');
  });

  it('should return 400 for empty content', async () => {
    const req = new Request('http://localhost/api/channel', {
      method: 'POST',
      body: JSON.stringify({ content: '   ' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should accept custom role and skip LLM when role is team-lead', async () => {
    const req = new Request('http://localhost/api/channel', {
      method: 'POST',
      body: JSON.stringify({ content: 'Status update', role: 'team-lead' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(body.userMessage.role).toBe('team-lead');
    // No team lead response when the message is from team-lead
    expect(body.teamLeadMessage).toBeUndefined();
  });

  it('should call agent with channel history', async () => {
    mockMessages.push({
      id: 'prev-1',
      role: 'user',
      content: 'Previous message',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const req = new Request('http://localhost/api/channel', {
      method: 'POST',
      body: JSON.stringify({ content: 'New message' }),
      headers: { 'Content-Type': 'application/json' },
    });

    await POST(req);
    expect(mockAgentRun).toHaveBeenCalledOnce();
  });

  it('should show config message when no provider is available', async () => {
    const { getLLMProvider } = await import('@/lib/llm-provider');
    (getLLMProvider as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

    const req = new Request('http://localhost/api/channel', {
      method: 'POST',
      body: JSON.stringify({ content: 'Hello' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.teamLeadMessage.content).toContain('phalanx init');
  });

  it('should include agent metadata in response', async () => {
    const req = new Request('http://localhost/api/channel', {
      method: 'POST',
      body: JSON.stringify({ content: 'Hello team' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(body.teamLeadMessage.metadata).toBeDefined();
    const meta = JSON.parse(body.teamLeadMessage.metadata);
    expect(meta.status).toBe('completed');
    expect(meta.iterations).toBe(1);
    expect(meta.toolCallCount).toBe(0);
  });
});
