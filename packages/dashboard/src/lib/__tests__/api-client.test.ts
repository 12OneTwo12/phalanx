import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetcher, apiUrl, apiPost, apiPatch, apiDelete } from '../api-client';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('api-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetcher', () => {
    it('should return parsed JSON on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: '1', name: 'test' }),
      });

      const result = await fetcher('/api/goals');
      expect(result).toEqual({ id: '1', name: 'test' });
    });

    it('should throw on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not found'),
      });

      await expect(fetcher('/api/goals/xxx')).rejects.toThrow('API error 404: Not found');
    });
  });

  describe('apiUrl', () => {
    it('should build URL with path only', () => {
      const url = apiUrl('/goals');
      expect(url).toBe('/api/goals');
    });

    it('should build URL with query params', () => {
      const url = apiUrl('/goals', { status: 'active', limit: 10 });
      expect(url).toContain('/api/goals');
      expect(url).toContain('status=active');
      expect(url).toContain('limit=10');
    });

    it('should skip undefined params', () => {
      const url = apiUrl('/goals', { status: undefined });
      expect(url).toBe('/api/goals');
    });
  });

  describe('apiPost', () => {
    it('should POST JSON and return parsed response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'new' }),
      });

      const result = await apiPost('/goals', { description: 'test' });
      expect(result).toEqual({ id: 'new' });
      expect(mockFetch).toHaveBeenCalledWith('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"description":"test"}',
      });
    });
  });

  describe('apiPatch', () => {
    it('should PATCH JSON and return parsed response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: '1', status: 'done' }),
      });

      const result = await apiPatch('/goals/1', { status: 'done' });
      expect(result).toEqual({ id: '1', status: 'done' });
    });
  });

  describe('apiDelete', () => {
    it('should send DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await apiDelete('/goals/1');
      expect(mockFetch).toHaveBeenCalledWith('/api/goals/1', { method: 'DELETE' });
    });

    it('should throw on error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error'),
      });

      await expect(apiDelete('/goals/1')).rejects.toThrow('API error 500');
    });
  });
});
