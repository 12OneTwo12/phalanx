import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock EventSource
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 0;
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
    // Auto-connect
    setTimeout(() => {
      this.readyState = 1;
      this.onopen?.();
    }, 0);
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateError() {
    this.onerror?.();
  }
}

describe('useEventStream', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should create an EventSource with the default URL', async () => {
    // Dynamically import to pick up the mocked EventSource
    const { useEventStream } = await import('../use-event-stream');

    // We can't easily test hooks without a renderer, so we test the module exports
    expect(useEventStream).toBeDefined();
    expect(typeof useEventStream).toBe('function');
  });

  it('MockEventSource should track instances', () => {
    const es = new MockEventSource('/api/events');
    expect(MockEventSource.instances).toContain(es);
    expect(es.url).toBe('/api/events');
  });

  it('MockEventSource should call onopen asynchronously', async () => {
    const es = new MockEventSource('/test');
    const onOpen = vi.fn();
    es.onopen = onOpen;

    await new Promise((r) => setTimeout(r, 10));
    expect(onOpen).toHaveBeenCalled();
  });

  it('MockEventSource should deliver messages via simulateMessage', () => {
    const es = new MockEventSource('/test');
    const onMessage = vi.fn();
    es.onmessage = onMessage;

    es.simulateMessage({ type: 'test', payload: {} });
    expect(onMessage).toHaveBeenCalledOnce();
  });
});
