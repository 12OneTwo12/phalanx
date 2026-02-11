import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  getAgentRepository: vi.fn(),
}));

vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return {
    ...actual,
    NextRequest: class MockNextRequest extends Request {
      nextUrl: URL;
      constructor(url: string, init?: RequestInit) {
        super(url, init);
        this.nextUrl = new URL(url);
      }
    },
  };
});

import { getAgentRepository } from '@/lib/db';
import { GET, POST } from '../agents/route';

describe('GET /api/agents', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return all agents', async () => {
    const agents = [{ id: 'a1', name: 'Agent 1', role: 'coder' }];
    (getAgentRepository as ReturnType<typeof vi.fn>).mockReturnValue({
      findAll: () => agents,
      findByRole: vi.fn(),
      findByStatus: vi.fn(),
    });

    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost/api/agents');
    const res = await GET(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
  });

  it('should filter by role', async () => {
    const agents = [
      { id: 'a1', role: 'reviewer' },
      { id: 'a2', role: 'coder' },
    ];
    (getAgentRepository as ReturnType<typeof vi.fn>).mockReturnValue({
      findAll: () => agents,
    });

    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost/api/agents?role=reviewer');
    const res = await GET(req as any);
    const body = await res.json();

    expect(body).toHaveLength(1);
    expect(body[0].role).toBe('reviewer');
  });
});

describe('POST /api/agents', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should create an agent and return 201', async () => {
    const created = { id: 'new', role: 'coder', name: 'Bot' };
    (getAgentRepository as ReturnType<typeof vi.fn>).mockReturnValue({
      create: vi.fn(() => created),
    });

    const req = new Request('http://localhost/api/agents', {
      method: 'POST',
      body: JSON.stringify({ role: 'coder', name: 'Bot' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it('should return 400 when role or name missing', async () => {
    const req = new Request('http://localhost/api/agents', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bot' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
