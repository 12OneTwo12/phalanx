import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  getProposalRepository: vi.fn(),
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

import { getProposalRepository } from '@/lib/db';
import { GET } from '../proposals/route';

describe('GET /api/proposals', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return all proposals', async () => {
    const proposals = [{ id: 'p1', status: 'pending' }];
    (getProposalRepository as ReturnType<typeof vi.fn>).mockReturnValue({
      findAll: vi.fn(() => proposals),
      findByStatus: vi.fn(),
    });

    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost/api/proposals');
    const res = await GET(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
  });

  it('should filter by status', async () => {
    const proposals = [{ id: 'p2', status: 'approved' }];
    (getProposalRepository as ReturnType<typeof vi.fn>).mockReturnValue({
      findByStatus: vi.fn(() => proposals),
    });

    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost/api/proposals?status=approved');
    const res = await GET(req as any);
    const body = await res.json();

    expect(body).toHaveLength(1);
    expect(body[0].status).toBe('approved');
  });
});
