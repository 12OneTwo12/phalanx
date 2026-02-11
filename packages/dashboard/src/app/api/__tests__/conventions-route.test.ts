import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  getConventionRepository: vi.fn(),
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

import { getConventionRepository } from '@/lib/db';
import { GET, POST } from '../conventions/route';

describe('GET /api/conventions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return all conventions', async () => {
    const conventions = [{ id: 'c1', type: 'coding', content: 'Use TypeScript' }];
    (getConventionRepository as ReturnType<typeof vi.fn>).mockReturnValue({
      findAll: () => conventions,
      findByType: vi.fn(),
    });

    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost/api/conventions');
    const res = await GET(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
  });

  it('should return empty array when type not found', async () => {
    (getConventionRepository as ReturnType<typeof vi.fn>).mockReturnValue({
      findByType: () => null,
    });

    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost/api/conventions?type=nonexistent');
    const res = await GET(req as any);
    const body = await res.json();

    expect(body).toEqual([]);
  });
});

describe('POST /api/conventions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should create a new convention', async () => {
    const created = { id: 'c2', type: 'coding', content: 'New rule', version: 1 };
    (getConventionRepository as ReturnType<typeof vi.fn>).mockReturnValue({
      findByType: () => null,
      create: vi.fn(() => created),
    });

    const req = new Request('http://localhost/api/conventions', {
      method: 'POST',
      body: JSON.stringify({ type: 'coding', content: 'New rule' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it('should update existing convention with incremented version', async () => {
    const existing = { id: 'c1', type: 'coding', content: 'Old', version: 2 };
    const updated = { ...existing, content: 'Updated', version: 3 };
    (getConventionRepository as ReturnType<typeof vi.fn>).mockReturnValue({
      findByType: () => existing,
      update: vi.fn(() => updated),
    });

    const req = new Request('http://localhost/api/conventions', {
      method: 'POST',
      body: JSON.stringify({ type: 'coding', content: 'Updated' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.version).toBe(3);
  });

  it('should return 400 when type or content missing', async () => {
    const req = new Request('http://localhost/api/conventions', {
      method: 'POST',
      body: JSON.stringify({ type: 'coding' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
