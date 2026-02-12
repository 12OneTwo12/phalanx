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
}));

vi.mock('@/lib/event-bus', () => ({
  eventBus: { emit: vi.fn() },
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

  it('should add a message and return 201', async () => {
    const req = new Request('http://localhost/api/channel', {
      method: 'POST',
      body: JSON.stringify({ content: 'Hello team' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.content).toBe('Hello team');
    expect(body.role).toBe('user');
    expect(body.id).toBeDefined();
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

  it('should accept custom role', async () => {
    const req = new Request('http://localhost/api/channel', {
      method: 'POST',
      body: JSON.stringify({ content: 'Status update', role: 'team-lead' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(body.role).toBe('team-lead');
  });
});
