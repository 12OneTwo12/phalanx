/**
 * Tests for PATCH /api/heartbeat/:id — user response processing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  getHeartbeatLogRepository: vi.fn(),
}));

vi.mock('@/lib/event-bus', () => ({
  eventBus: { emit: vi.fn() },
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
import { eventBus } from '@/lib/event-bus';

// Dynamic import to pick up mocks
const routeModule = await import('../heartbeat/[id]/route');
const { GET, PATCH } = routeModule;

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/heartbeat/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return a heartbeat log by id', async () => {
    const log = { id: 'h1', status: 'pending', report: '{}' };
    (getHeartbeatLogRepository as ReturnType<typeof vi.fn>).mockReturnValue({
      findById: vi.fn(() => log),
    });

    const res = await GET(new Request('http://localhost/api/heartbeat/h1'), makeParams('h1'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.id).toBe('h1');
  });

  it('should return 404 for missing heartbeat log', async () => {
    (getHeartbeatLogRepository as ReturnType<typeof vi.fn>).mockReturnValue({
      findById: vi.fn(() => null),
    });

    const res = await GET(new Request('http://localhost/api/heartbeat/missing'), makeParams('missing'));
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/heartbeat/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should acknowledge a heartbeat report', async () => {
    const log = { id: 'h1', status: 'pending' };
    const updated = { id: 'h1', status: 'acknowledged' };
    (getHeartbeatLogRepository as ReturnType<typeof vi.fn>).mockReturnValue({
      findById: vi.fn(() => log),
      update: vi.fn(() => updated),
    });

    const req = new Request('http://localhost/api/heartbeat/h1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'acknowledge' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req, makeParams('h1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('acknowledged');
    expect(body.action).toBe('acknowledge');
    expect(eventBus.emit).toHaveBeenCalledWith('heartbeat:response', expect.objectContaining({
      action: 'acknowledge',
    }));
  });

  it('should process approve_all action', async () => {
    const log = { id: 'h2', status: 'pending' };
    const updated = { id: 'h2', status: 'acted' };
    (getHeartbeatLogRepository as ReturnType<typeof vi.fn>).mockReturnValue({
      findById: vi.fn(() => log),
      update: vi.fn(() => updated),
    });

    const req = new Request('http://localhost/api/heartbeat/h2', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'approve_all' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req, makeParams('h2'));
    const body = await res.json();

    expect(body.status).toBe('acted');
    expect(body.action).toBe('approve_all');
  });

  it('should keep status as pending for later action', async () => {
    const log = { id: 'h3', status: 'pending' };
    (getHeartbeatLogRepository as ReturnType<typeof vi.fn>).mockReturnValue({
      findById: vi.fn(() => log),
      update: vi.fn(),
    });

    const req = new Request('http://localhost/api/heartbeat/h3', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'later' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req, makeParams('h3'));
    const body = await res.json();

    expect(body.status).toBe('pending');
    expect(body.action).toBe('later');
    // Should NOT emit event or call update for 'later'
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it('should return 400 for invalid action', async () => {
    const req = new Request('http://localhost/api/heartbeat/h1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'invalid' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req, makeParams('h1'));
    expect(res.status).toBe(400);
  });

  it('should return 404 for non-existent heartbeat', async () => {
    (getHeartbeatLogRepository as ReturnType<typeof vi.fn>).mockReturnValue({
      findById: vi.fn(() => null),
      update: vi.fn(),
    });

    const req = new Request('http://localhost/api/heartbeat/missing', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'acknowledge' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req, makeParams('missing'));
    expect(res.status).toBe(404);
  });
});
