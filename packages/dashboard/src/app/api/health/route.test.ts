import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';

describe('/api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 200 status', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
  });

  it('should return JSON with correct structure', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('uptime');
    expect(data).toHaveProperty('environment');
    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('service');
  });

  it('should return status "ok"', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.status).toBe('ok');
  });

  it('should return valid ISO timestamp', async () => {
    const response = await GET();
    const data = await response.json();

    const timestamp = new Date(data.timestamp);
    expect(timestamp.toString()).not.toBe('Invalid Date');
  });

  it('should return service name as "phalanx-dashboard"', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.service).toBe('phalanx-dashboard');
  });

  it('should return uptime as a number', async () => {
    const response = await GET();
    const data = await response.json();

    expect(typeof data.uptime).toBe('number');
    expect(data.uptime).toBeGreaterThanOrEqual(0);
  });
});
