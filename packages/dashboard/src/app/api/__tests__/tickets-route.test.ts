import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  getTicketRepository: vi.fn(),
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

import { getTicketRepository } from '@/lib/db';
import { GET, POST } from '../tickets/route';

describe('GET /api/tickets', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return all tickets', async () => {
    const tickets = [{ id: 't1', title: 'Task 1', status: 'backlog' }];
    (getTicketRepository as ReturnType<typeof vi.fn>).mockReturnValue({
      findAll: () => tickets,
      findByStatus: vi.fn(),
      findByEpicId: vi.fn(),
    });

    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost/api/tickets');
    const res = await GET(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
  });

  it('should filter by status', async () => {
    const tickets = [{ id: 't2', status: 'done' }];
    (getTicketRepository as ReturnType<typeof vi.fn>).mockReturnValue({
      findByStatus: () => tickets,
    });

    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost/api/tickets?status=done');
    const res = await GET(req as any);
    const body = await res.json();

    expect(body).toHaveLength(1);
    expect(body[0].status).toBe('done');
  });

  it('should filter by epicId', async () => {
    const tickets = [{ id: 't3', epicId: 'e1' }];
    (getTicketRepository as ReturnType<typeof vi.fn>).mockReturnValue({
      findByStatus: vi.fn(),
      findByEpicId: () => tickets,
    });

    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost/api/tickets?epicId=e1');
    const res = await GET(req as any);
    const body = await res.json();

    expect(body).toHaveLength(1);
  });
});

describe('POST /api/tickets', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should create a ticket and return 201', async () => {
    const created = { id: 'new', epicId: 'e1', title: 'New', description: 'Desc', status: 'pending_approval' };
    (getTicketRepository as ReturnType<typeof vi.fn>).mockReturnValue({
      create: vi.fn(() => created),
    });

    const req = new Request('http://localhost/api/tickets', {
      method: 'POST',
      body: JSON.stringify({ epicId: 'e1', title: 'New', description: 'Desc' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it('should return 400 when required fields are missing', async () => {
    const req = new Request('http://localhost/api/tickets', {
      method: 'POST',
      body: JSON.stringify({ title: 'Only title' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
