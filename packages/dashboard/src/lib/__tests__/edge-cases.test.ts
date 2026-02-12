/**
 * Edge-case tests for dashboard modules.
 * Covers: EventBus advanced scenarios, ticket-columns edge cases,
 * api-client boundary values, api-utils edge cases.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── EventBus Edge Cases ───────────────────────────────────────────────────────

describe('EventBus — edge cases', () => {
  beforeEach(async () => {
    // Re-import to get fresh module state is tricky with singletons,
    // so we test via the exported singleton with cleanup
    vi.resetModules();
  });

  it('should emit with default empty payload', async () => {
    const { eventBus } = await import('../event-bus');
    const handler = vi.fn();
    const unsub = eventBus.subscribe(handler);

    eventBus.emit('test:no-payload');

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].payload).toEqual({});

    unsub();
  });

  it('should handle unsubscribe called multiple times without error', async () => {
    const { eventBus } = await import('../event-bus');
    const handler = vi.fn();
    const unsub = eventBus.subscribe(handler);

    unsub();
    unsub(); // double unsubscribe — should not throw
    unsub();

    eventBus.emit('test:after-multi-unsub');
    expect(handler).not.toHaveBeenCalled();
  });

  it('should handle unsubscribe during emit (subscriber removes itself)', async () => {
    const { eventBus } = await import('../event-bus');
    let unsub: () => void;
    const selfRemover = vi.fn(() => {
      unsub();
    });
    const afterHandler = vi.fn();

    unsub = eventBus.subscribe(selfRemover);
    const unsub2 = eventBus.subscribe(afterHandler);

    // Set iterates in insertion order; removing during iteration
    // should not crash (Set is safe for delete-during-iteration)
    eventBus.emit('test:self-remove');

    expect(selfRemover).toHaveBeenCalledOnce();
    expect(afterHandler).toHaveBeenCalledOnce();

    unsub2();
  });

  it('should deliver to many subscribers (100)', async () => {
    const { eventBus } = await import('../event-bus');
    const handlers: ReturnType<typeof vi.fn>[] = [];
    const unsubs: (() => void)[] = [];

    for (let i = 0; i < 100; i++) {
      const h = vi.fn();
      handlers.push(h);
      unsubs.push(eventBus.subscribe(h));
    }

    eventBus.emit('test:many');

    for (const h of handlers) {
      expect(h).toHaveBeenCalledOnce();
    }

    for (const u of unsubs) u();
  });

  it('should include ISO timestamp in emitted events', async () => {
    const { eventBus } = await import('../event-bus');
    const handler = vi.fn();
    const unsub = eventBus.subscribe(handler);

    eventBus.emit('test:timestamp');

    const ts = handler.mock.calls[0][0].timestamp;
    expect(() => new Date(ts)).not.toThrow();
    expect(new Date(ts).toISOString()).toBe(ts);

    unsub();
  });
});

// ─── ticket-columns Edge Cases ─────────────────────────────────────────────────

describe('ticket-columns — edge cases', () => {
  it('should ignore tickets with unknown status', async () => {
    const { groupTicketsByStatus, KANBAN_COLUMNS } = await import('../ticket-columns');
    const tickets = [
      { id: '1', status: 'backlog' },
      { id: '2', status: 'INVALID_STATUS' },
      { id: '3', status: '' },
      { id: '4', status: 'nonexistent' },
    ];

    const groups = groupTicketsByStatus(tickets);
    expect(groups['backlog']).toHaveLength(1);

    // Unknown statuses should not appear in any column
    const totalGrouped = KANBAN_COLUMNS.reduce((sum, col) => sum + groups[col.id].length, 0);
    expect(totalGrouped).toBe(1); // Only the valid one
  });

  it('should handle tickets with same status correctly (ordering preserved)', async () => {
    const { groupTicketsByStatus } = await import('../ticket-columns');
    const tickets = [
      { id: 'a', status: 'in_progress' },
      { id: 'b', status: 'in_progress' },
      { id: 'c', status: 'in_progress' },
    ];

    const groups = groupTicketsByStatus(tickets);
    expect(groups['in_progress'].map((t: any) => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('should ensure all KANBAN_COLUMNS have unique ids', async () => {
    const { KANBAN_COLUMNS } = await import('../ticket-columns');
    const ids = KANBAN_COLUMNS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should ensure pending_approval is the first column', async () => {
    const { KANBAN_COLUMNS } = await import('../ticket-columns');
    expect(KANBAN_COLUMNS[0].id).toBe('pending_approval');
  });

  it('should ensure done is before failed/escalated', async () => {
    const { KANBAN_COLUMNS } = await import('../ticket-columns');
    const ids = KANBAN_COLUMNS.map((c) => c.id);
    const doneIdx = ids.indexOf('done');
    const failedIdx = ids.indexOf('failed');
    const escalatedIdx = ids.indexOf('escalated');
    expect(doneIdx).toBeLessThan(failedIdx);
    expect(doneIdx).toBeLessThan(escalatedIdx);
  });
});

// ─── api-client Edge Cases ──────────────────────────────────────────────────────

describe('api-client — edge cases', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });

  it('apiUrl should handle special characters in params', async () => {
    const { apiUrl } = await import('../api-client');
    const url = apiUrl('/search', { q: 'hello world&foo=bar' });
    expect(url).toContain('q=hello+world');
  });

  it('apiUrl should handle numeric zero as param value', async () => {
    const { apiUrl } = await import('../api-client');
    const url = apiUrl('/items', { offset: 0 });
    expect(url).toContain('offset=0');
  });

  it('apiPost should throw with descriptive message on 500', async () => {
    const { apiPost } = await import('../api-client');
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    });

    await expect(apiPost('/test', {})).rejects.toThrow('API error 500: Internal Server Error');
  });

  it('apiPatch should throw with descriptive message on 404', async () => {
    const { apiPatch } = await import('../api-client');
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => Promise.resolve('Not found'),
    });

    await expect(apiPatch('/items/999', {})).rejects.toThrow('API error 404');
  });

  it('fetcher should handle empty JSON response', async () => {
    const { fetcher } = await import('../api-client');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(null),
    });

    const result = await fetcher('/api/empty');
    expect(result).toBeNull();
  });
});

// ─── api-utils Edge Cases ───────────────────────────────────────────────────────

describe('api-utils — edge cases', () => {
  it('parseBody should return null for empty body', async () => {
    const { parseBody } = await import('../api-utils');
    const req = new Request('http://localhost', { method: 'POST' });
    const result = await parseBody(req);
    expect(result).toBeNull();
  });

  it('parseBody should handle deeply nested JSON', async () => {
    const { parseBody } = await import('../api-utils');
    const deep = { a: { b: { c: { d: 'value' } } } };
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify(deep),
      headers: { 'Content-Type': 'application/json' },
    });
    const result = await parseBody<typeof deep>(req);
    expect(result?.a.b.c.d).toBe('value');
  });

  it('jsonResponse should handle array data', async () => {
    const { jsonResponse } = await import('../api-utils');
    const res = jsonResponse([1, 2, 3]);
    const body = await res.json();
    expect(body).toEqual([1, 2, 3]);
  });

  it('jsonResponse should handle null data', async () => {
    const { jsonResponse } = await import('../api-utils');
    const res = jsonResponse(null);
    const body = await res.json();
    expect(body).toBeNull();
  });

  it('errorResponse should handle empty message', async () => {
    const { errorResponse } = await import('../api-utils');
    const res = errorResponse('', 422);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('');
  });

  it('newId should generate RFC4122-compliant UUIDs', async () => {
    const { newId } = await import('../api-utils');
    for (let i = 0; i < 10; i++) {
      const id = newId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    }
  });
});
