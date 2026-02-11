import { describe, it, expect, vi } from 'vitest';
import { eventBus } from '../event-bus';

describe('EventBus', () => {
  it('should deliver events to subscribers', () => {
    const handler = vi.fn();
    const unsub = eventBus.subscribe(handler);

    eventBus.emit('test:event', { key: 'value' });

    expect(handler).toHaveBeenCalledOnce();
    const event = handler.mock.calls[0][0];
    expect(event.type).toBe('test:event');
    expect(event.payload).toEqual({ key: 'value' });
    expect(event.timestamp).toBeDefined();

    unsub();
  });

  it('should not deliver events after unsubscribe', () => {
    const handler = vi.fn();
    const unsub = eventBus.subscribe(handler);
    unsub();

    eventBus.emit('test:after-unsub');
    expect(handler).not.toHaveBeenCalled();
  });

  it('should handle multiple subscribers', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    const u1 = eventBus.subscribe(h1);
    const u2 = eventBus.subscribe(h2);

    eventBus.emit('multi');

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();

    u1();
    u2();
  });

  it('should not crash if a listener throws', () => {
    const bad = vi.fn(() => { throw new Error('boom'); });
    const good = vi.fn();
    const u1 = eventBus.subscribe(bad);
    const u2 = eventBus.subscribe(good);

    expect(() => eventBus.emit('error-test')).not.toThrow();
    expect(good).toHaveBeenCalledOnce();

    u1();
    u2();
  });

  it('should track subscriber count', () => {
    const initial = eventBus.subscriberCount;
    const unsub = eventBus.subscribe(() => {});
    expect(eventBus.subscriberCount).toBe(initial + 1);
    unsub();
    expect(eventBus.subscriberCount).toBe(initial);
  });
});
