import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { bridgeHeartbeatToSSE } from '@/lib/heartbeat-bridge';
import { eventBus } from '@/lib/event-bus';

describe('heartbeat-bridge', () => {
  let mockService: EventEmitter;

  beforeEach(() => {
    mockService = new EventEmitter();
  });

  it('should forward heartbeat:report events to EventBus', () => {
    const events: Array<{ type: string }> = [];
    const unsub = eventBus.subscribe((e) => events.push(e));

    const cleanup = bridgeHeartbeatToSSE(mockService as any);

    mockService.emit('heartbeat:report', {
      report: { summary: 'Test report', proposals: [] },
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('heartbeat:report');

    cleanup();
    unsub();
  });

  it('should forward heartbeat:error events to EventBus', () => {
    const events: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const unsub = eventBus.subscribe((e) => events.push(e));

    const cleanup = bridgeHeartbeatToSSE(mockService as any);

    mockService.emit('heartbeat:error', { error: new Error('DB down') });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('heartbeat:error');
    expect(events[0].payload.message).toBe('DB down');

    cleanup();
    unsub();
  });

  it('should stop forwarding after cleanup', () => {
    const events: Array<{ type: string }> = [];
    const unsub = eventBus.subscribe((e) => events.push(e));

    const cleanup = bridgeHeartbeatToSSE(mockService as any);
    cleanup();

    mockService.emit('heartbeat:report', { report: {} });
    expect(events).toHaveLength(0);

    unsub();
  });
});
