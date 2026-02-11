import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  getActivityLogRepository: vi.fn(),
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

import { getActivityLogRepository } from '@/lib/db';
import { GET } from '../activity/route';

describe('GET /api/activity', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return all activity logs with default limit', async () => {
    const logs = [{ id: 'l1', action: 'ticket:created', level: 'info' }];
    (getActivityLogRepository as ReturnType<typeof vi.fn>).mockReturnValue({
      findAll: vi.fn(() => logs),
      findByAgentId: vi.fn(),
      findByTicketId: vi.fn(),
    });

    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost/api/activity');
    const res = await GET(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
  });

  it('should filter by agentId', async () => {
    const logs = [{ id: 'l2', agentId: 'a1' }];
    (getActivityLogRepository as ReturnType<typeof vi.fn>).mockReturnValue({
      findByAgentId: vi.fn(() => logs),
    });

    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost/api/activity?agentId=a1');
    const res = await GET(req as any);
    const body = await res.json();

    expect(body).toHaveLength(1);
  });

  it('should filter by ticketId', async () => {
    const logs = [{ id: 'l3', ticketId: 't1' }];
    (getActivityLogRepository as ReturnType<typeof vi.fn>).mockReturnValue({
      findByAgentId: vi.fn(),
      findByTicketId: vi.fn(() => logs),
    });

    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost/api/activity?ticketId=t1');
    const res = await GET(req as any);
    const body = await res.json();

    expect(body).toHaveLength(1);
  });
});
