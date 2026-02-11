import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  getActivityLogRepository: vi.fn(() => ({
    create: vi.fn(),
  })),
}));

vi.mock('@/lib/event-bus', () => ({
  eventBus: { emit: vi.fn() },
}));

import { GET, POST } from '../channel/route';

describe('GET /api/channel', () => {
  it('should return messages array', async () => {
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });
});

describe('POST /api/channel', () => {
  beforeEach(() => vi.clearAllMocks());

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
