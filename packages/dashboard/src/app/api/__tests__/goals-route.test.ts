import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module before importing routes
vi.mock('@/lib/db', () => ({
  getGoalRepository: vi.fn(),
  getEpicRepository: vi.fn(),
  getTicketRepository: vi.fn(),
}));

// Mock next/server
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

import { getGoalRepository, getEpicRepository } from '@/lib/db';
import { GET, POST } from '../goals/route';

describe('GET /api/goals', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return all goals with epic counts', async () => {
    const mockGoals = [{ id: 'g1', description: 'Goal 1', status: 'active' }];
    (getGoalRepository as ReturnType<typeof vi.fn>).mockReturnValue({
      findAll: () => mockGoals,
      findByStatus: vi.fn(),
    });
    (getEpicRepository as ReturnType<typeof vi.fn>).mockReturnValue({
      findByGoalId: () => [{ id: 'e1' }],
    });

    // Use the mocked NextRequest
    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost/api/goals');
    const res = await GET(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].epicCount).toBe(1);
  });

  it('should filter goals by status query param', async () => {
    const mockGoals = [{ id: 'g2', description: 'Active goal', status: 'active' }];
    (getGoalRepository as ReturnType<typeof vi.fn>).mockReturnValue({
      findAll: vi.fn(),
      findByStatus: () => mockGoals,
    });
    (getEpicRepository as ReturnType<typeof vi.fn>).mockReturnValue({
      findByGoalId: () => [],
    });

    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost/api/goals?status=active');
    const res = await GET(req as any);
    const body = await res.json();

    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('g2');
  });
});

describe('POST /api/goals', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should create a goal and return 201', async () => {
    const created = { id: 'new-id', description: 'New goal', status: 'active' };
    (getGoalRepository as ReturnType<typeof vi.fn>).mockReturnValue({
      create: vi.fn(() => created),
    });

    const req = new Request('http://localhost/api/goals', {
      method: 'POST',
      body: JSON.stringify({ description: 'New goal' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.description).toBe('New goal');
  });

  it('should return 400 if description is missing', async () => {
    const req = new Request('http://localhost/api/goals', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('should return 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/goals', {
      method: 'POST',
      body: 'not-json',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
