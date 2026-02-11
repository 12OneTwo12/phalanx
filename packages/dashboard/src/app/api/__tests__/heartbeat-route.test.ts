import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  getHeartbeatLogRepository: vi.fn(),
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

import { getHeartbeatLogRepository } from '@/lib/db';
import { GET } from '../heartbeat/route';

describe('GET /api/heartbeat', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return all heartbeat logs (default limit 50)', async () => {
    const logs = [{ id: 'h1', status: 'pending' }];
    (getHeartbeatLogRepository as ReturnType<typeof vi.fn>).mockReturnValue({
      findAll: vi.fn(() => logs),
      findByStatus: vi.fn(),
    });

    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost/api/heartbeat');
    const res = await GET(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
  });

  it('should filter by status', async () => {
    const logs = [{ id: 'h2', status: 'acknowledged' }];
    (getHeartbeatLogRepository as ReturnType<typeof vi.fn>).mockReturnValue({
      findByStatus: vi.fn(() => logs),
    });

    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost/api/heartbeat?status=acknowledged');
    const res = await GET(req as any);
    const body = await res.json();

    expect(body).toHaveLength(1);
    expect(body[0].status).toBe('acknowledged');
  });
});
