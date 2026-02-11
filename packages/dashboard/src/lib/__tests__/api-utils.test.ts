import { describe, it, expect } from 'vitest';
import { jsonResponse, errorResponse, newId, parseBody } from '../api-utils';

describe('api-utils', () => {
  describe('jsonResponse', () => {
    it('should return JSON with default 200 status', async () => {
      const res = jsonResponse({ ok: true });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ ok: true });
    });

    it('should accept custom status', async () => {
      const res = jsonResponse({ id: '1' }, 201);
      expect(res.status).toBe(201);
    });
  });

  describe('errorResponse', () => {
    it('should return error JSON with given status', async () => {
      const res = errorResponse('not found', 404);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toEqual({ error: 'not found' });
    });

    it('should default to 400', async () => {
      const res = errorResponse('bad');
      expect(res.status).toBe(400);
    });
  });

  describe('newId', () => {
    it('should generate unique UUIDs', () => {
      const a = newId();
      const b = newId();
      expect(a).not.toBe(b);
      expect(a).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('parseBody', () => {
    it('should parse valid JSON', async () => {
      const req = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await parseBody<{ name: string }>(req);
      expect(result).toEqual({ name: 'test' });
    });

    it('should return null for invalid JSON', async () => {
      const req = new Request('http://localhost', {
        method: 'POST',
        body: 'not json',
      });
      const result = await parseBody(req);
      expect(result).toBeNull();
    });
  });
});
