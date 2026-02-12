import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/channel-wiring', () => {
  const mockProviders = [
    {
      id: 'web',
      name: 'Web Dashboard',
      isRunning: () => true,
      capabilities: { reactions: false, threads: false, edit: false, delete: false, buttons: false, media: false, markdown: true },
    },
    {
      id: 'telegram',
      name: 'Telegram',
      isRunning: () => false,
      capabilities: { reactions: true, threads: true, edit: true, delete: true, buttons: true, media: true, markdown: true },
    },
  ];

  return {
    getChannelRegistry: vi.fn(() => ({
      getAll: () => mockProviders,
    })),
    isChannelSystemRunning: vi.fn(() => true),
  };
});

import { GET } from '../channels/status/route';

describe('GET /api/channels/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns channel system status and provider list', async () => {
    const res = await GET();
    const body = await res.json();

    expect(body.channelSystemRunning).toBe(true);
    expect(body.providers).toHaveLength(2);
    expect(body.providers[0].id).toBe('web');
    expect(body.providers[0].running).toBe(true);
    expect(body.providers[1].id).toBe('telegram');
    expect(body.providers[1].running).toBe(false);
  });
});
