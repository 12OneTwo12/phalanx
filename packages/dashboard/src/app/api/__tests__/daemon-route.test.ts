import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/daemon', () => ({
  startDaemon: vi.fn(),
  stopDaemon: vi.fn().mockResolvedValue(undefined),
  isDaemonRunning: vi.fn().mockReturnValue(false),
}));

import { GET, POST } from '../daemon/route';
import { startDaemon, stopDaemon, isDaemonRunning } from '@/lib/daemon';

describe('/api/daemon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('returns running status', async () => {
      vi.mocked(isDaemonRunning).mockReturnValue(true);
      const res = await GET();
      const body = await res.json();
      expect(body.running).toBe(true);
    });
  });

  describe('POST', () => {
    it('starts daemon', async () => {
      const req = new Request('http://localhost/api/daemon', {
        method: 'POST',
        body: JSON.stringify({ action: 'start' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await POST(req);
      const body = await res.json();
      expect(body.running).toBe(true);
      expect(startDaemon).toHaveBeenCalled();
    });

    it('stops daemon', async () => {
      const req = new Request('http://localhost/api/daemon', {
        method: 'POST',
        body: JSON.stringify({ action: 'stop' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await POST(req);
      const body = await res.json();
      expect(body.running).toBe(false);
      expect(stopDaemon).toHaveBeenCalled();
    });

    it('rejects unknown action', async () => {
      const req = new Request('http://localhost/api/daemon', {
        method: 'POST',
        body: JSON.stringify({ action: 'restart' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('rejects missing action', async () => {
      const req = new Request('http://localhost/api/daemon', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('returns 500 when start fails', async () => {
      vi.mocked(startDaemon).mockImplementation(() => { throw new Error('No LLM'); });
      const req = new Request('http://localhost/api/daemon', {
        method: 'POST',
        body: JSON.stringify({ action: 'start' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await POST(req);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toContain('No LLM');
    });
  });
});
